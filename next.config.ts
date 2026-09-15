import type { NextConfig } from "next";

// Reported, not enforced, for now: the site's only Content-Security-Policy was
// `upgrade-insecure-requests`, which protects against nothing. This lists the
// origins the site actually uses (measured from a live page load), so
// violations show up in the browser console before the policy is switched to
// the enforcing `Content-Security-Policy` header.
//
// 'unsafe-inline'/'unsafe-eval' are required by Next.js's inline bootstrap
// scripts and the Spline runtime; tightening those needs nonces, which in turn
// need every page rendered per request.
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://tagmanager.google.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https://images.unsplash.com https://www.googletagmanager.com https://www.google-analytics.com https://*.google.com https://*.gstatic.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://www.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://*.spline.design https://unpkg.com https://images.unsplash.com",
  "frame-src 'self' https://www.google.com https://www.googletagmanager.com https://www.youtube.com https://www.youtube-nocookie.com",
  "media-src 'self' https://*.spline.design",
  "worker-src 'self' blob:",
  // No upgrade-insecure-requests here: browsers ignore it in a report-only
  // policy and log a warning. The CDN already sends it as an enforced policy.
].join("; ");

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },

  // www → non-www canonical redirect
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.bitsolmarketing.com" }],
        destination: "https://bitsolmarketing.com/:path*",
        permanent: true,
      },
      {
        source: "/case-studies",
        destination: "/portfolio",
        permanent: true,
      },
    ];
  },

  // Cache-Control, security, and SEO headers
  async headers() {
    return [
      // Static image assets — 1 year cache
      {
        source: "/:path*\\.(jpg|jpeg|png|gif|webp|svg|ico|avif)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      // Static font/CSS/JS — 1 year cache
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      // All pages — security + SEO headers
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          {
            key: "Content-Security-Policy-Report-Only",
            value: contentSecurityPolicy,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
