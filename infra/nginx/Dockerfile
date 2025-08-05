FROM nginx:mainline

COPY default.conf.template /etc/nginx/templates/default.conf.template
COPY watch_renew.sh /watch_renew.sh
COPY custom-entry.sh /custom-entry.sh
RUN chmod +x /watch_renew.sh /custom-entry.sh

ENTRYPOINT ["/custom-entry.sh"]
CMD ["nginx", "-g", "daemon off;"]




