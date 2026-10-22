# The Olympus — the site, its map's edit API and its rebuilds: one service.
#
#   docker build -f deploy/Dockerfile -t theolympus .
#   docker run -d -p 8080:8080 -v olympus-data:/var/lib/olympus/data \
#     -v olympus-site:/var/lib/olympus/site --name olympus theolympus
#   docker exec -it olympus node scripts/editor.ts password     (once, to edit the map)
#
# The image carries the repository and a warm build cache: the first start
# puts the first release together in seconds. Every change saved on the map
# is rebuilt — only what it touches — and published in one step; the release
# before stays served until then. The data volume is the server's own state
# (what the map adds, the password): keep it, back it up.

FROM node:24-bookworm-slim
# ping, for the map's "online" marks (unprivileged ICMP: no added capability needed); git, to follow the repository (docker-compose.auto.yml).
RUN apt-get update \
 && apt-get install -y --no-install-recommends iputils-ping git ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /repo
RUN chown node:node /repo && mkdir -p /var/lib/olympus/data /var/lib/olympus/site && chown -R node:node /var/lib/olympus
USER node
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY --chown=node:node . .
# Everything the site is made of, built once here: the cache it leaves makes each later build incremental.
RUN node scripts/build.ts all && node scripts/build.ts site && rm -rf app/dist

ENV HOST=0.0.0.0 \
    PORT=8080 \
    OLYMPUS_DATA=/var/lib/olympus/data \
    OLYMPUS_OUT=/var/lib/olympus/site
VOLUME ["/var/lib/olympus/data", "/var/lib/olympus/site"]
EXPOSE 8080
HEALTHCHECK --interval=60s --timeout=5s --start-period=120s \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "scripts/serve.ts"]
