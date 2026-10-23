import type { NextConfig } from 'next';

const secure = process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : process.env.NODE_ENV === 'production';

/** Static security headers. The Content-Security-Policy (with a per-request nonce) is set in src/proxy.ts. */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  ...(secure ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }] : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '256kb',
      ...(process.env.SERVER_ACTIONS_ALLOWED_ORIGINS ? { allowedOrigins: process.env.SERVER_ACTIONS_ALLOWED_ORIGINS.split(',') } : {}),
    },
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // The Android app (see /app): served as an installable package, never cached past a new release.
      {
        source: '/downloads/:file',
        headers: [
          { key: 'Content-Type', value: 'application/vnd.android.package-archive' },
          { key: 'Content-Disposition', value: 'attachment; filename="LakshmipurBlood.apk"' },
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
        ],
      },
    ];
  },
};

export default nextConfig;
