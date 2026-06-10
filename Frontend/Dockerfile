# Frontend Dockerfile - Multi-stage build
FROM node:18-alpine as builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci && npm cache clean --force

# Copy source code
COPY . .

# Build the application
ARG REACT_APP_API_URL=http://localhost:3001
ENV REACT_APP_API_URL=$REACT_APP_API_URL
# Google SSO web client ID (public identifier, safe as a build arg). Empty
# default keeps the Google button disabled when SSO isn't configured.
ARG REACT_APP_GOOGLE_OAUTH_CLIENT_ID=
ENV REACT_APP_GOOGLE_OAUTH_CLIENT_ID=$REACT_APP_GOOGLE_OAUTH_CLIENT_ID
# Match the CI policy: never ship source maps into the public nginx root.
# Plain `npm run build` defaults GENERATE_SOURCEMAP=true, which would publish
# ~7.6MB of readable, commented source (FBR logic, auth flows) at /static/js/*.map.
ENV GENERATE_SOURCEMAP=false
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built files from builder stage
COPY --from=builder /app/build /usr/share/nginx/html

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:80 || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]