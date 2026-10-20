# The Olympus — the builder: rebuilds the site whenever the catalogue or the
# repository changes (scripts/autobuild.ts). Used by docker-compose.auto.yml,
# which mounts the repository at /repo and the releases at /site.

FROM node:24-bookworm-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates \
 && rm -rf /var/lib/apt/lists/*
# The dependencies and the releases live in volumes; created here so they
# belong to the user the builder runs as (the node image's, uid 1000).
RUN mkdir -p /repo/node_modules /site && chown node:node /repo/node_modules /site
USER node
WORKDIR /repo
ENV OLYMPUS_OUT=/site
CMD ["node", "scripts/autobuild.ts"]
