#!/bin/sh

# Run your renew watcher in background
/watch_renew.sh &

# Pass through to the official entrypoint logic
exec /docker-entrypoint.sh "$@"

