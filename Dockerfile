FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci --include=dev

# Copy source
COPY . .

# Build React frontend
RUN npm run build

# Remove dev dependencies after build
RUN npm prune --production

EXPOSE 3001

CMD ["node", "server.js"]
