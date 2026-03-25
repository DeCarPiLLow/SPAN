from flask import Blueprint, jsonify
from app.services import analytics_service as svc
from app.utils.decorators import spotify_required

deep_dive_bp = Blueprint('deep_dive', __name__)


@deep_dive_bp.route('/decade-breakdown', methods=['GET'])
@spotify_required
def decade_breakdown(current_user_id=None, spotify_account=None):
    return jsonify(svc.compute_decade_breakdown(current_user_id))


@deep_dive_bp.route('/bpm-evolution', methods=['GET'])
@spotify_required
def bpm_evolution(current_user_id=None, spotify_account=None):
    return jsonify(svc.compute_bpm_evolution(current_user_id))


@deep_dive_bp.route('/obscurity', methods=['GET'])
@spotify_required
def obscurity(current_user_id=None, spotify_account=None):
    """Return obscurity per top artist using follower count as proxy."""
    from app.models import Artist, ListeningHistory, Track
    from app.extensions import db
    from sqlalchemy import func

    rows = db.session.query(
        Artist.name, Artist.follower_count, Artist.image_url,
        func.count(ListeningHistory.id).label('play_count')
    ).join(Track.artists)\
     .join(ListeningHistory, ListeningHistory.track_id == Track.id)\
     .filter(ListeningHistory.user_id == current_user_id)\
     .group_by(Artist.id)\
     .order_by(func.count(ListeningHistory.id).desc())\
     .limit(20).all()

    results = []
    for r in rows:
        obs = svc.compute_obscurity_index(r.follower_count or 1000000)
        results.append({
            'artist':         r.name,
            'follower_count': r.follower_count,
            'play_count':     r.play_count,
            'obscurity':      obs,
            'image_url':      r.image_url,
        })
    return jsonify(results)
