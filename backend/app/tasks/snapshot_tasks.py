from datetime import datetime, date
import uuid
from collections import defaultdict

# Celery instance imported from top-level worker module.
# When Flask runs without Celery, tasks are never called directly —
# they are dispatched via .delay() / .apply_async() only.
from celery_worker import celery

from app.extensions import db, redis_client
from app.models import (
    SpotifyAccount, ListeningHistory, GlobalSnapshot,
    GenreSnapshot, Artist, AudioFeature,
)
from app.services.spotify_client import SpotifyClient
from app.services.analytics_service import upsert_track, upsert_audio_features, compute_mood_radar
from app.services.cache_service import invalidate, invalidate_user_analytics_cache

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


@celery.task(bind=True, max_retries=3, default_retry_delay=300)
def sync_user_recently_played(self, user_id: str):
    try:
        uid = uuid.UUID(str(user_id))
        account = SpotifyAccount.query.filter_by(user_id=uid).first()
        if not account:
            return
        client = SpotifyClient(user_id=str(uid), spotify_account=account)
        data   = client.get_recently_played(limit=50)
        track_objects = []
        for item in data.get('items', []):
            t = item.get('track')
            if not t:
                continue
            try:
                played_at = datetime.fromisoformat(
                    item['played_at'].replace('Z', '+00:00')
                ).replace(tzinfo=None)
            except Exception:
                played_at = datetime.utcnow()
            if ListeningHistory.query.filter_by(user_id=uid, played_at=played_at).first():
                continue
            track = upsert_track(t)
            db.session.flush()
            db.session.add(ListeningHistory(
                user_id=uid, track_id=track.id,
                played_at=played_at, source='recently_played',
            ))
            track_objects.append(track)
        db.session.commit()

        # Enrich any newly seen tracks with audio features (mood radar needs it).
        track_ids_needing_af = [
            tr.spotify_id
            for tr in track_objects
            if not AudioFeature.query.filter_by(track_id=tr.id).first()
        ]
        track_ids_needing_af = list(set(track_ids_needing_af))
        if track_ids_needing_af:
            features = client.get_audio_features_batch(track_ids_needing_af)
            feat_map  = {f['id']: f for f in features if f and f.get('id')}
            for tr in track_objects:
                if tr.spotify_id in feat_map:
                    upsert_audio_features(tr, feat_map[tr.spotify_id])
            db.session.commit()

        account.last_synced_at = datetime.utcnow()
        db.session.commit()
        invalidate_user_analytics_cache(str(uid))
    except Exception as exc:
        db.session.rollback()
        raise self.retry(exc=exc)


@celery.task(bind=True, max_retries=2)
def sync_all_users_recently_played(self):
    for account in SpotifyAccount.query.all():
        sync_user_recently_played.delay(str(account.user_id))


@celery.task(bind=True, max_retries=2, default_retry_delay=180)
def poll_and_sync_currently_playing(self):
    """
    Poll Spotify currently-playing for each user.
    When the track changes, trigger a recently-played sync for that user.
    """
    for account in SpotifyAccount.query.all():
        client = SpotifyClient(user_id=str(account.user_id), spotify_account=account)
        playback = client.get_currently_playing() or {}
        item = playback.get('item') or {}
        track_id = item.get('id')
        if not track_id:
            continue

        user_id = str(account.user_id)
        last_key = f"spotify:last_playing_track:{user_id}"
        last_id = redis_client.get(last_key)
        last_id = last_id.decode() if isinstance(last_id, bytes) else last_id
        if last_id == track_id:
            continue

        # Remember recently-seen track to avoid spamming sync tasks.
        redis_client.setex(last_key, 900, track_id)  # 15 min
        sync_user_recently_played.delay(user_id)


@celery.task(bind=True, max_retries=3, default_retry_delay=600)
def take_global_snapshot(self, playlist_id: str, country_code: str):
    try:
        account = SpotifyAccount.query.first()
        if not account:
            return
        client  = SpotifyClient(user_id=str(account.user_id), spotify_account=account)
        tracks  = client.get_playlist_tracks(playlist_id)
        spotify_ids = []
        for item in tracks:
            t = item.get('track')
            if t and t.get('id'):
                upsert_track(t)
                spotify_ids.append(t['id'])
        db.session.commit()

        features = client.get_audio_features_batch(spotify_ids[:50])
        feat_map = {f['id']: f for f in features if f and f.get('id')}
        valences, energies, danceabilities, tempos = [], [], [], []
        for feat in feat_map.values():
            if feat:
                valences.append(feat.get('valence', 0))
                energies.append(feat.get('energy', 0))
                danceabilities.append(feat.get('danceability', 0))
                tempos.append(feat.get('tempo', 0))

        artist_ids = list({
            a['id']
            for item in tracks[:50]
            for a in (item.get('track') or {}).get('artists', [])
            if a.get('id')
        })
        genre_counts = defaultdict(int)
        if artist_ids:
            for a in client.get_artists_batch(artist_ids[:50]):
                for g in (a.get('genres') or []):
                    genre_counts[g] += 1
                artist = Artist.query.filter_by(spotify_id=a['id']).first()
                if artist:
                    artist.genres         = a.get('genres', [])
                    artist.follower_count = a.get('followers', {}).get('total', 0)
            db.session.commit()

        top_genres = dict(
            sorted(genre_counts.items(), key=lambda x: x[1], reverse=True)[:20]
        )
        db.session.add(GlobalSnapshot(
            playlist_id      = playlist_id,
            country_code     = country_code,
            snapshot_date    = date.today(),
            avg_valence      = sum(valences)      / max(len(valences), 1),
            avg_energy       = sum(energies)      / max(len(energies), 1),
            avg_danceability = sum(danceabilities)/ max(len(danceabilities), 1),
            avg_tempo        = sum(tempos)        / max(len(tempos), 1),
            top_genres       = top_genres,
            track_ids        = spotify_ids,
        ))
        db.session.commit()
        for gkey in ("global:mood_meter", "global:shelf_life", "global:artist_velocity"):
            invalidate(gkey)
    except Exception as exc:
        db.session.rollback()
        raise self.retry(exc=exc)


