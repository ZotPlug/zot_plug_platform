FROM alpine:latest

RUN apk add --no-cache bash curl postgresql-client cronie
RUN apk add --no-cache docker-cli

# Copy backup script and crontab into container
COPY backup.sh /backup.sh
COPY crontab /etc/crontabs/root

# Give root perms to run docker exec command
RUN chmod 600 /etc/crontabs/root

# Turn script into exec
RUN chmod +x /backup.sh

CMD ["crond", "-f", "-x", "misc"]
