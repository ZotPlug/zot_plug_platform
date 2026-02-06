FROM alpine:latest

RUN apk add --no-cache bash curl postgresql-client cronie
RUN apk add --no-cache docker-cli

RUN apk add --no-cache \
    bash \
    curl \
    postgresql-client \
    cronie \
    docker-cli \
    nodejs \
    npm

WORKDIR /cron

COPY ./pg_db/package*.json ./
RUN rm -rf node_modules
RUN npm ci --omit=dev
RUN npm install tsx

# Copy backup script and crontab into container
COPY pg_db/ ./pg_db
COPY ./cron/aggregateDailyEnergy.ts ./aggregateDailyEnergy.ts
COPY ./cron/backup.sh ./backup.sh
COPY ./cron/crontab /etc/crontabs/root


# Give root perms to run docker exec command
RUN chmod 600 /etc/crontabs/root

# Turn script into exec
RUN chmod +x /cron/backup.sh

CMD ["crond", "-f", "-x", "misc"]
