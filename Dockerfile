FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
COPY package*.json ./
# Install production packages
RUN npm ci --only=production
# Install prisma globally so that programmatic migrations can run via child_process
RUN npm install -g prisma@5.22.0
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/prisma ./prisma

EXPOSE 3001
CMD ["node", "dist/index.js"]
