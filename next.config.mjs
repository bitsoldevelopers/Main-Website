// @ts-check

// Plain JavaScript rather than next.config.ts: Hostinger's build server has a
// glibc too old for Next's native SWC binary, so Next falls back to the WASM
// build, which failed to compile a TypeScript config ("Cannot find module
// ...next.config" from next.config.compiled.js). An .mjs file needs no
// compiling. For the same reason `npm run build` uses webpack: Turbopack
// requires the native binary.

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

// Development only. `next dev` names chunks by path, not by content, so a
// browser that once stored a dev chunk under the year-long `immutable`
// header (sent before the headers below were made production-only) keeps
// executing that stale copy: "module factory is not available", hydration
// mismatches on edited class names. A fresh deployment id on every dev-server
// start appends `?dpl=<id>` to every asset URL, so those cached entries are
// never requested again. Production builds set their own id (none here), and
// nothing about the live site changes.
const devCacheBuster =
  process.env.NODE_ENV === "development" ? { deploymentId: `dev-${Date.now().toString(36)}` } : {};

/** @type {import("next").NextConfig} */
const nextConfig = {
  ...devCacheBuster,
  output: "standalone",
  // The outreach mailbox (SMTP + IMAP, src/lib/automation/email). Loaded with
  // Node's require instead of bundled: imapflow's logger (pino) uses worker
  // threads that webpack cannot bundle.
  serverExternalPackages: ["nodemailer", "imapflow"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },

  // The WhatsApp webhook is registered with Meta as /webhook. A rewrite, not a
  // redirect: Meta does not follow 3xx when delivering a webhook.
  async rewrites() {
    return [{ source: "/webhook", destination: "/api/whatsapp/webhook" }];
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
    // The year-long immutable cache is right for production, where Next's
    // static assets carry content hashes. Under `next dev` chunk names are
    // path-based and their content changes with every edit, so the same header
    // made browsers keep stale chunks across reloads: "module factory is not
    // available" errors and hydration mismatches after any class change. In
    // development these rules are left out and Next's own no-cache defaults
    // apply.
    const longLived =
      process.env.NODE_ENV === "production"
        ? [
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
          ]
        : [];

    return [
      ...longLived,
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
