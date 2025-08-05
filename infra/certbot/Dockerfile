FROM certbot/certbot

COPY ./renew_script.sh /
RUN chmod +x /renew_script.sh

ENTRYPOINT ["/renew_script.sh"]

