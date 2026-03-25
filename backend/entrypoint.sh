#!/bin/sh
set -e

echo "Waiting for PostgreSQL..."
until python -c "
import os, psycopg2
psycopg2.connect(os.environ['DATABASE_URL'])
" 2>/dev/null; do
  sleep 1
done
echo "PostgreSQL ready."

# Only run flask db init if migrations/env.py does NOT exist
if [ ! -f migrations/env.py ]; then
  echo "Running flask db init..."
  flask db init
fi

# Always generate a new migration if needed, suppress "nothing to migrate" gracefully
echo "Running flask db migrate..."
flask db migrate -m "auto" 2>&1 | grep -v "^$" || true

echo "Running flask db upgrade..."
flask db upgrade

echo "Starting: $@"
exec "$@"