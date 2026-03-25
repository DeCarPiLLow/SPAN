import base64
from flask import Blueprint, jsonify, request, Response
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db, redis_client
from app.models import CompatibilityCache, SpotifyAccount, User
from app.services import analytics_service as svc
from app.services.receipt_service import generate_receipt
from app.services.cache_service import get_json, set_json
from app.utils.decorators import spotify_required
from datetime import datetime, timedelta

engagement_bp = Blueprint('engagement', __name__)


@engagement_bp.route('/receipt', methods=['GET'])
@spotify_required
def receipt(current_user_id=None, spotify_account=None):
    """Generate and return shareable receipt image data."""
    cache_key = f"receipt:data:{current_user_id}"
    cached    = get_json(cache_key)
    if not cached:
        persona    = svc.assign_persona(current_user_id)
        radar      = svc.compute_mood_radar(current_user_id)
        discovery  = svc.compute_discovery_ratio(current_user_id)

        # Get top tracks from DB
        from app.models import ListeningHistory, Track, Artist
        from sqlalchemy import func
        top_rows = db.session.query(Track, func.count(ListeningHistory.id).label('plays'))\
            .join(ListeningHistory, ListeningHistory.track_id == Track.id)\
            .filter(ListeningHistory.user_id == current_user_id)\
            .group_by(Track.id)\
            .order_by(func.count(ListeningHistory.id).desc())\
            .limit(5).all()

        top_tracks = []
        for track, _ in top_rows:
            artist_names = ', '.join(a.name for a in track.artists)
            top_tracks.append({'title': track.title, 'artist': artist_names})

        # Extract top genres from top artists
        top_artist_rows = db.session.query(
            Artist.genres, func.count(ListeningHistory.id).label('plays')
        ).join(Artist.tracks)\
         .join(ListeningHistory, ListeningHistory.track_id == Track.id)\
         .filter(ListeningHistory.user_id == current_user_id)\
         .group_by(Artist.id)\
         .order_by(func.count(ListeningHistory.id).desc())\
         .limit(10).all()

        genre_counts = {}
        for row in top_artist_rows:
            for g in (row.genres or []):
                genre_counts[g] = genre_counts.get(g, 0) + row.plays
        top_genres = sorted(genre_counts, key=genre_counts.get, reverse=True)[:5]

        # Mainstream score
        from app.models import GlobalSnapshot
        global_snap = GlobalSnapshot.query.filter_by(country_code='GLOBAL')\
            .order_by(GlobalSnapshot.snapshot_date.desc()).first()
        global_ids  = set(global_snap.track_ids or []) if global_snap else set()
        mainstream  = svc.compute_mainstream_score(current_user_id, global_ids)

        cached = {
            'display_name':    spotify_account.user.display_name,
            'persona':         persona['persona'],
            'persona_reason':  persona['reason'],
            'top_tracks':      top_tracks,
            'top_genres':      top_genres,
            'mood':            radar,
            'mainstream_score':mainstream['score'],
            'discovery_ratio': discovery['ratio'],
            'obscurity_index': 0.75,
        }
        set_json(cache_key, cached, 3600)

    return jsonify(cached)


@engagement_bp.route('/receipt/image', methods=['GET'])
@spotify_required
def receipt_image(current_user_id=None, spotify_account=None):
    """Return the receipt as a PNG image."""
    cache_key  = f"receipt:data:{current_user_id}"
    user_data  = get_json(cache_key)

    if not user_data:
        # Quick minimal build
        user_data = {
            'display_name': spotify_account.user.display_name,
            'persona': 'The Explorer',
            'persona_reason': 'Sync your data for a full analysis.',
            'top_tracks': [],
            'top_genres': [],
            'mood': {},
            'mainstream_score': 0,
            'discovery_ratio': 0,
            'obscurity_index': 0,
        }

    img_bytes = generate_receipt(user_data)
    return Response(img_bytes, mimetype='image/png',
                    headers={'Content-Disposition': 'attachment; filename=receipt.png'})


@engagement_bp.route('/compatibility', methods=['POST'])
@spotify_required
def compatibility(current_user_id=None, spotify_account=None):
    """Compare two users. Body: { partner_spotify_id: str }"""
    data               = request.get_json(force=True)
    partner_spotify_id = data.get('partner_spotify_id', '')

    partner_account = SpotifyAccount.query.filter_by(spotify_id=partner_spotify_id).first()
    if not partner_account:
        return jsonify({'error': 'Partner not found or not registered'}), 404

    user_a = min(current_user_id, str(partner_account.user_id))
    user_b = max(current_user_id, str(partner_account.user_id))

    cache_key = f"compatibility:{user_a}:{user_b}"
    cached    = get_json(cache_key)
    if cached:
        return jsonify(cached)

    result = svc.compute_compatibility(current_user_id, str(partner_account.user_id))
    result['partner'] = {
        'display_name': partner_account.user.display_name,
        'avatar_url':   partner_account.avatar_url,
    }

    # Persist
    existing = CompatibilityCache.query.filter_by(user_a_id=user_a, user_b_id=user_b).first()
    if existing:
        existing.score      = result['score']
        existing.breakdown  = result['breakdown']
        existing.computed_at= datetime.utcnow()
        existing.expires_at = datetime.utcnow() + timedelta(hours=24)
    else:
        cc = CompatibilityCache(
            user_a_id  = user_a,
            user_b_id  = user_b,
            score      = result['score'],
            breakdown  = result['breakdown'],
            expires_at = datetime.utcnow() + timedelta(hours=24),
        )
        db.session.add(cc)
    db.session.commit()

    set_json(cache_key, result, 86400)
    return jsonify(result)
