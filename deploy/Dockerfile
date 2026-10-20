# The Olympus — the site, built and served.
#
#   docker build -f deploy/Dockerfile -t theolympus-site .
#   docker run -d -p 8080:80 --name olympus theolympus-site
#
# Stage 1 builds the site from the repository (the brand's files are already
# in it); stage 2 serves the result with nginx.

FROM node:24-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY . .
RUN npm run app:build

FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=60s --timeout=5s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
