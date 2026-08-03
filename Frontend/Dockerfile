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
# NO DEFAULT. This used to default to http://localhost:3001, which is
# PRODUCTION's backend port on the shared host — so any image built without the
# variable set baked prod's API origin into the bundle, on every environment.
# A staging browser session was then one working tunnel away from writing to
# production. Empty means "same origin", which is correct behind Caddy and is
# the only default that cannot point at the wrong environment.
ARG REACT_APP_API_URL=
ENV REACT_APP_API_URL=$REACT_APP_API_URL
# REACT_APP_API_BASE_URL is the name the app code reads (lane D). It exists
# because the API origin was previously HARDCODED in the bundle to the retired
# staging host, so a DNS change silently broke every write in a shipped build.
# Defaults to REACT_APP_API_URL so existing .env / CI setups keep working
# unchanged; set it explicitly to override just the API origin.
# NOTE: this is baked in at BUILD time (CRA inlines REACT_APP_* into the bundle).
# Changing it therefore requires a frontend REBUILD, not a container restart.
ARG REACT_APP_API_BASE_URL=
ENV REACT_APP_API_BASE_URL=${REACT_APP_API_BASE_URL:-$REACT_APP_API_URL}
# SSO public identifiers (safe as build args). Empty defaults keep the
# respective sign-in buttons gracefully unconfigured.
ARG REACT_APP_GOOGLE_OAUTH_CLIENT_ID=
ENV REACT_APP_GOOGLE_OAUTH_CLIENT_ID=$REACT_APP_GOOGLE_OAUTH_CLIENT_ID
ARG REACT_APP_APPLE_SERVICES_ID=
ENV REACT_APP_APPLE_SERVICES_ID=$REACT_APP_APPLE_SERVICES_ID
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