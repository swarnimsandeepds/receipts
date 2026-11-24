#!/bin/sh
# Rebuild the static UI bundle that python/app.py serves (python/static).
# Next.js static export cannot include API routes, so they are moved aside during the build.
set -e
cd "$(dirname "$0")/.."
TMP=$(mktemp -d)
restore() { [ -d "$TMP/api" ] && mv "$TMP/api" app/api; [ -d "$TMP/mock-source" ] && mv "$TMP/mock-source" app/mock-source; rm -rf "$TMP"; }
trap restore EXIT
mv app/api "$TMP/api"
mv app/mock-source "$TMP/mock-source"
NEXT_STATIC_EXPORT=1 npx next build
rm -rf python/static
mv out python/static
echo "Static UI written to python/static"
