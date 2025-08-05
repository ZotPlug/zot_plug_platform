#!/bin/bash

trap exit TERM

while :; do
	sleep 12h & wait $!
	certbot renew --webroot -w /data/letsencrypt \
		--deploy-hook 'touch /data/letsencrypt/RELOAD_NGINX'
done
