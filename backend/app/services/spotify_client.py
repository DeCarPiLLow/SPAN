import requests
from flask import current_app
from app.extensions import redis_client
from app.services.token_service import decrypt_token, encrypt_token

SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token'
SPOTIFY_API_BASE  = 'https://api.spotify.com/v1'


class SpotifyClient:
    def __init__(self, user_id=None, spotify_account=None):
        self.user_id         = str(user_id) if user_id else None
        self.spotify_account = spotify_account

    def exchange_code(self, code: str, verifier: str) -> dict:
        r = requests.post(SPOTIFY_TOKEN_URL, data={
            'grant_type':    'authorization_code',
            'code':          code,
            'redirect_uri':  current_app.config['SPOTIFY_REDIRECT_URI'],
            'client_id':     current_app.config['SPOTIFY_CLIENT_ID'],
            'code_verifier': verifier,
        }, timeout=10)
        r.raise_for_status()
        return r.json()

    def _get_access_token(self) -> str:
        if self.user_id:
            cached = redis_client.get(f"spotify:access:{self.user_id}")
            if cached:
                return cached

        if not self.spotify_account:
            raise ValueError("No spotify account available for token refresh")

        refresh_token = decrypt_token(self.spotify_account.encrypted_refresh_token)
        r = requests.post(SPOTIFY_TOKEN_URL, data={
            'grant_type':    'refresh_token',
            'refresh_token': refresh_token,
            'client_id':     current_app.config['SPOTIFY_CLIENT_ID'],
        }, timeout=10)
        r.raise_for_status()
        data = r.json()

        ttl = data.get('expires_in', 3600) - 60
        if self.user_id:
            redis_client.setex(f"spotify:access:{self.user_id}", ttl, data['access_token'])

        if 'refresh_token' in data:
            self.spotify_account.encrypted_refresh_token = encrypt_token(data['refresh_token'])
            from app.extensions import db
            db.session.commit()

        return data['access_token']

    def _get(self, path: str, params: dict = None) -> dict:
        token = self._get_access_token()
        r = requests.get(
            f"{SPOTIFY_API_BASE}{path}",
            headers={'Authorization': f'Bearer {token}'},
            params=params,
            timeout=10,
        )
        if r.status_code == 204:
            return {}
        r.raise_for_status()
        return r.json()

    def _get_client_credentials_token(self) -> str | None:
        """
        Optional fallback for endpoints that return 403 with user-scoped tokens.
        Requires `SPOTIFY_CLIENT_SECRET` to be set.
        """
        client_secret = current_app.config.get('SPOTIFY_CLIENT_SECRET') or ''
        client_id = current_app.config.get('SPOTIFY_CLIENT_ID') or ''
        if not client_id or not client_secret:
            return None

        cached = redis_client.get("spotify:client_access")
        if cached:
            return cached

        r = requests.post(
            SPOTIFY_TOKEN_URL,
            data={'grant_type': 'client_credentials'},
            auth=(client_id, client_secret),
            timeout=10,
        )
        r.raise_for_status()
        payload = r.json()
        ttl = payload.get('expires_in', 3600) - 60
        token = payload['access_token']
        redis_client.setex("spotify:client_access", max(ttl, 60), token)
        return token

    def _get_audio_features_with_token(self, ids: list, token: str) -> list:
        """Fetch audio features for Spotify IDs using a specific token."""
        if not ids:
            return []
        r = requests.get(
            f"{SPOTIFY_API_BASE}/audio-features",
            headers={'Authorization': f'Bearer {token}'},
            params={'ids': ','.join(ids)},
            timeout=10,
        )
        if r.status_code == 204:
            return []
        r.raise_for_status()
        data = r.json()
        return data.get('audio_features') or []

    def _put(self, path: str, json: dict = None, params: dict = None) -> int:
        token = self._get_access_token()
        r = requests.put(
            f"{SPOTIFY_API_BASE}{path}",
            headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'},
            json=json or {},
            params=params,
            timeout=10,
        )
        return r.status_code

    def _post(self, path: str, json: dict = None, params: dict = None) -> int:
        token = self._get_access_token()
        r = requests.post(
            f"{SPOTIFY_API_BASE}{path}",
            headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'},
            json=json or {},
            params=params,
            timeout=10,
        )
        return r.status_code

    # ── Profile ──────────────────────────────────────────────────────────────
    def get_profile(self, token: str = None) -> dict:
        if token:
            r = requests.get(f"{SPOTIFY_API_BASE}/me",
                             headers={'Authorization': f'Bearer {token}'}, timeout=10)
            r.raise_for_status()
            return r.json()
        return self._get('/me')

    # ── Listening data ────────────────────────────────────────────────────────
    def get_top_tracks(self, time_range='medium_term', limit=50) -> dict:
        return self._get('/me/top/tracks', {'time_range': time_range, 'limit': limit})

    def get_top_artists(self, time_range='medium_term', limit=50) -> dict:
        return self._get('/me/top/artists', {'time_range': time_range, 'limit': limit})

    def get_recently_played(self, limit=50, after=None) -> dict:
        params = {'limit': limit}
        if after:
            params['after'] = after
        return self._get('/me/player/recently-played', params)

    def get_audio_features_batch(self, track_ids: list) -> list:
        results = []
        # Spotify allows up to 100 IDs, but smaller batches reduce error risk.
        for i in range(0, len(track_ids), 50):
            batch = track_ids[i:i+50]
            try:
                data = self._get('/audio-features', {'ids': ','.join(batch)})
                results.extend(data.get('audio_features') or [])
            except requests.exceptions.HTTPError as exc:
                status_code = exc.response.status_code if exc.response is not None else None
                current_app.logger.warning(
                    f"Spotify /audio-features batch failed status={status_code} batch_size={len(batch)} err={str(exc)[:200]}"
                )
                # If the user token is forbidden for audio-features, try app-token.
                if status_code == 403:
                    app_token = self._get_client_credentials_token()
                    if app_token:
                        try:
                            results.extend(self._get_audio_features_with_token(batch, app_token))
                            continue
                        except Exception as e2:
                            current_app.logger.warning(
                                f"Spotify /audio-features batch app-token fallback failed err={str(e2)[:200]}"
                            )
                    else:
                        current_app.logger.warning(
                            "Spotify /audio-features 403; app-token fallback skipped (missing SPOTIFY_CLIENT_SECRET)."
                        )
                # Fallback: try per-track. This helps if only some IDs fail or if
                # Spotify rejects the batch request.
                for tid in batch:
                    try:
                        # Use the single-track endpoint as a fallback.
                        d = self._get(f'/audio-features/{tid}')
                        results.append(d)
                    except Exception as e2:
                        # If app-token is available, try it for 403s.
                        sc = getattr(getattr(e2, "response", None), "status_code", None)
                        if sc == 403:
                            app_token = self._get_client_credentials_token()
                            if app_token:
                                try:
                                    feats = self._get_audio_features_with_token([tid], app_token)
                                    results.extend(feats)
                                    continue
                                except Exception:
                                    pass
                            else:
                                current_app.logger.warning(
                                    "Spotify /audio-features single-track 403; app-token fallback skipped (missing SPOTIFY_CLIENT_SECRET)."
                                )
                        current_app.logger.warning(
                            f"Spotify /audio-features/{tid} fallback failed err={str(e2)[:200]}"
                        )
                        continue
                continue
            except Exception as exc:
                current_app.logger.warning(
                    f"Spotify /audio-features batch unexpected failure batch_size={len(batch)} err={str(exc)[:200]}"
                )
                continue
        return results

    def get_playlist(self, playlist_id: str) -> dict:
        return self._get(f'/playlists/{playlist_id}')

    def get_playlist_tracks(self, playlist_id: str) -> list:
        tracks, offset = [], 0
        while True:
            page = self._get(f'/playlists/{playlist_id}/tracks',
                             {'offset': offset, 'limit': 100,
                              'fields': 'next,items(track(id,name,artists,album,duration_ms,popularity))'})
            tracks.extend(page.get('items', []))
            if not page.get('next'):
                break
            offset += 100
        return tracks

    def get_artists_batch(self, artist_ids: list) -> list:
        results = []
        for i in range(0, len(artist_ids), 50):
            batch = artist_ids[i:i+50]
            try:
                data = self._get('/artists', {'ids': ','.join(batch)})
                results.extend(data.get('artists') or [])
            except Exception:
                pass
        return results

    def search(self, query: str, search_type='track', limit=20) -> dict:
        return self._get('/search', {'q': query, 'type': search_type, 'limit': limit})

    # ── Player / Now Playing ──────────────────────────────────────────────────
    def get_currently_playing(self) -> dict:
        """Returns current playback state including track, progress, device."""
        try:
            return self._get('/me/player', {'additional_types': 'track,episode'})
        except Exception:
            return {}

    def get_queue(self) -> dict:
        """Returns the player queue."""
        try:
            return self._get('/me/player/queue')
        except Exception:
            return {}

    def player_play(self, device_id: str = None) -> int:
        params = {'device_id': device_id} if device_id else None
        return self._put('/me/player/play', params=params)

    def player_pause(self, device_id: str = None) -> int:
        params = {'device_id': device_id} if device_id else None
        return self._put('/me/player/pause', params=params)

    def player_next(self, device_id: str = None) -> int:
        params = {'device_id': device_id} if device_id else None
        return self._post('/me/player/next', params=params)

    def player_previous(self, device_id: str = None) -> int:
        params = {'device_id': device_id} if device_id else None
        return self._post('/me/player/previous', params=params)

    def player_seek(self, position_ms: int, device_id: str = None) -> int:
        params = {'position_ms': position_ms}
        if device_id:
            params['device_id'] = device_id
        return self._put('/me/player/seek', params=params)

    def player_volume(self, volume_percent: int, device_id: str = None) -> int:
        params = {'volume_percent': max(0, min(100, volume_percent))}
        if device_id:
            params['device_id'] = device_id
        return self._put('/me/player/volume', params=params)

    def player_shuffle(self, state: bool, device_id: str = None) -> int:
        params = {'state': 'true' if state else 'false'}
        if device_id:
            params['device_id'] = device_id
        return self._put('/me/player/shuffle', params=params)

    def player_repeat(self, state: str, device_id: str = None) -> int:
        """state: 'track' | 'context' | 'off'"""
        params = {'state': state}
        if device_id:
            params['device_id'] = device_id
        return self._put('/me/player/repeat', params=params)


    def player_pause(self) -> bool:
        try:
            token = self._get_access_token()
            import requests as req
            r = req.put(f"{SPOTIFY_API_BASE}/me/player/pause",
                        headers={'Authorization': f'Bearer {token}'}, timeout=10)
            return r.status_code in (200, 204)
        except Exception:
            return False

    def player_play(self, context_uri=None, uris=None, offset=None) -> bool:
        try:
            token   = self._get_access_token()
            import requests as req
            body = {}
            if context_uri: body['context_uri'] = context_uri
            if uris:        body['uris'] = uris
            if offset:      body['offset'] = offset
            r = req.put(f"{SPOTIFY_API_BASE}/me/player/play",
                        headers={'Authorization': f'Bearer {token}',
                                 'Content-Type': 'application/json'},
                        json=body, timeout=10)
            return r.status_code in (200, 204)
        except Exception:
            return False

    def player_next(self) -> bool:
        try:
            token = self._get_access_token()
            import requests as req
            r = req.post(f"{SPOTIFY_API_BASE}/me/player/next",
                         headers={'Authorization': f'Bearer {token}'}, timeout=10)
            return r.status_code in (200, 204)
        except Exception:
            return False

    def player_prev(self) -> bool:
        try:
            token = self._get_access_token()
            import requests as req
            r = req.post(f"{SPOTIFY_API_BASE}/me/player/previous",
                         headers={'Authorization': f'Bearer {token}'}, timeout=10)
            return r.status_code in (200, 204)
        except Exception:
            return False

    def player_seek(self, position_ms: int) -> bool:
        try:
            token = self._get_access_token()
            import requests as req
            r = req.put(f"{SPOTIFY_API_BASE}/me/player/seek",
                        headers={'Authorization': f'Bearer {token}'},
                        params={'position_ms': position_ms}, timeout=10)
            return r.status_code in (200, 204)
        except Exception:
            return False

    def player_volume(self, volume_percent: int) -> bool:
        try:
            token = self._get_access_token()
            import requests as req
            r = req.put(f"{SPOTIFY_API_BASE}/me/player/volume",
                        headers={'Authorization': f'Bearer {token}'},
                        params={'volume_percent': max(0, min(100, volume_percent))}, timeout=10)
            return r.status_code in (200, 204)
        except Exception:
            return False

    def player_shuffle(self, state: bool) -> bool:
        try:
            token = self._get_access_token()
            import requests as req
            r = req.put(f"{SPOTIFY_API_BASE}/me/player/shuffle",
                        headers={'Authorization': f'Bearer {token}'},
                        params={'state': 'true' if state else 'false'}, timeout=10)
            return r.status_code in (200, 204)
        except Exception:
            return False

    def player_repeat(self, state: str) -> bool:
        """state: 'off' | 'track' | 'context'"""
        try:
            token = self._get_access_token()
            import requests as req
            r = req.put(f"{SPOTIFY_API_BASE}/me/player/repeat",
                        headers={'Authorization': f'Bearer {token}'},
                        params={'state': state}, timeout=10)
            return r.status_code in (200, 204)
        except Exception:
            return False
