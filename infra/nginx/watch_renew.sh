#!/bin/bash

RELOAD_FLAG="/data/letsencrypt/RELOAD_NGINX"

trap exit TERM

echo "[renew-watcher] Starting cert renew watcher"

while :; do
	if [ -f "$RELOAD_FLAG" ]; then
		echo "[renew-watcher] Detected cert change. Reloading Nginx..."
		nginx -s reload
		rm -f "$RELOAD_FLAG"
	fi
	sleep 60
done
