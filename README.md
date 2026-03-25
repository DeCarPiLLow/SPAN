# 🎵 Spotify Analyzer

A production-ready SaaS analytics platform built on the Spotify Web API.

## Quick Start (5 steps)

### 1. Create a Spotify App
1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
2. Click **Create App**
3. Set **Redirect URI** to `http://localhost/callback`
4. Copy your **Client ID**

### 2. Configure Environment
```bash
cp .env.example .env
```

Edit `.env` and fill in:
- `SPOTIFY_CLIENT_ID` — from your Spotify app dashboard
- `SPOTIFY_REDIRECT_URI` — `http://localhost/callback` (must match Spotify app)
- `TOKEN_ENCRYPTION_KEY` — generate with:
  ```bash
  python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
  ```
- `JWT_SECRET_KEY` — generate with:
  ```bash
  python3 -c "import secrets; print(secrets.token_hex(32))"
  ```
- `POSTGRES_PASSWORD` — any strong password

### 3. Start Everything
```bash
docker compose up --build
```

First boot takes ~2 minutes (installs dependencies, runs migrations).

### 4. Open the App
Visit [http://localhost](http://localhost) and click **Connect with Spotify**.

### 5. Sync Your Data
After login, click **Sync Data** in the sidebar. This fetches:
- Recently played tracks (50)
- Top tracks (50 per time range)
- Audio features for all tracks

---

## Architecture

```
Browser → Nginx → Flask API (Gunicorn)
                → PostgreSQL 16
                → Redis 7
                → Celery Workers (background tasks)
```

## Features

### Personal Analytics
| Feature | Path | Description |
|---------|------|-------------|
| Listening Clock | `/app/listening-clock` | 24-hour heatmap of activity |
| Mood Radar | `/app/mood-radar` | Energy, valence, danceability radar |
| Genre Evolution | `/app/genre-evolution` | Monthly genre distribution timeline |
| Discovery Ratio | `/app/discovery` | New finds vs. repeat listens |
| AI Persona | `/app/persona` | Rule-based listener archetype |
| Top Tracks | `/app/top-tracks` | Top 50 tracks & artists by time range |
| Decade Breakdown | `/app/decade` | Listening by release decade |
| BPM Evolution | `/app/bpm` | Tempo trends over time |

### Global Analytics
| Feature | Path | Description |
|---------|------|-------------|
| Mood Meter | `/app/global-mood` | Global Top 50 avg mood + your delta |
| Artist Velocity | `/app/artist-velocity` | Fastest-growing by followers (weekly) |
| Shelf Life | `/app/shelf-life` | Avg days songs stay in Top 50 |

### Comparisons
| Feature | Path | Description |
|---------|------|-------------|
| Mainstream Score | `/app/mainstream` | Your overlap with Global Top 100 |
| Taste Twin | `/app/taste-twin` | Country most similar to your taste |
| Mood Delta | `/app/mood-delta` | Your mood vs. global mood |

### Engagement
| Feature | Path | Description |
|---------|------|-------------|
| My Receipt | `/app/receipt` | Shareable PNG summary (Instagram-ready) |
| Compatibility | `/app/compatibility` | Music compatibility with another user |

---

## Global Data Population

Global charts (Mood Meter, Taste Twin, Shelf Life, Artist Velocity) require background data:

```bash
# Trigger manually (one-off):
docker compose exec celery-worker celery -A celery_worker.celery call app.tasks.snapshot_tasks.take_global_snapshot_all

# Or wait for the automatic daily schedule (runs at 3am UTC)
```

---

## Development (without Docker)

```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
# Set env vars or create .env in backend/
flask db upgrade
flask run --port 5000

# Frontend
cd frontend
npm install
npm run dev   # http://localhost:5173
```

Set `VITE_API_BASE_URL=http://localhost:5000/api` in `frontend/.env.local`.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, React Router 6, Recharts, TailwindCSS, Axios, Zustand |
| Backend | Python 3.12, Flask 3, Flask-JWT-Extended, Flask-CORS, Flask-Limiter |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| ORM | SQLAlchemy 2.0 + Flask-Migrate (Alembic) |
| Queue | Celery 5 |
| Auth | Spotify OAuth 2.0 PKCE |
| Image gen | Pillow |
| Similarity | NumPy cosine similarity |
| DevOps | Docker, Docker Compose, Nginx |

