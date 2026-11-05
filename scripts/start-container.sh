#!/bin/sh
set -eu

# Render Free has no pre-deploy command. Kysely serializes idempotent migrations.
# Override the container command to run this migration separately on other hosts.
node dist/database/migrator.js
exec node dist/main.js
