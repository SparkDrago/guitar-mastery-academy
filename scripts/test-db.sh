#!/usr/bin/env bash
# Applies the Supabase migration (and optional seed) to a throwaway local
# PostgreSQL database with a minimal Supabase shim, then runs the RLS tests.
# Usage: PGHOST=/tmp/pgsock PGPORT=54329 scripts/test-db.sh
set -euo pipefail
cd "$(dirname "$0")/.."
PSQL="psql -X -q -v ON_ERROR_STOP=1 -U ${PGUSER:-postgres}"
$PSQL -d postgres -c "drop database if exists gma_test" -c "create database gma_test"
$PSQL -d gma_test -f tests/db/supabase-shim.sql
for f in supabase/migrations/*.sql; do $PSQL -d gma_test -f "$f"; done
if [ "${WITH_SEED:-1}" = "1" ] && [ -f supabase/seed.sql ]; then
  $PSQL -d gma_test -f supabase/seed.sql
  $PSQL -d gma_test -c "select (select count(*) from public.lessons) as lessons, (select count(*) from public.questions) as questions, (select count(*) from public.exercises) as exercises"
  $PSQL -d postgres -c "drop database gma_test" -c "create database gma_test"
  $PSQL -d gma_test -f tests/db/supabase-shim.sql
  for f in supabase/migrations/*.sql; do $PSQL -d gma_test -f "$f"; done
fi
$PSQL -d gma_test -f tests/db/rls-test.sql
