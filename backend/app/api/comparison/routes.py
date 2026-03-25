from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models import GlobalSnapshot
from app.services import analytics_service as svc
from app.services.cache_service import get_json, set_json
from app.utils.decorators import spotify_required

comparison_bp = Blueprint('comparison', __name__)


@comparison_bp.route('/mainstream-score', methods=['GET'])
@spotify_required
def mainstream_score(current_user_id=None, spotify_account=None):
    cache_key = f"analytics:mainstream:{current_user_id}"
    cached    = get_json(cache_key)
    if cached:
        return jsonify(cached)

    # Get global top 100 IDs from DB snapshots
    global_snap = GlobalSnapshot.query.filter_by(country_code='GLOBAL')\
        .order_by(GlobalSnapshot.snapshot_date.desc()).first()
    global_ids  = set(global_snap.track_ids or []) if global_snap else set()

    data = svc.compute_mainstream_score(current_user_id, global_ids)
    set_json(cache_key, data, 21600)
    return jsonify(data)


@comparison_bp.route('/taste-twin', methods=['GET'])
@spotify_required
def taste_twin(current_user_id=None, spotify_account=None):
    cache_key = f"analytics:taste_twin:{current_user_id}"
    cached    = get_json(cache_key)
    if cached:
        return jsonify(cached)
    data = svc.find_taste_twin(current_user_id)
    set_json(cache_key, data, 43200)
    return jsonify(data)


@comparison_bp.route('/mood-delta', methods=['GET'])
@spotify_required
def mood_delta(current_user_id=None, spotify_account=None):
    data = svc.compute_mood_delta(current_user_id)
    return jsonify(data)


@comparison_bp.route('/decade-breakdown', methods=['GET'])
@spotify_required
def decade_breakdown(current_user_id=None, spotify_account=None):
    data = svc.compute_decade_breakdown(current_user_id)
    return jsonify(data)
