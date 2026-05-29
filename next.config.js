/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3', 'hnswlib-node'],
  },
};

module.exports = nextConfig;
