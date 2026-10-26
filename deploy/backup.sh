#!/bin/sh
# Daily compressed pg_dump of the Geram database with 7-day rotation and an
# automatic restore test into a throwaway database. Run from root's crontab.
set -eu
DIR=${GERAM_BACKUP_DIR:-/opt/geram/backups/daily}
KEEP=${GERAM_BACKUP_KEEP:-7}
DB=${GERAM_DB_CONTAINER:-supabase-db}
mkdir -p "$DIR"; chmod 700 "$DIR"
STAMP=$(date -u +%Y%m%d-%H%M%S)
OUT="$DIR/geram-$STAMP.dump"
# -Fc is compressed custom format; auth + public + storage schemas are all in "postgres".
docker exec "$DB" pg_dump -U postgres -d postgres -Fc -Z 6 > "$OUT.tmp"
mv "$OUT.tmp" "$OUT"; chmod 600 "$OUT"
# Restore test: load into a temp DB and compare a few row counts.
T=restore_check_$$
docker exec "$DB" psql -U postgres -q -c "drop database if exists $T" -c "create database $T"
docker exec -i "$DB" pg_restore -U postgres -d "$T" --no-owner --no-privileges < "$OUT" >/dev/null 2>&1 || true
SRC=$(docker exec "$DB" psql -U postgres -d postgres -At -c "select (select count(*) from public.core_journal_lines)||'/'||(select count(*) from public.profiles)||'/'||(select count(*) from auth.users)")
DST=$(docker exec "$DB" psql -U postgres -d "$T" -At -c "select (select count(*) from public.core_journal_lines)||'/'||(select count(*) from public.profiles)||'/'||(select count(*) from auth.users)" 2>/dev/null || echo fail)
docker exec "$DB" psql -U postgres -q -c "drop database if exists $T"
SIZE=$(du -h "$OUT" | cut -f1)
if [ "$SRC" = "$DST" ]; then
  echo "$(date -u +%FT%TZ) OK $OUT $SIZE restore=$DST"
else
  echo "$(date -u +%FT%TZ) RESTORE_MISMATCH $OUT src=$SRC dst=$DST"; exit 1
fi
# Rotation: keep the newest $KEEP dumps.
ls -1t "$DIR"/geram-*.dump | tail -n +$((KEEP + 1)) | xargs -r rm -f
