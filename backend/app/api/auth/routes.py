import uuid
import secrets
from urllib.parse import urlencode
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import (
    create_access_token, create_refresh_token,
    jwt_required, get_jwt_identity,
)
from app.extensions import db, redis_client
from app.models import User, SpotifyAccount
from app.services.spotify_client import SpotifyClient
from app.services.token_service import encrypt_token

auth_bp = Blueprint('auth', __name__)

SPOTIFY_SCOPES = ' '.join([
    'user-read-private',
    'user-read-email',
    'user-top-read',
    'user-read-recently-played',
    'user-follow-read',
    'playlist-read-private',
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing',
    'user-read-playback-position',
])


@auth_bp.route('/login', methods=['POST'])
def login():
    data            = request.get_json(force=True)
    code_challenge  = data.get('code_challenge', '')
    code_verifier   = data.get('code_verifier', '')
    if not code_challenge or not code_verifier:
        return jsonify({'error': 'Missing code_challenge or code_verifier'}), 400
    # Use a simple alphanumeric state — avoids any URL-encoding issues
    state = secrets.token_hex(16)
    # Store verifier server-side so /callback works when redirect host ≠ login host
    # (e.g. localhost vs 127.0.0.1 — sessionStorage is per-origin).
    redis_client.setex(f"pkce:state:{state}", 600, code_verifier)

    # Use urlencode for correct encoding of all params
    params = urlencode({
        'client_id':             current_app.config['SPOTIFY_CLIENT_ID'],
        'response_type':         'code',
        'redirect_uri':          current_app.config['SPOTIFY_REDIRECT_URI'],
        'code_challenge_method': 'S256',
        'code_challenge':        code_challenge,
        'state':                 state,
        'scope':                 SPOTIFY_SCOPES,
    })
    url = f"https://accounts.spotify.com/authorize?{params}"
    return jsonify({'auth_url': url, 'state': state})


@auth_bp.route('/callback', methods=['POST'])
def callback():
    data          = request.get_json(force=True)
    code          = data.get('code', '')
    state         = data.get('state', '')

    # Validate state and load PKCE verifier from Redis (cross-origin safe)
    saved = redis_client.get(f"pkce:state:{state}")
    if not saved:
        return jsonify({'error': 'State expired or invalid. Please try logging in again.'}), 400
    redis_client.delete(f"pkce:state:{state}")
    code_verifier = saved.decode() if isinstance(saved, bytes) else saved

    client     = SpotifyClient()
    try:
        token_data = client.exchange_code(code, code_verifier)
    except Exception as e:
        return jsonify({'error': f'Token exchange failed: {str(e)}'}), 400

    access_token_spotify = token_data['access_token']
    profile    = client.get_profile(token=access_token_spotify)
    spotify_id = profile['id']

    spotify_account = SpotifyAccount.query.filter_by(spotify_id=spotify_id).first()

    if not spotify_account:
        user = User(email=profile.get('email'), display_name=profile.get('display_name'))
        db.session.add(user)
        db.session.flush()
        images = profile.get('images', [])
        spotify_account = SpotifyAccount(
            user_id                 = user.id,
            spotify_id              = spotify_id,
            encrypted_refresh_token = encrypt_token(token_data['refresh_token']),
            country                 = profile.get('country'),
            product                 = profile.get('product'),
            avatar_url              = images[0]['url'] if images else None,
        )
        db.session.add(spotify_account)
    else:
        user = spotify_account.user
        user.display_name = profile.get('display_name', user.display_name)
        spotify_account.encrypted_refresh_token = encrypt_token(token_data['refresh_token'])
        images = profile.get('images', [])
        if images:
            spotify_account.avatar_url = images[0]['url']

    db.session.commit()

    ttl = token_data.get('expires_in', 3600) - 60
    redis_client.setex(f"spotify:access:{user.id}", ttl, access_token_spotify)

    access_jwt  = create_access_token(identity=str(user.id))
    refresh_jwt = create_refresh_token(identity=str(user.id))

    return jsonify({
        'access_token':  access_jwt,
        'refresh_token': refresh_jwt,
        'user': {
            'id':           str(user.id),
            'display_name': user.display_name,
            'email':        user.email,
            'avatar_url':   spotify_account.avatar_url,
            'country':      spotify_account.country,
            'product':      spotify_account.product,
        }
    })


@auth_bp.route('/token/refresh', methods=['POST'])
@jwt_required(refresh=True)
def token_refresh():
    user_id    = get_jwt_identity()
    new_access = create_access_token(identity=user_id)
    return jsonify({'access_token': new_access})


@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    user_id = get_jwt_identity()
    redis_client.delete(f"spotify:access:{user_id}")
    return jsonify({'message': 'Logged out'})


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def me():
    raw_id  = get_jwt_identity()
    user_id = uuid.UUID(str(raw_id))
    account = SpotifyAccount.query.filter_by(user_id=user_id).first()
    if not account:
        return jsonify({'error': 'Not found'}), 404
    user = account.user
    return jsonify({
        'id':           str(user.id),
        'display_name': user.display_name,
        'email':        user.email,
        'avatar_url':   account.avatar_url,
        'country':      account.country,
        'product':      account.product,
        'last_synced':  account.last_synced_at.isoformat() if account.last_synced_at else None,
    })
