#!/bin/sh

trap exit TERM

echo "[auto-cert-renewal] Starting auto-cert-renewal"

while :; do
	sleep 12h & wait $!
	certbot renew --webroot -w /data/letsencrypt --deploy-hook 'touch /data/letsencrypt/RELOAD_NGINX'
done
