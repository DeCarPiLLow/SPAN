import uuid
from datetime import datetime, timedelta, date
from collections import defaultdict
import numpy as np
from app.extensions import db
from app.models import (
    User, ListeningHistory, Track, AudioFeature,
    Artist, GenreSnapshot, GlobalSnapshot, ArtistFollowerSnapshot
)
from sqlalchemy import func, desc


SPOTIFY_MAU = 600_000_000


def _uid(user_id):
    """Ensure user_id is a UUID object for consistent SQLAlchemy filtering."""
    if isinstance(user_id, uuid.UUID):
        return user_id
    return uuid.UUID(str(user_id))


# ─── Listening Clock ─────────────────────────────────────────────────────────

def compute_listening_clock(user_id) -> list:
    uid = _uid(user_id)
    rows = db.session.query(
        func.extract('hour', ListeningHistory.played_at).label('hour'),
        func.count().label('count'),
        func.avg(ListeningHistory.ms_played).label('avg_ms'),
    ).filter(ListeningHistory.user_id == uid).group_by('hour').all()

    buckets = {int(r.hour): {'count': r.count, 'avg_ms': round(r.avg_ms or 0)} for r in rows}
    return [{'hour': h, 'count': buckets.get(h, {}).get('count', 0),
             'avg_ms': buckets.get(h, {}).get('avg_ms', 0)} for h in range(24)]


# ─── Mood Radar ──────────────────────────────────────────────────────────────

def compute_mood_radar(user_id) -> dict:
    uid = _uid(user_id)
    result = db.session.query(
        func.avg(AudioFeature.energy).label('energy'),
        func.avg(AudioFeature.valence).label('valence'),
        func.avg(AudioFeature.danceability).label('danceability'),
        func.avg(AudioFeature.acousticness).label('acousticness'),
        func.avg(AudioFeature.instrumentalness).label('instrumentalness'),
        func.avg(AudioFeature.speechiness).label('speechiness'),
        func.avg(AudioFeature.liveness).label('liveness'),
    ).join(
        ListeningHistory, ListeningHistory.track_id == AudioFeature.track_id
    ).filter(ListeningHistory.user_id == uid).one_or_none()

    if not result:
        return {k: 0.0 for k in ['energy','valence','danceability','acousticness','instrumentalness','speechiness','liveness']}
    return {k: round(float(v or 0), 3) for k, v in result._mapping.items()}


# ─── Discovery Ratio ─────────────────────────────────────────────────────────

def compute_discovery_ratio(user_id) -> dict:
    uid    = _uid(user_id)
    cutoff = datetime.utcnow() - timedelta(days=30)
    total  = ListeningHistory.query.filter_by(user_id=uid).count()

    first_plays_subq = db.session.query(
        ListeningHistory.track_id,
        func.min(ListeningHistory.played_at).label('first_play')
    ).filter(ListeningHistory.user_id == uid).group_by(ListeningHistory.track_id).subquery()

    new_finds = db.session.query(first_plays_subq).filter(
        first_plays_subq.c.first_play >= cutoff
    ).count()

    return {
        'new_finds':     new_finds,
        'repeat_tracks': max(total - new_finds, 0),
        'ratio':         round(new_finds / max(total, 1), 4),
        'window_days':   30,
        'total_plays':   total,
    }


# ─── Genre Evolution ─────────────────────────────────────────────────────────

def compute_genre_evolution(user_id, granularity: str = 'day') -> list:
    """
    granularity:
    - day: format snapshot date as YYYY-MM-DD (daily snapshots)
    - month: format snapshot date as YYYY-MM
    """
    uid   = _uid(user_id)
    granularity = granularity if granularity in ('day', 'month') else 'day'
    snaps = GenreSnapshot.query.filter_by(user_id=uid)\
        .order_by(GenreSnapshot.snapshot_month).all()

    def fmt(d):
        return d.strftime('%Y-%m-%d') if granularity == 'day' else d.strftime('%Y-%m')

    return [{
        'month':              fmt(s.snapshot_month),
        'genre_distribution': s.genre_distribution or {},
        'mood_vector':        s.mood_vector or {},
    } for s in snaps]


