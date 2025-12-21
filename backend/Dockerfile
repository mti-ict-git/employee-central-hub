FROM node:18-alpine AS build
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json* ./
RUN npm ci --no-audit --no-fund
COPY backend/ ./
RUN npm run build

FROM node:18-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app/backend

COPY --from=build /app/backend/node_modules ./node_modules
COPY --from=build /app/backend/dist ./dist

EXPOSE 8083
CMD ["node", "dist/src/server.js"]
