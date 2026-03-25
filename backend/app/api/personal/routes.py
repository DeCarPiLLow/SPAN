import uuid
from datetime import datetime
from flask import Blueprint, jsonify, request
from app.extensions import db
from app.models import SpotifyAccount, ListeningHistory, Track, AudioFeature, Artist
from app.services.spotify_client import SpotifyClient
from app.services import analytics_service as svc
from app.services.cache_service import get_json, set_json, invalidate_pattern, invalidate_user_analytics_cache
from app.utils.decorators import spotify_required

personal_bp = Blueprint('personal', __name__)


def _sync_tracks_with_features(client, user_id, items, source='top_tracks'):
    """Upsert tracks + audio features + history rows. Returns insert count."""
    if not items:
        return 0

    track_objects = []
    for t in items:
        if not t or not t.get('id'):
            continue
        track_objects.append(svc.upsert_track(t))
    db.session.commit()

    # Audio features batch — only for tracks missing them
    needs_af = [t for t in track_objects
                if not AudioFeature.query.filter_by(track_id=t.id).first()]
    if needs_af:
        features = client.get_audio_features_batch([t.spotify_id for t in needs_af])
        feat_map = {f['id']: f for f in features if f and f.get('id')}
        for t_obj in needs_af:
            feat = feat_map.get(t_obj.spotify_id)
            if feat:
                svc.upsert_audio_features(t_obj, feat)
        db.session.commit()

    now, count = datetime.utcnow(), 0
    for t_obj in track_objects:
        if not ListeningHistory.query.filter_by(user_id=user_id, track_id=t_obj.id, source=source).first():
            db.session.add(ListeningHistory(
                user_id=user_id, track_id=t_obj.id,
                played_at=now, source=source,
            ))
            count += 1
    db.session.commit()
    return count


def _sync_recently_played(client, user_id):
    data  = client.get_recently_played(limit=50)
    items = data.get('items', [])

    track_dicts, played_ats = [], []
    for item in items:
        t = item.get('track')
        if not t or not t.get('id'):
            continue
        try:
            played_at = datetime.fromisoformat(
                item['played_at'].replace('Z', '+00:00')
            ).replace(tzinfo=None)
        except Exception:
            played_at = datetime.utcnow()
        track_dicts.append(t)
        played_ats.append((played_at, item))

    track_objects = [svc.upsert_track(t) for t in track_dicts]
    db.session.commit()

    needs_af = [t for t in track_objects
                if not AudioFeature.query.filter_by(track_id=t.id).first()]
    if needs_af:
        features = client.get_audio_features_batch([t.spotify_id for t in needs_af])
        feat_map = {f['id']: f for f in features if f and f.get('id')}
        for t_obj in needs_af:
            feat = feat_map.get(t_obj.spotify_id)
            if feat:
                svc.upsert_audio_features(t_obj, feat)
        db.session.commit()

    count = 0
    for t_obj, (played_at, item) in zip(track_objects, played_ats):
        if not ListeningHistory.query.filter_by(user_id=user_id, played_at=played_at).first():
            db.session.add(ListeningHistory(
                user_id      = user_id,
                track_id     = t_obj.id,
                played_at    = played_at,
                source       = 'recently_played',
                context_type = (item.get('context') or {}).get('type'),
            ))
            count += 1
    db.session.commit()

    account = SpotifyAccount.query.filter_by(user_id=user_id).first()
    if account:
        account.last_synced_at = datetime.utcnow()
        db.session.commit()
    return count


@personal_bp.route('/sync', methods=['POST'])
@spotify_required
def sync(current_user_id=None, spotify_account=None):
    uid = uuid.UUID(str(current_user_id))
    client = SpotifyClient(user_id=current_user_id, spotify_account=spotify_account)

    rp = _sync_recently_played(client, uid)

    # Merge unique tracks across all three time windows
    seen = {}
    for time_range in ('short_term', 'medium_term', 'long_term'):
        for t in client.get_top_tracks(time_range=time_range, limit=50).get('items', []):
            if t and t.get('id') and t['id'] not in seen:
                seen[t['id']] = t
    tt = _sync_tracks_with_features(client, uid, list(seen.values()), 'top_tracks')

    # Upsert artist records
    seen_artists = {}
    for time_range in ('short_term', 'medium_term', 'long_term'):
        for a in client.get_top_artists(time_range=time_range, limit=50).get('items', []):
            if a and a.get('id') and a['id'] not in seen_artists:
                seen_artists[a['id']] = a
    for a in seen_artists.values():
        existing = Artist.query.filter_by(spotify_id=a['id']).first()
        if not existing:
            existing = Artist(
                spotify_id    = a['id'],
                name          = a['name'],
                genres        = a.get('genres', []),
                popularity    = a.get('popularity', 0),
                follower_count= a.get('followers', {}).get('total', 0),
                image_url     = (a.get('images') or [{}])[0].get('url'),
            )
            db.session.add(existing)
        else:
            existing.genres          = a.get('genres', existing.genres)
            existing.popularity      = a.get('popularity', existing.popularity)
            existing.follower_count  = a.get('followers', {}).get('total', existing.follower_count)
            if a.get('images'):
                existing.image_url = a['images'][0]['url']
    db.session.commit()

    # Clear cached analytics so graphs don't keep showing old/empty values.
    invalidate_pattern(f"analytics:*:{current_user_id}")
    invalidate_user_analytics_cache(str(uid))

    # Update daily genre snapshots shortly after manual sync.
    # (Genre Evolution reads GenreSnapshot from the DB; Celery keeps it updated continuously.)
    try:
        from app.tasks.snapshot_tasks import take_user_genre_snapshot_daily, take_global_snapshot_all
        take_user_genre_snapshot_daily.delay(str(uid))
        # Global snapshots affect the Global pages.
        take_global_snapshot_all.delay()
    except Exception:
        pass

    return jsonify({
        'synced_recently_played': rp,
        'synced_top_tracks':      tt,
        'message':                'Sync complete.'
    })


