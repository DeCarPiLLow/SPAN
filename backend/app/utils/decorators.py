import uuid
from functools import wraps
from flask import jsonify
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
from app.models import SpotifyAccount


def spotify_required(fn):
    """Validates JWT and attaches spotify_account + UUID user_id to kwargs."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        raw_id  = get_jwt_identity()          # string from JWT
        user_id = uuid.UUID(str(raw_id))      # convert to Python UUID for SQLAlchemy

        account = SpotifyAccount.query.filter_by(user_id=user_id).first()
        if not account:
            return jsonify({'error': 'No Spotify account linked'}), 401

        kwargs['current_user_id'] = user_id   # UUID object
        kwargs['spotify_account'] = account
        return fn(*args, **kwargs)
    return wrapper