@celery.task(bind=True, max_retries=2)
def take_global_snapshot_all(self):
    take_global_snapshot.delay(GLOBAL_TOP50_ID, 'GLOBAL')
    for country, pid in COUNTRY_PLAYLISTS.items():
        take_global_snapshot.delay(pid, country)


@celery.task(bind=True, max_retries=3, default_retry_delay=300)
def take_user_genre_snapshot(self, user_id: str):
    try:
        uid = uuid.UUID(str(user_id))
        account = SpotifyAccount.query.filter_by(user_id=uid).first()
        if not account:
            return
        client = SpotifyClient(user_id=str(uid), spotify_account=account)
        items  = client.get_top_artists(time_range='medium_term', limit=50).get('items', [])
        genre_counts = defaultdict(int)
        for a in items:
            for g in a.get('genres', []):
                genre_counts[g] += 1
        total      = max(sum(genre_counts.values()), 1)
        genre_dist = {
            g: round(c / total, 4)
            for g, c in sorted(genre_counts.items(), key=lambda x: x[1], reverse=True)[:30]
        }
        mood_vec   = compute_mood_radar(str(uid))
        snap_month = date.today().replace(day=1)
        existing   = GenreSnapshot.query.filter_by(
            user_id=uid, snapshot_month=snap_month
        ).first()
        if existing:
            existing.genre_distribution = genre_dist
            existing.mood_vector        = mood_vec
        else:
            db.session.add(GenreSnapshot(
                user_id            = uid,
                snapshot_month     = snap_month,
                genre_distribution = genre_dist,
                mood_vector        = mood_vec,
            ))
        db.session.commit()
        invalidate_user_analytics_cache(str(uid))
    except Exception as exc:
        db.session.rollback()
        raise self.retry(exc=exc)


@celery.task(bind=True, max_retries=3, default_retry_delay=360)
def take_user_genre_snapshot_daily(self, user_id: str):
    """
    Daily GenreSnapshot.
    We store the day into GenreSnapshot.snapshot_month (date column) and format it as YYYY-MM-DD.
    """
    try:
        uid = uuid.UUID(str(user_id))
        account = SpotifyAccount.query.filter_by(user_id=uid).first()
        if not account:
            return
        client = SpotifyClient(user_id=str(uid), spotify_account=account)
        items  = client.get_top_artists(time_range='medium_term', limit=50).get('items', [])
        genre_counts = defaultdict(int)
        for a in items:
            for g in a.get('genres', []):
                genre_counts[g] += 1

        total      = max(sum(genre_counts.values()), 1)
        genre_dist = {
            g: round(c / total, 4)
            for g, c in sorted(genre_counts.items(), key=lambda x: x[1], reverse=True)[:30]
        }

        mood_vec   = compute_mood_radar(str(uid))
        snap_day   = date.today()
        existing   = GenreSnapshot.query.filter_by(
            user_id=uid, snapshot_month=snap_day
        ).first()
        if existing:
            existing.genre_distribution = genre_dist
            existing.mood_vector        = mood_vec
        else:
            db.session.add(GenreSnapshot(
                user_id            = uid,
                snapshot_month     = snap_day,
                genre_distribution = genre_dist,
                mood_vector        = mood_vec,
            ))
        db.session.commit()
        invalidate_user_analytics_cache(str(uid))
    except Exception as exc:
        db.session.rollback()
        raise self.retry(exc=exc)


@celery.task(bind=True, max_retries=3)
def take_all_genre_snapshots_daily(self):
    for account in SpotifyAccount.query.all():
        take_user_genre_snapshot_daily.delay(str(account.user_id))


@celery.task(bind=True, max_retries=2)
def take_all_genre_snapshots(self):
    for account in SpotifyAccount.query.all():
        take_user_genre_snapshot.delay(str(account.user_id))
