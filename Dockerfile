FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=5173
ENV BUSINESS_DB_FILE=/data/business-db.json
ENV BUSINESS_DB_BACKUP_DIR=/data/backups
ENV BUSINESS_DB_BACKUPS=true

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
RUN mkdir -p /data/backups

EXPOSE 5173

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 5173) + '/api/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["npm", "run", "start:prod"]
