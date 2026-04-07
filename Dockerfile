# Step 1: Build Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
# We don't need a specific API URL because the backend will serve the frontend from the same origin
ENV VITE_API_URL="/api"
RUN npm run build

# Step 2: Build Backend
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --omit=dev
COPY backend/ ./

# Step 3: Final Production Image
FROM node:20-alpine
WORKDIR /app

# Copy Backend
COPY --from=backend-builder /app/backend /app

# Copy Built Frontend into Backend's public directory
COPY --from=frontend-builder /app/frontend/dist /app/public

# Expose backend port
EXPOSE 4000

# Start server
CMD ["node", "src/server.js"]
