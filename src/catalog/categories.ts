// The kinds of service the house knows: a list with no drawing attached, so
// pages that only offer the choice (the map's editor) need not load the
// geometry. Each kind has a default god (src/geometry/pantheon.ts).

/** Service categories. Each has a default god; a service may still name another. */
export const CATEGORIES = {
  virtualization: 'Hypervisors, virtual machines, clusters',
  networking: 'Routing, DNS, DHCP, switching, connectivity',
  proxy: 'Reverse proxies, gateways, application routing',
  storage: 'NAS, volumes, object stores, file servers',
  backup: 'Backups, snapshots, replication, archives',
  monitoring: 'Metrics, logs, alerting, uptime',
  security: 'VPN, firewalls, identity, secrets, access',
  cloud: 'Private cloud, file sync, collaboration',
  media: 'Streaming, music, photos, books',
  home: 'Home automation, IoT',
  containers: 'Container runtimes, orchestration, registries',
  web: 'Websites, web apps, wikis, dashboards',
  gaming: 'Game servers in general',
  sandbox: 'Crafting and building games (e.g. Minecraft)',
  competitive: 'Competitive and dedicated multiplayer servers',
  community: 'Game communities, voice, chat, events',
  other: 'Anything else — falls back to a monogram',
} as const;
export type Category = keyof typeof CATEGORIES;
