import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { DEFAULT_OG_IMAGE } from "@/lib/seo";

// The link preview shown by WhatsApp, LinkedIn, Facebook, X and Slack. It
// mirrors the dark-mode homepage hero: Montserrat, the cyan brand colour and
// the hero video in a glowing frame (src/assets/og/hero-frame.jpg is the frame
// at 1.3s of public/hero/hero.mp4, where the mascot waves).
// Generated once at build time. When the design changes, bump OG_IMAGE_VERSION
// in lib/seo.ts so platforms that cache previews fetch the new image.

export const alt = DEFAULT_OG_IMAGE.alt;
export const size = { width: DEFAULT_OG_IMAGE.width, height: DEFAULT_OG_IMAGE.height };
export const contentType = DEFAULT_OG_IMAGE.type;

const BG = "#050816";
const CYAN = "#00D9FF";

const asset = (file: string) => readFile(join(process.cwd(), "src/assets/og", file));

export default async function OgImage() {
  const [medium, bold, extraBold, heroFrame] = await Promise.all([
    asset("Montserrat-Medium.ttf"),
    asset("Montserrat-Bold.ttf"),
    asset("Montserrat-ExtraBold.ttf"),
    asset("hero-frame.jpg"),
  ]);
  const heroFrameSrc = `data:image/jpeg;base64,${heroFrame.toString("base64")}`;

  const png = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: BG,
          fontFamily: "Montserrat",
          overflow: "hidden",
        }}
      >
        {/* Background: dot grid as behind the site's hero, a clear column for the
            text, and cyan light behind the video frame. Drawn as SVG because the
            image renderer's CSS gradients mishandle transparency. */}
        <svg width="1200" height="630" style={{ position: "absolute", top: 0, left: 0 }}>
          <defs>
            <pattern id="dots" width="30" height="30" patternUnits="userSpaceOnUse">
              <circle cx="15" cy="15" r="1.5" fill="#94A3B8" fillOpacity="0.28" />
            </pattern>
            <linearGradient id="textSide" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor={BG} stopOpacity="1" />
              <stop offset="0.38" stopColor={BG} stopOpacity="0.85" />
              <stop offset="0.62" stopColor={BG} stopOpacity="0" />
            </linearGradient>
            <radialGradient id="frameLight" cx="908" cy="315" r="520" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#2563EB" stopOpacity="0.22" />
              <stop offset="1" stopColor="#2563EB" stopOpacity="0" />
            </radialGradient>
            {/* The site's dark-mode shadow on the video: 0 0 80px cyan */}
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="34" />
            </filter>
            <radialGradient id="violet" cx="90" cy="650" r="340" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#7C3AED" stopOpacity="0.22" />
              <stop offset="1" stopColor="#7C3AED" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="1200" height="630" fill="url(#dots)" />
          <rect width="1200" height="630" fill="url(#textSide)" />
          <rect width="1200" height="630" fill="url(#frameLight)" />
          <rect width="1200" height="630" fill="url(#violet)" />
          <rect x="668" y="60" width="480" height="510" rx="28" fill={CYAN} fillOpacity="0.42" filter="url(#glow)" />
        </svg>

        {/* The hero video's frame, as the homepage shows it in dark mode. The
            radius goes on the image itself: the renderer doesn't clip an image
            to its parent's rounded corners. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={heroFrameSrc}
          width={480}
          height={510}
          alt=""
          style={{ position: "absolute", left: 668, top: 60, borderRadius: 28, objectFit: "cover" }}
        />
        <div
          style={{
            position: "absolute",
            left: 668,
            top: 60,
            width: 480,
            height: 510,
            display: "flex",
            borderRadius: 28,
            border: "1.5px solid rgba(255,255,255,0.18)",
          }}
        />

        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: 640,
            height: "100%",
            padding: "52px 0 56px 68px",
          }}
        >
          {/* Brand, as in the navbar */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 50,
                height: 50,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
              }}
            >
              <svg
                width="50"
                height="50"
                viewBox="0 0 500 500"
                style={{ position: "absolute", top: 0, left: 0 }}
              >
                <circle cx="250" cy="250" r="230" fill="none" stroke={CYAN} strokeWidth="14" />
                <circle cx="250" cy="250" r="205" fill="none" stroke="#0E4A5C" strokeWidth="8" />
              </svg>
              <div style={{ display: "flex", fontSize: 13, fontWeight: 800, color: "#E2E8F0", letterSpacing: -0.5 }}>
                bitsol
              </div>
            </div>
            <div style={{ display: "flex", fontSize: 30, fontWeight: 800, color: "#FFFFFF", letterSpacing: -0.5 }}>
              BITSOL<span style={{ color: CYAN }}>.</span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                fontSize: 17,
                fontWeight: 700,
                color: CYAN,
                letterSpacing: 2.6,
                marginBottom: 22,
              }}
            >
              RESULT-DRIVEN DIGITAL MARKETING AGENCY
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                fontSize: 66,
                fontWeight: 800,
                lineHeight: 1.06,
                letterSpacing: -1.5,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  backgroundImage: "linear-gradient(180deg, #FAFAFA 0%, #B4B4B8 100%)",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                <span>Grow Your</span>
                <span>Business with</span>
              </div>
              <span style={{ color: CYAN }}>BITSOL</span>
              <span style={{ color: CYAN }}>Marketing</span>
            </div>
          </div>

          {/* Call to action, styled like the hero button */}
          <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: CYAN,
                color: BG,
                borderRadius: 999,
                padding: "15px 28px",
                fontSize: 21,
                fontWeight: 700,
              }}
            >
              Get Free Consultation
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke={BG}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </div>
            <div style={{ display: "flex", fontSize: 21, fontWeight: 500, color: "#94A3B8" }}>
              bitsolmarketing.com
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Montserrat", data: medium, weight: 500, style: "normal" },
        { name: "Montserrat", data: bold, weight: 700, style: "normal" },
        { name: "Montserrat", data: extraBold, weight: 800, style: "normal" },
      ],
    }
  );

  // As a PNG this card is ~290 KB, and WhatsApp drops preview images over
  // ~300 KB. As a JPEG it is ~80 KB with no visible loss.
  const jpeg = await sharp(Buffer.from(await png.arrayBuffer()))
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
  return new Response(new Uint8Array(jpeg), { headers: { "Content-Type": contentType } });
}
