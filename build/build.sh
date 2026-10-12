#!/usr/bin/env bash
# Assemble les pages publiées à partir des sources de build/.
set -e
cd "$(dirname "$0")/.."
SB='<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.1/dist/umd/supabase.js"></script>'
CSP='<meta http-equiv="Content-Security-Policy" content="default-src '"'"'self'"'"'; script-src '"'"'self'"'"' '"'"'unsafe-inline'"'"' https://cdn.jsdelivr.net; style-src '"'"'self'"'"' '"'"'unsafe-inline'"'"' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src '"'"'self'"'"' data: blob:; connect-src '"'"'self'"'"' https://*.supabase.co wss://*.supabase.co; base-uri '"'"'self'"'"'; form-action '"'"'self'"'"'">'
{
  echo '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
  echo "$CSP"
  echo '<meta name="description" content="RYVO : mini-jeux compétitifs, duels et classements entre écoles."><meta name="referrer" content="strict-origin-when-cross-origin">'
  cat build/game/p1.css.html
  echo "$SB"
  echo '<script src="config.js"></script>'
  cat build/game/p2.core.js build/game/p3.views.js build/game/p4.games.js build/game/p5.app.js build/game/p6.live.js
  echo '</html>'
} > index.html
mkdir -p admin
{
  echo '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex,nofollow">'
  echo "$CSP"
  echo '<meta name="referrer" content="no-referrer">'
  cat build/admin/a1.css.html
  echo "$SB"
  echo '<script src="../config.js"></script>'
  cat build/admin/b2.core.js build/admin/b3.live.js build/admin/b4.views.js build/admin/b5.app.js
  echo '</html>'
} > admin/index.html
cat supabase/src/01_schema.sql supabase/src/02_player.sql supabase/src/03_admin.sql supabase/src/04_seed.sql supabase/src/05_grants.sql > supabase/schema.sql
echo "built index.html, admin/index.html, supabase/schema.sql"
