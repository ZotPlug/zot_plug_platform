FROM nginx:mainline

COPY default.conf.template /etc/nginx/templates/default.conf.template
COPY ./watch_renew.sh /watch_renew.sh
RUN chmod +x /watch_renew.sh

ENTRYPOINT ["/bin/sh", "-c", "/watch_renew.sh & exec nginx -g 'daemon off;'"]


