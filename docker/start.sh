#!/bin/sh
set -eu
npm run migration:run:prod
npm run seed:admin:prod
exec node dist/server.js
