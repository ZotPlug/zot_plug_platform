FROM node:20-slim AS builder

# Set root of project in container
WORKDIR /rest_api

# Copy package files into /rest_api/
COPY rest_api/package*.json ./

# Install dependencies once, for both src and pg_db
RUN npm install --omit=dev
RUN npm install tsx
RUN npm install pg

# Copy src code into /rest_api/src
COPY rest_api/ ./src/

# Copy pg_db into /rest_api/pg_db
COPY pg_db ./pg_db/

# Start from /rest_api/src
WORKDIR /rest_api/src
EXPOSE 3000
CMD ["npx", "tsx", "server.ts"]

