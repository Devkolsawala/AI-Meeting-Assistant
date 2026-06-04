/** @type {import('next').NextConfig} */
const nextConfig = {
  // Linting is centralized at the repo root (`eslint .`). Skip Next's own lint
  // pass during `next build` so we don't need a second, divergent ESLint config.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
