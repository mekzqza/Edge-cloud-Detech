# ── build React → ได้โฟลเดอร์ dist ──
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# ── เสิร์ฟด้วย Caddy (ทำ HTTPS / Let's Encrypt อัตโนมัติ) ──
FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /usr/share/caddy
