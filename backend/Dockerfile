FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
# postgresql16-client provides pg_dump, used by the nightly backup job —
# version pinned to match the postgres:16-alpine service in docker-compose.
RUN apk add --no-cache postgresql16-client
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
RUN mkdir -p /app/uploads /app/backups
EXPOSE 3001
CMD ["node", "dist/index.js"]
