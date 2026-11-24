// The browser only ever talks to this Next.js app. Requests to /api/* are proxied to the FastAPI backend,
// so there is no CORS to configure and the backend address lives in one place (BACKEND_URL).
const BACKEND = process.env.BACKEND_URL || 'http://localhost:8000';

/** @type {import('next').NextConfig} */
export default {
  output: 'standalone',
  eslint: { ignoreDuringBuilds: true },
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${BACKEND}/api/:path*` },
      { source: '/docs', destination: `${BACKEND}/docs` },            // Swagger UI for the API
      { source: '/openapi.json', destination: `${BACKEND}/openapi.json` },
    ];
  },
};
