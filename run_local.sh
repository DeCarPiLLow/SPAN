#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Spotify Analyzer — Start local dev servers
# Usage: bash run_local.sh [--with-celery]
# ─────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WITH_CELERY=false
[[ "$*" == *"--with-celery"* ]] && WITH_CELERY=true

echo "Starting Spotify Analyzer (local)..."

# ── Backend ──────────────────────────────────────────────────────────────────
(
  cd "$SCRIPT_DIR/backend"
  source venv/bin/activate
  export FLASK_APP=wsgi.py
  export FLASK_ENV=development
  echo "[Backend] Starting Flask on :5000"
  flask run --port 5000 --host 0.0.0.0
) &
BACKEND_PID=$!

# ── Celery worker (optional) ─────────────────────────────────────────────────
if [ "$WITH_CELERY" = true ]; then
  (
    cd "$SCRIPT_DIR/backend"
    source venv/bin/activate
    echo "[Celery] Starting worker..."
    celery -A celery_worker.celery worker --loglevel=info --concurrency=2
  ) &
  CELERY_PID=$!
fi

# ── Frontend ──────────────────────────────────────────────────────────────────
(
  cd "$SCRIPT_DIR/frontend"
  echo "[Frontend] Starting Vite on :5173"
  npm run dev
) &
FRONTEND_PID=$!

echo ""
echo "  Backend:   http://localhost:5000/api/health"
echo "  Frontend:  http://localhost:5173"
echo ""
echo "  Press Ctrl+C to stop all servers"
echo ""

# Clean shutdown
trap "echo 'Stopping...'; kill $BACKEND_PID $FRONTEND_PID ${CELERY_PID:-} 2>/dev/null; exit 0" INT TERM

wait
