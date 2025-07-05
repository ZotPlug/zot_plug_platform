FROM node:20-slim AS builder 

WORKDIR /rest_api

# Copy package files first
COPY package*.json ./

#Install to build stage
RUN npm install --omit=dev
RUN npm install tsx

# Copy source code into container
COPY . .

#Expose container port 3000
EXPOSE 3000

CMD ["npx", "tsx", "server.ts"]
