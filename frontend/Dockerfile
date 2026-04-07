# Step 1: Build the React application
FROM node:20-alpine as build-stage

WORKDIR /app

# We define VITE_API_URL dynamically so the container can proxy requests to /api
ENV VITE_API_URL=""

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Step 2: Serve the application using Nginx
FROM nginx:alpine

# Copy the build output to replace the default nginx contents.
COPY --from=build-stage /app/dist /usr/share/nginx/html

# Copy the custom NGINX configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
