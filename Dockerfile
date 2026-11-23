# FxTwitter Archive Studio - Container Image
# Created by Hikaproj

FROM node:22-alpine

LABEL org.opencontainers.image.title="FxTwitter Archive Studio" \
      org.opencontainers.image.description="Ultra-fast Twitter/X post and media archive studio" \
      org.opencontainers.image.authors="Hikaproj"

WORKDIR /app

# Install production dependencies
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

# Copy application source code
COPY . .

# Set environment
ENV NODE_ENV=production \
    PORT=3000

# Output mount volume
VOLUME ["/app/output"]

EXPOSE 3000

# Start server
CMD ["npm", "start"]
