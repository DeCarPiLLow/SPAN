#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Spotify Analyzer — Local Development Setup
# Run once: bash setup_local.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC}   $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERR]${NC}  $*"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   Spotify Analyzer — Local Setup         ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
echo ""

# ── 1. Check prerequisites ──────────────────────────────────────────────────
info "Checking prerequisites..."

command -v python3 >/dev/null 2>&1 || error "python3 not found. Install Python 3.10+."
command -v node    >/dev/null 2>&1 || error "node not found. Install Node.js 18+."
command -v npm     >/dev/null 2>&1 || error "npm not found."
command -v psql    >/dev/null 2>&1 || error "psql not found. Install PostgreSQL 14+."
command -v redis-cli >/dev/null 2>&1 || warn "redis-cli not found. Install Redis 6+ and ensure it's running."

PYTHON_VER=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
info "Python $PYTHON_VER detected"

success "Prerequisites OK"

# ── 2. Check .env ────────────────────────────────────────────────────────────
info "Checking backend/.env..."
ENV_FILE="$BACKEND_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
  error "backend/.env not found. It should already exist — check the project root."
fi

CLIENT_ID=$(grep "^SPOTIFY_CLIENT_ID=" "$ENV_FILE" | cut -d= -f2)
if [ "$CLIENT_ID" = "your_spotify_client_id_here" ] || [ -z "$CLIENT_ID" ]; then
  echo ""
  warn "SPOTIFY_CLIENT_ID is not set in backend/.env"
  echo ""
  echo "  Steps:"
  echo "  1. Go to https://developer.spotify.com/dashboard → Create App"
  echo "  2. Add Redirect URI:  http://localhost:5173/callback"
  echo "  3. Edit backend/.env and set:"
  echo "     SPOTIFY_CLIENT_ID=<your client id>"
  echo ""
  read -p "  Press Enter after updating .env to continue, or Ctrl+C to abort... "
fi

TOKEN_KEY=$(grep "^TOKEN_ENCRYPTION_KEY=" "$ENV_FILE" | cut -d= -f2)
if [ "$TOKEN_KEY" = "your_fernet_key_here" ] || [ -z "$TOKEN_KEY" ]; then
  info "TOKEN_ENCRYPTION_KEY not set — generating one..."
  NEW_KEY=$(python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())" 2>/dev/null || echo "")
  if [ -n "$NEW_KEY" ]; then
    # Try sed in-place (works on both Linux and macOS)
    sed -i.bak "s|TOKEN_ENCRYPTION_KEY=.*|TOKEN_ENCRYPTION_KEY=$NEW_KEY|" "$ENV_FILE" && rm -f "$ENV_FILE.bak"
    success "TOKEN_ENCRYPTION_KEY auto-generated and saved to backend/.env"
  else
    warn "Could not auto-generate — install cryptography first, then re-run."
  fi
fi

JWT_KEY=$(grep "^JWT_SECRET_KEY=" "$ENV_FILE" | cut -d= -f2)
if [ "$JWT_KEY" = "your_jwt_secret_here" ] || [ -z "$JWT_KEY" ]; then
  info "JWT_SECRET_KEY not set — generating one..."
  NEW_JWT=$(python3 -c "import secrets; print(secrets.token_hex(32))")
  sed -i.bak "s|JWT_SECRET_KEY=.*|JWT_SECRET_KEY=$NEW_JWT|" "$ENV_FILE" && rm -f "$ENV_FILE.bak"
  success "JWT_SECRET_KEY auto-generated and saved to backend/.env"
fi

success ".env looks good"

# ── 3. PostgreSQL ────────────────────────────────────────────────────────────
info "Setting up PostgreSQL database..."

DB_NAME="spotify_analyzer"
DB_USER="spotifyuser"
DB_PASS="spotifypass"

# Check if postgres is running
pg_isready -q 2>/dev/null || warn "PostgreSQL may not be running. Start it before continuing."

# Create user if not exists
psql -U postgres -tc "SELECT 1 FROM pg_user WHERE usename='$DB_USER'" 2>/dev/null | grep -q 1 || \
  psql -U postgres -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" 2>/dev/null && \
  success "DB user '$DB_USER' ready" || warn "Could not create DB user (may already exist or need sudo)"

# Create database if not exists
psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" 2>/dev/null | grep -q 1 || \
  psql -U postgres -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null && \
  success "Database '$DB_NAME' ready" || warn "Could not create database (may already exist)"

# Grant privileges
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>/dev/null || true

success "PostgreSQL setup done"

# ── 4. Python venv ───────────────────────────────────────────────────────────
info "Creating Python virtual environment..."

cd "$BACKEND_DIR"

if [ ! -d "venv" ]; then
  python3 -m venv venv
  success "venv created"
else
  success "venv already exists"
fi

# Activate
source venv/bin/activate

info "Installing Python dependencies..."
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt
success "Python packages installed"

# ── 5. Flask-Migrate ─────────────────────────────────────────────────────────
info "Running database migrations..."

export FLASK_APP=wsgi.py
export FLASK_ENV=development

# Init migrations if first time
if [ ! -f "migrations/env.py" ]; then
  info "Initialising Flask-Migrate (first time)..."
  flask db init
  flask db migrate -m "initial schema"
fi

flask db upgrade
success "Database migrations applied"

# ── 6. Frontend ──────────────────────────────────────────────────────────────
info "Installing frontend dependencies..."
cd "$FRONTEND_DIR"
npm install --silent
success "npm packages installed"

deactivate 2>/dev/null || true

# ── 7. Done ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Setup complete! Run the app with:                           ║${NC}"
echo -e "${GREEN}║                                                              ║${NC}"
echo -e "${GREEN}║  Terminal 1 (Backend):                                       ║${NC}"
echo -e "${GREEN}║    cd backend && source venv/bin/activate                    ║${NC}"
echo -e "${GREEN}║    flask run --port 5000                                     ║${NC}"
echo -e "${GREEN}║                                                              ║${NC}"
echo -e "${GREEN}║  Terminal 2 (Frontend):                                      ║${NC}"
echo -e "${GREEN}║    cd frontend && npm run dev                                ║${NC}"
echo -e "${GREEN}║                                                              ║${NC}"
echo -e "${GREEN}║  (Optional) Terminal 3 (Celery worker):                     ║${NC}"
echo -e "${GREEN}║    cd backend && source venv/bin/activate                   ║${NC}"
echo -e "${GREEN}║    celery -A celery_worker.celery worker --loglevel=info    ║${NC}"
echo -e "${GREEN}║                                                              ║${NC}"
echo -e "${GREEN}║  Open: http://localhost:5173                                 ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
