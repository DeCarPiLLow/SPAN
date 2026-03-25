from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models import GlobalSnapshot, ArtistFollowerSnapshot, SpotifyAccount
from app.services import analytics_service as svc
from app.services.cache_service import get_json, set_json
from app.utils.decorators import spotify_required

global_bp = Blueprint('global_data', __name__)

GLOBAL_TOP50_ID = '37i9dQZEVXbMDoHDwVN2tF'
COUNTRY_PLAYLISTS = {
    'US': '37i9dQZEVXbLRQDuF5jeBp',
    'GB': '37i9dQZEVXbLnolsZ8PSNw',
    'DE': '37i9dQZEVXbJiZcmkrIHGU',
    'FR': '37i9dQZEVXbIPWwFssbupI',
    'BR': '37i9dQZEVXbMXbN3EUUhlg',
    'IN': '37i9dQZEVXbLZ52XmnySJg',
    'JP': '37i9dQZEVXbKXQ4mDTEBXq',
    'AU': '37i9dQZEVXbK4fwx2r07YW',
    'MX': '37i9dQZEVXbO3qyFxbkOE1',
    'KR': '37i9dQZEVXbNxXF4SkHj9F',
}


@global_bp.route('/seed', methods=['POST'])
@spotify_required
def seed_global(current_user_id=None, spotify_account=None):
    """
    Fetch Global Top 50 + country playlists right now using the logged-in user's token.
    This populates GlobalSnapshot so Mood Meter, Taste Twin, etc. work immediately.
    Call this once after first login — takes ~30s.
    """
    from app.services.spotify_client import SpotifyClient
    from app.services.analytics_service import upsert_track
    from datetime import date
    from collections import defaultdict

    client = SpotifyClient(user_id=current_user_id, spotify_account=spotify_account)

    def fetch_and_store(playlist_id, country_code):
        try:
            tracks    = client.get_playlist_tracks(playlist_id)
            spotify_ids, track_dicts = [], []
            for item in tracks:
                t = item.get('track')
                if t and t.get('id'):
                    spotify_ids.append(t['id'])
                    track_dicts.append(t)
                    upsert_track(t)
            db.session.commit()

            features = client.get_audio_features_batch(spotify_ids[:50])
            feat_map = {f['id']: f for f in features if f and f.get('id')}
            vals, engs, dancs, tempos = [], [], [], []
            for feat in feat_map.values():
                vals.append(feat.get('valence', 0))
                engs.append(feat.get('energy', 0))
                dancs.append(feat.get('danceability', 0))
                tempos.append(feat.get('tempo', 0))

            # Genre aggregation
            artist_ids = list({a['id'] for t in track_dicts for a in t.get('artists', []) if a.get('id')})
            genre_counts = defaultdict(int)
            if artist_ids:
                for a in client.get_artists_batch(artist_ids[:50]):
                    for g in (a.get('genres') or []):
                        genre_counts[g] += 1

            top_genres = dict(sorted(genre_counts.items(), key=lambda x: x[1], reverse=True)[:20])

            # Delete today's existing snapshot for this country before inserting
            GlobalSnapshot.query.filter_by(
                country_code=country_code, snapshot_date=date.today()
            ).delete()

            db.session.add(GlobalSnapshot(
                playlist_id      = playlist_id,
                country_code     = country_code,
                snapshot_date    = date.today(),
                avg_valence      = sum(vals)/max(len(vals),1),
                avg_energy       = sum(engs)/max(len(engs),1),
                avg_danceability = sum(dancs)/max(len(dancs),1),
                avg_tempo        = sum(tempos)/max(len(tempos),1),
                top_genres       = top_genres,
                track_ids        = spotify_ids,
            ))
            db.session.commit()
            return True
        except Exception as e:
            db.session.rollback()
            return False

    results = {}
    results['GLOBAL'] = fetch_and_store(GLOBAL_TOP50_ID, 'GLOBAL')
    for country, pid in COUNTRY_PLAYLISTS.items():
        results[country] = fetch_and_store(pid, country)

    # Bust caches
    set_json('global:mood_meter', None, 1)
    return jsonify({'seeded': results, 'message': 'Global snapshots populated.'})


@global_bp.route('/mood-meter', methods=['GET'])
@jwt_required()
def mood_meter():
    cache_key = 'global:mood_meter'
    cached    = get_json(cache_key)
    if cached:
        return jsonify(cached)

    snap = GlobalSnapshot.query.filter_by(country_code='GLOBAL')\
        .order_by(GlobalSnapshot.snapshot_date.desc()).first()

    if not snap:
        return jsonify({
            'message':   'No global snapshot yet.',
            'hint':      'POST /api/global/seed to fetch global chart data now.',
            'seeded':    False,
        })

    data = {
        'seeded':           True,
        'avg_valence':      snap.avg_valence,
        'avg_energy':       snap.avg_energy,
        'avg_danceability': snap.avg_danceability,
        'avg_tempo':        snap.avg_tempo,
        'top_genres':       snap.top_genres or {},
        'snapshot_date':    snap.snapshot_date.isoformat(),
    }
    set_json(cache_key, data, 3600)
    return jsonify(data)


@global_bp.route('/shelf-life', methods=['GET'])
@jwt_required()
def shelf_life():
    cache_key = 'global:shelf_life'
    cached    = get_json(cache_key)
    if cached:
        return jsonify(cached)

    snaps = GlobalSnapshot.query.order_by(GlobalSnapshot.snapshot_date.desc()).limit(30).all()
    if len(snaps) < 2:
        return jsonify({
            'message': 'Need at least 2 daily snapshots to calculate shelf life.',
            'hint':    'POST /api/global/seed once per day for a week.',
        })

    track_appearances = {}
    for snap in snaps:
        for tid in (snap.track_ids or []):
            track_appearances[tid] = track_appearances.get(tid, 0) + 1

    avg_shelf = sum(track_appearances.values()) / max(len(track_appearances), 1)
    data = {
        'avg_days_on_chart':    round(avg_shelf, 1),
        'total_unique_tracks':  len(track_appearances),
        'snapshots_analyzed':   len(snaps),
    }
    set_json(cache_key, data, 86400)
    return jsonify(data)


@global_bp.route('/artist-velocity', methods=['GET'])
@jwt_required()
def artist_velocity():
    cache_key = 'global:artist_velocity'
    cached    = get_json(cache_key)
    if cached:
        return jsonify(cached)
    data = svc.compute_artist_velocity()
    set_json(cache_key, data, 7200)
    return jsonify(data)


@global_bp.route('/genre-heatmap', methods=['GET'])
@jwt_required()
def genre_heatmap():
    snaps = GlobalSnapshot.query.filter(
        GlobalSnapshot.country_code != 'GLOBAL'
    ).order_by(GlobalSnapshot.snapshot_date.desc()).all()

    seen = {}
    for snap in snaps:
        if snap.country_code not in seen:
            seen[snap.country_code] = {
                'country': snap.country_code,
                'genres':  snap.top_genres or {},
                'energy':  snap.avg_energy,
                'valence': snap.avg_valence,
            }
    return jsonify(list(seen.values()))