def compute_genre_evolution_range(user_id, range_key: str = 'daily') -> list:
    """
    range_key:
    - daily: last 7 days
    - weekly: last 6 weeks
    - monthly: last 6 months
    - quarterly: last 4 quarters
    """
    uid = _uid(user_id)
    range_key = range_key if range_key in ('daily', 'weekly', 'monthly', 'quarterly') else 'daily'

    today = date.today()

    def week_start(d: date) -> date:
        return d - timedelta(days=d.weekday())  # Monday

    def quarter_for(d: date) -> int:
        return ((d.month - 1) // 3) + 1

    def period_key(d: date):
        if range_key == 'daily':
            return d
        if range_key == 'weekly':
            ws = week_start(d)
            return ws
        if range_key == 'monthly':
            return (d.year, d.month)
        # quarterly
        return (d.year, quarter_for(d))

    def period_label(pk) -> str:
        if range_key == 'daily':
            return pk.strftime('%Y-%m-%d')
        if range_key == 'weekly':
            return pk.strftime('%Y-%m-%d')
        if range_key == 'monthly':
            y, m = pk
            return f"{y:04d}-{m:02d}"
        y, q = pk
        return f"{y:04d}-Q{q}"

    def sort_key(pk):
        if range_key in ('daily', 'weekly'):
            return pk
        if range_key == 'monthly':
            y, m = pk
            return date(y, m, 1)
        y, q = pk
        m = (q - 1) * 3 + 1
        return date(y, m, 1)

    # Load snapshots and filter to the last N periods.
    snaps = GenreSnapshot.query.filter_by(user_id=uid)\
        .order_by(GenreSnapshot.snapshot_month).all()

    last_periods = []
    if range_key == 'daily':
        cutoff = today - timedelta(days=6)
        last_periods = [d for d in (cutoff + timedelta(days=i) for i in range(7))]
    elif range_key == 'weekly':
        this_ws = week_start(today)
        last_periods = [this_ws - timedelta(weeks=i) for i in range(5, -1, -1)]
    elif range_key == 'monthly':
        # Build last 6 month keys (inclusive)
        def add_months(y: int, m: int, delta: int) -> tuple[int, int]:
            total = (y * 12 + (m - 1)) + delta
            y2 = total // 12
            m2 = (total % 12) + 1
            return y2, m2

        # deltas: -5, -4, -3, -2, -1, 0
        last_periods = [add_months(today.year, today.month, d) for d in range(-5, 1)]
    else:
        # quarterly: last 4 quarters
        q_now = quarter_for(today)
        y_now = today.year
        quarters = []
        for i in range(3, -1, -1):
            total = (y_now * 4 + (q_now - 1)) - i
            y2 = total // 4
            q2 = (total % 4) + 1
            quarters.append((y2, q2))
        last_periods = quarters

    last_set = set(last_periods)

    # Aggregate within each period by averaging genre_distribution across snapshots.
    by_period = {pk: [] for pk in last_periods}
    for s in snaps:
        pk = period_key(s.snapshot_month)
        if pk in last_set:
            by_period[pk].append(s)

    results = []
    for pk in sorted(by_period.keys(), key=sort_key):
        period_snaps = by_period.get(pk, [])
        if not period_snaps:
            results.append({'month': period_label(pk), 'genre_distribution': {}, 'mood_vector': {}})
            continue

        all_genres = set()
        for s in period_snaps:
            all_genres.update((s.genre_distribution or {}).keys())

        num = max(len(period_snaps), 1)
        genre_dist_avg = {
            g: round(sum((s.genre_distribution or {}).get(g, 0) for s in period_snaps) / num, 4)
            for g in all_genres
        }

        # Average mood_vector values if present (keeps shape stable)
        mood_keys = set()
        for s in period_snaps:
            mood_keys.update((s.mood_vector or {}).keys())

        mood_avg = {}
        for k in mood_keys:
            mood_avg[k] = round(sum((s.mood_vector or {}).get(k, 0) for s in period_snaps) / num, 4)

        results.append({
            'month': period_label(pk),
            'genre_distribution': genre_dist_avg,
            'mood_vector': mood_avg,
        })

    return results


# ─── AI Persona ──────────────────────────────────────────────────────────────

def assign_persona(user_id) -> dict:
    uid       = _uid(user_id)
    discovery = compute_discovery_ratio(uid)
    radar     = compute_mood_radar(uid)

    years_rows = db.session.query(Track.release_year)\
        .join(ListeningHistory, ListeningHistory.track_id == Track.id)\
        .filter(ListeningHistory.user_id == uid).all()

    years      = [r[0] for r in years_rows if r[0]]
    avg_year   = sum(years) / max(len(years), 1) if years else 2000
    pre_2000   = sum(1 for y in years if y < 2000) / max(len(years), 1) if years else 0
    current_yr = datetime.utcnow().year
    dr         = discovery['ratio']

    if pre_2000 > 0.5:
        persona, reason = 'The Time Traveler', f'{round(pre_2000*100)}% of your listening is pre-2000 music.'
    elif dr > 0.6:
        persona, reason = 'The Explorer', f'{round(dr*100)}% new discoveries in the last 30 days.'
    elif dr < 0.15 and avg_year < current_yr - 5:
        persona, reason = 'The Comfort Listener', 'You return to the same beloved tracks repeatedly.'
    elif radar.get('valence', 0) > 0.65 and radar.get('energy', 0) > 0.65:
        persona, reason = 'The Trend Surfer', 'High-energy, high-valence taste aligns with current pop trends.'
    else:
        persona, reason = 'The Comfort Listener', 'Balanced listening with moderate discovery patterns.'

    return {
        'persona':          persona,
        'reason':           reason,
        'avg_release_year': round(avg_year),
        'discovery_ratio':  round(dr, 4),
        'mood':             radar,
    }


# ─── Mainstream Score ────────────────────────────────────────────────────────

def compute_mainstream_score(user_id, global_top100_ids: set) -> dict:
    uid = _uid(user_id)
    user_top = db.session.query(Track.spotify_id)\
        .join(ListeningHistory, ListeningHistory.track_id == Track.id)\
        .filter(ListeningHistory.user_id == uid)\
        .group_by(Track.spotify_id)\
        .order_by(func.count().desc())\
        .limit(100).all()

    user_top_ids = {r[0] for r in user_top}
    overlap      = user_top_ids & global_top100_ids
    score        = round(len(overlap) / max(len(user_top_ids), 1) * 100, 1)
    return {'score': score, 'overlap_count': len(overlap), 'user_top_count': len(user_top_ids)}


# ─── Obscurity Index ─────────────────────────────────────────────────────────

def compute_obscurity_index(artist_monthly_listeners: int) -> float:
    return round(1 - (artist_monthly_listeners / SPOTIFY_MAU), 4)


# ─── Cosine Similarity ───────────────────────────────────────────────────────

def _build_genre_vector(genre_dist: dict, all_genres: list) -> np.ndarray:
    return np.array([genre_dist.get(g, 0.0) for g in all_genres], dtype=float)


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    return float(np.dot(a, b) / denom) if denom > 0 else 0.0


def find_taste_twin(user_id) -> dict:
    uid       = _uid(user_id)
    user_snap = GenreSnapshot.query.filter_by(user_id=uid)\
        .order_by(GenreSnapshot.snapshot_month.desc()).first()
    if not user_snap:
        return {'country': None, 'similarity': 0}

    global_snaps = GlobalSnapshot.query.order_by(GlobalSnapshot.snapshot_date.desc()).limit(200).all()
    all_genres   = sorted(
        {g for s in global_snaps for g in (s.top_genres or {}).keys()} |
        set((user_snap.genre_distribution or {}).keys())
    )
    user_vec = _build_genre_vector(user_snap.genre_distribution or {}, all_genres)

    best, best_score = None, -1.0
    seen = set()
    for snap in global_snaps:
        if snap.country_code in seen:
            continue
        seen.add(snap.country_code)
        vec   = _build_genre_vector(snap.top_genres or {}, all_genres)
        score = cosine_similarity(user_vec, vec)
        if score > best_score:
            best_score, best = score, snap

    return {'country': best.country_code if best else None, 'similarity': round(best_score, 4)}


# ─── Mood Delta ──────────────────────────────────────────────────────────────

def compute_mood_delta(user_id) -> dict:
    uid       = _uid(user_id)
    user_mood = compute_mood_radar(uid)

    global_latest = GlobalSnapshot.query.filter_by(country_code='GLOBAL')\
        .order_by(GlobalSnapshot.snapshot_date.desc()).first()

    if not global_latest:
        return {'user': user_mood, 'global': {}, 'delta': {}}

    global_mood = {
        'energy':      global_latest.avg_energy      or 0,
        'valence':     global_latest.avg_valence     or 0,
        'danceability':global_latest.avg_danceability or 0,
    }
    delta = {k: round(user_mood.get(k, 0) - global_mood.get(k, 0), 3) for k in global_mood}
    return {'user': user_mood, 'global': global_mood, 'delta': delta}


# ─── Decade Breakdown ────────────────────────────────────────────────────────

def compute_decade_breakdown(user_id) -> list:
    uid = _uid(user_id)
    rows = db.session.query(
        Track.release_year,
        func.count().label('count')
    ).join(ListeningHistory, ListeningHistory.track_id == Track.id)\
     .filter(ListeningHistory.user_id == uid)\
     .filter(Track.release_year.isnot(None))\
     .group_by(Track.release_year).all()

    decades = defaultdict(int)
    for r in rows:
        decades[(r.release_year // 10) * 10] += r.count

    total = max(sum(decades.values()), 1)
    return sorted([{'decade': f"{d}s", 'count': c, 'pct': round(c/total*100,1)}
                   for d, c in decades.items()], key=lambda x: x['decade'])


# ─── BPM Evolution ───────────────────────────────────────────────────────────

def compute_bpm_evolution(user_id) -> list:
    uid = _uid(user_id)
    rows = db.session.query(
        func.date_trunc('month', ListeningHistory.played_at).label('month'),
        func.avg(AudioFeature.tempo).label('avg_bpm'),
        func.count().label('count'),
    ).join(AudioFeature, AudioFeature.track_id == ListeningHistory.track_id)\
     .filter(ListeningHistory.user_id == uid)\
     .group_by('month').order_by('month').all()

    return [{'month': r.month.strftime('%Y-%m'), 'avg_bpm': round(r.avg_bpm or 0, 1), 'count': r.count}
            for r in rows]


# ─── Artist Velocity ─────────────────────────────────────────────────────────

def compute_artist_velocity() -> list:
    today    = date.today()
    week_ago = today - timedelta(days=7)

    now_snaps  = {s.artist_id: s for s in ArtistFollowerSnapshot.query.filter_by(snapshot_date=today).all()}
    prev_snaps = {s.artist_id: s for s in ArtistFollowerSnapshot.query.filter_by(snapshot_date=week_ago).all()}

    results = []
    for artist_id, now_snap in now_snaps.items():
        prev_snap = prev_snaps.get(artist_id)
        if prev_snap and prev_snap.follower_count > 0:
            velocity = (now_snap.follower_count - prev_snap.follower_count) / prev_snap.follower_count
            artist   = Artist.query.get(artist_id)
            if artist:
                results.append({
                    'artist':        artist.name,
                    'velocity':      round(velocity * 100, 2),
                    'followers_now': now_snap.follower_count,
                    'image_url':     artist.image_url,
                })

    return sorted(results, key=lambda x: x['velocity'], reverse=True)[:20]


# ─── Compatibility ───────────────────────────────────────────────────────────

def compute_compatibility(user_a_id, user_b_id) -> dict:
    def get_genre_vec(uid):
        snap = GenreSnapshot.query.filter_by(user_id=_uid(uid))\
            .order_by(GenreSnapshot.snapshot_month.desc()).first()
        return snap.genre_distribution if snap else {}

    genres_a  = get_genre_vec(user_a_id)
    genres_b  = get_genre_vec(user_b_id)
    all_g     = sorted(set(genres_a) | set(genres_b))
    va        = _build_genre_vector(genres_a, all_g)
    vb        = _build_genre_vector(genres_b, all_g)
    genre_sim = cosine_similarity(va, vb)

    mood_a   = compute_mood_radar(user_a_id)
    mood_b   = compute_mood_radar(user_b_id)
    mood_diff= np.mean([abs(mood_a.get(k,0) - mood_b.get(k,0)) for k in ['energy','valence','danceability']])
    mood_sim = 1 - mood_diff

    score = round((genre_sim * 0.6 + mood_sim * 0.4) * 100, 1)
    return {
        'score':     score,
        'breakdown': {
            'genre_similarity': round(genre_sim * 100, 1),
            'mood_similarity':  round(mood_sim  * 100, 1),
        }
    }


# ─── Listening History (new) ─────────────────────────────────────────────────

def get_listening_history(user_id, hours: int = 24, limit: int = 200) -> list:
    uid    = _uid(user_id)
    since  = datetime.utcnow() - timedelta(hours=hours)

    rows = db.session.query(ListeningHistory, Track)\
        .join(Track, Track.id == ListeningHistory.track_id)\
        .filter(ListeningHistory.user_id == uid)\
        .filter(ListeningHistory.played_at >= since)\
        .order_by(ListeningHistory.played_at.desc())\
        .limit(limit).all()

    result = []
    for lh, track in rows:
        artists = [a.name for a in track.artists]
        images  = []
        # Grab image from track if available
        result.append({
            'played_at':   lh.played_at.isoformat(),
            'track_id':    str(track.id),
            'spotify_id':  track.spotify_id,
            'title':       track.title,
            'album':       track.album,
            'artists':     artists,
            'duration_ms': track.duration_ms,
            'image_url':   track.image_url,
            'spotify_url': f"https://open.spotify.com/track/{track.spotify_id}",
            'source':      lh.source,
        })
    return result


# ─── Track upsert helpers ────────────────────────────────────────────────────

def upsert_track(spotify_track: dict) -> Track:
    existing = Track.query.filter_by(spotify_id=spotify_track['id']).first()
    if existing:
        return existing

    images   = spotify_track.get('album', {}).get('images', [])
    image_url= images[0]['url'] if images else None

    release_date = spotify_track.get('album', {}).get('release_date', '')
    try:
        release_year = int(release_date[:4])
    except (ValueError, TypeError):
        release_year = None

    track = Track(
        spotify_id   = spotify_track['id'],
        title        = spotify_track['name'],
        album        = spotify_track.get('album', {}).get('name'),
        duration_ms  = spotify_track.get('duration_ms'),
        popularity   = spotify_track.get('popularity', 0),
        release_year = release_year,
        preview_url  = spotify_track.get('preview_url'),
        image_url    = image_url,
    )
    db.session.add(track)
    db.session.flush()

    for a in spotify_track.get('artists', []):
        artist = Artist.query.filter_by(spotify_id=a['id']).first()
        if not artist:
            artist = Artist(spotify_id=a['id'], name=a['name'])
            db.session.add(artist)
            db.session.flush()
        if artist not in track.artists:
            track.artists.append(artist)

    return track


def upsert_audio_features(track: Track, features: dict):
    if not features or features.get('id') is None:
        return
    if AudioFeature.query.filter_by(track_id=track.id).first():
        return
    db.session.add(AudioFeature(
        track_id         = track.id,
        energy           = features.get('energy', 0),
        valence          = features.get('valence', 0),
        danceability     = features.get('danceability', 0),
        acousticness     = features.get('acousticness', 0),
        instrumentalness = features.get('instrumentalness', 0),
        liveness         = features.get('liveness', 0),
        speechiness      = features.get('speechiness', 0),
        tempo            = features.get('tempo', 0),
        key              = features.get('key', 0),
        time_signature   = features.get('time_signature', 4),
        loudness         = features.get('loudness', 0),
    ))
