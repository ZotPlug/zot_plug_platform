FROM node:20-slim AS builder

WORKDIR /broker

# Copy package files first
COPY package*.json ./

# Install to the build stage
RUN npm install --omit=dev
RUN npm install tsx

# Copy source code into container
COPY . .

# Expose container port
EXPOSE 1883

CMD ["npx", "tsx", "server.ts"]