@personal_bp.route('/listening-clock', methods=['GET'])
@spotify_required
def listening_clock(current_user_id=None, spotify_account=None):
    key    = f"analytics:listening_clock:{current_user_id}"
    cached = get_json(key)
    if cached is not None:
        return jsonify(cached)
    data = svc.compute_listening_clock(current_user_id)
    set_json(key, data, 3600)
    return jsonify(data)


@personal_bp.route('/mood-radar', methods=['GET'])
@spotify_required
def mood_radar(current_user_id=None, spotify_account=None):
    key    = f"analytics:mood_radar:{current_user_id}"
    cached = get_json(key)
    if cached is not None:
        return jsonify(cached)
    data = svc.compute_mood_radar(current_user_id)
    set_json(key, data, 7200)
    return jsonify(data)


@personal_bp.route('/discovery-ratio', methods=['GET'])
@spotify_required
def discovery_ratio(current_user_id=None, spotify_account=None):
    key    = f"analytics:discovery:{current_user_id}"
    cached = get_json(key)
    if cached is not None:
        return jsonify(cached)
    data = svc.compute_discovery_ratio(current_user_id)
    set_json(key, data, 21600)
    return jsonify(data)


@personal_bp.route('/genre-evolution', methods=['GET'])
@spotify_required
def genre_evolution(current_user_id=None, spotify_account=None):
    range_key = (request.args.get('range') or 'daily').lower()
    if range_key not in ('daily', 'weekly', 'monthly', 'quarterly'):
        range_key = 'daily'
    return jsonify(svc.compute_genre_evolution_range(current_user_id, range_key=range_key))


@personal_bp.route('/persona', methods=['GET'])
@spotify_required
def persona(current_user_id=None, spotify_account=None):
    key    = f"analytics:persona:{current_user_id}"
    cached = get_json(key)
    if cached is not None:
        return jsonify(cached)
    data = svc.assign_persona(current_user_id)
    set_json(key, data, 43200)
    return jsonify(data)


@personal_bp.route('/top-tracks', methods=['GET'])
@spotify_required
def top_tracks(current_user_id=None, spotify_account=None):
    time_range = request.args.get('range', 'medium_term')
    if time_range not in ('short_term', 'medium_term', 'long_term'):
        time_range = 'medium_term'
    key    = f"analytics:top_tracks:{current_user_id}:{time_range}"
    cached = get_json(key)
    if cached is not None:
        return jsonify(cached)
    client = SpotifyClient(user_id=current_user_id, spotify_account=spotify_account)
    data   = client.get_top_tracks(time_range=time_range, limit=50)
    set_json(key, data, 3600)
    return jsonify(data)


@personal_bp.route('/top-artists', methods=['GET'])
@spotify_required
def top_artists(current_user_id=None, spotify_account=None):
    time_range = request.args.get('range', 'medium_term')
    if time_range not in ('short_term', 'medium_term', 'long_term'):
        time_range = 'medium_term'
    key    = f"analytics:top_artists:{current_user_id}:{time_range}"
    cached = get_json(key)
    if cached is not None:
        return jsonify(cached)
    client = SpotifyClient(user_id=current_user_id, spotify_account=spotify_account)
    data   = client.get_top_artists(time_range=time_range, limit=50)
    set_json(key, data, 3600)
    return jsonify(data)


@personal_bp.route('/bpm-evolution', methods=['GET'])
@spotify_required
def bpm_evolution(current_user_id=None, spotify_account=None):
    return jsonify(svc.compute_bpm_evolution(current_user_id))


@personal_bp.route('/decade-breakdown', methods=['GET'])
@spotify_required
def decade_breakdown(current_user_id=None, spotify_account=None):
    return jsonify(svc.compute_decade_breakdown(current_user_id))


@personal_bp.route('/history', methods=['GET'])
@spotify_required
def listening_history(current_user_id=None, spotify_account=None):
    """Listening history with configurable time window."""
    hours = request.args.get('hours', 24, type=int)
    # Cap at 30 days
    hours = max(1, min(hours, 720))
    data  = svc.get_listening_history(current_user_id, hours=hours)
    return jsonify({'hours': hours, 'count': len(data), 'tracks': data})
