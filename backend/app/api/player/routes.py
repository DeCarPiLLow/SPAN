from flask import Blueprint, jsonify, request
from app.services.spotify_client import SpotifyClient
from app.utils.decorators import spotify_required

player_bp = Blueprint('player', __name__)


def _client(uid, acc):
    return SpotifyClient(user_id=uid, spotify_account=acc)


@player_bp.route('/now-playing', methods=['GET'])
@spotify_required
def now_playing(current_user_id=None, spotify_account=None):
    data = _client(current_user_id, spotify_account).get_currently_playing()
    if not data or not data.get('item'):
        return jsonify({'is_playing': False, 'item': None})
    item = data['item']
    images = item.get('album', {}).get('images', [])
    return jsonify({
        'is_playing':        data.get('is_playing', False),
        'progress_ms':       data.get('progress_ms', 0),
        'shuffle_state':     data.get('shuffle_state', False),
        'repeat_state':      data.get('repeat_state', 'off'),
        'device': {
            'name':          (data.get('device') or {}).get('name', ''),
            'type':          (data.get('device') or {}).get('type', ''),
            'volume_percent':(data.get('device') or {}).get('volume_percent', 50),
        },
        'item': {
            'id':            item.get('id'),
            'name':          item.get('name'),
            'duration_ms':   item.get('duration_ms', 0),
            'artists':       [{'name': a['name'], 'id': a['id']} for a in item.get('artists', [])],
            'album': {
                'name':      item.get('album', {}).get('name', ''),
                'image':     images[0]['url'] if images else None,
            },
            'spotify_url':   item.get('external_urls', {}).get('spotify', ''),
            'uri':           item.get('uri', ''),
        }
    })


@player_bp.route('/queue', methods=['GET'])
@spotify_required
def queue(current_user_id=None, spotify_account=None):
    data = _client(current_user_id, spotify_account).get_queue()
    if not data:
        return jsonify({'queue': [], 'currently_playing': None})

    def fmt(item):
        if not item:
            return None
        images = item.get('album', {}).get('images', [])
        return {
            'id':          item.get('id'),
            'name':        item.get('name'),
            'duration_ms': item.get('duration_ms', 0),
            'artists':     [a['name'] for a in item.get('artists', [])],
            'album_image': images[-1]['url'] if images else None,
            'spotify_url': item.get('external_urls', {}).get('spotify', ''),
            'uri':         item.get('uri', ''),
        }

    return jsonify({
        'currently_playing': fmt(data.get('currently_playing')),
        'queue': [fmt(t) for t in (data.get('queue') or [])[:20] if t],
    })


@player_bp.route('/pause', methods=['POST'])
@spotify_required
def pause(current_user_id=None, spotify_account=None):
    ok = _client(current_user_id, spotify_account).player_pause()
    return jsonify({'ok': ok})


@player_bp.route('/play', methods=['POST'])
@spotify_required
def play(current_user_id=None, spotify_account=None):
    data = request.get_json(force=True) or {}
    ok = _client(current_user_id, spotify_account).player_play(
        context_uri=data.get('context_uri'),
        uris=data.get('uris'),
        offset=data.get('offset'),
    )
    return jsonify({'ok': ok})


@player_bp.route('/next', methods=['POST'])
@spotify_required
def skip_next(current_user_id=None, spotify_account=None):
    ok = _client(current_user_id, spotify_account).player_next()
    return jsonify({'ok': ok})


@player_bp.route('/prev', methods=['POST'])
@spotify_required
def skip_prev(current_user_id=None, spotify_account=None):
    ok = _client(current_user_id, spotify_account).player_prev()
    return jsonify({'ok': ok})


@player_bp.route('/seek', methods=['POST'])
@spotify_required
def seek(current_user_id=None, spotify_account=None):
    data = request.get_json(force=True) or {}
    ok   = _client(current_user_id, spotify_account).player_seek(int(data.get('position_ms', 0)))
    return jsonify({'ok': ok})


@player_bp.route('/volume', methods=['POST'])
@spotify_required
def volume(current_user_id=None, spotify_account=None):
    data = request.get_json(force=True) or {}
    ok   = _client(current_user_id, spotify_account).player_volume(int(data.get('volume_percent', 50)))
    return jsonify({'ok': ok})


@player_bp.route('/shuffle', methods=['POST'])
@spotify_required
def shuffle(current_user_id=None, spotify_account=None):
    data = request.get_json(force=True) or {}
    ok   = _client(current_user_id, spotify_account).player_shuffle(bool(data.get('state', False)))
    return jsonify({'ok': ok})


@player_bp.route('/repeat', methods=['POST'])
@spotify_required
def repeat(current_user_id=None, spotify_account=None):
    data = request.get_json(force=True) or {}
    ok   = _client(current_user_id, spotify_account).player_repeat(data.get('state', 'off'))
    return jsonify({'ok': ok})
