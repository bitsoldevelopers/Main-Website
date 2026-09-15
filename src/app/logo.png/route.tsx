import { ImageResponse } from "next/og";

// This URL is the logo in the Organization schema. It used the edge runtime,
// which returned 503 on the Hostinger Node server. Render it once at build
// time on the default Node runtime and serve it as a static file instead.
export const dynamic = "force-static";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "white",
          borderRadius: "50%",
        }}
      >
        <svg
          viewBox="0 0 500 500"
          width="100%"
          height="100%"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Outer Rings */}
          <circle cx="250" cy="250" r="230" fill="none" stroke="#00D9FF" strokeWidth="8" />
          <circle cx="250" cy="250" r="215" fill="none" stroke="#052E3B" strokeWidth="4" />
          
          {/* BITSOL Text */}
          <text
            x="250"
            y="280"
            textAnchor="middle"
            fontFamily="sans-serif"
            fontSize="120"
            fontWeight="800"
            fill="#052E3B"
            letterSpacing="-4"
          >
            bitsol
          </text>

          {/* Rocket Icon */}
          <path
            d="M255 180 L265 170 L275 180 L265 195 Z"
            fill="#00D9FF"
            transform="rotate(-45 265 180)"
          />
          <path
            d="M260 190 L265 200 L270 190"
            fill="#00D9FF"
            opacity="0.6"
          />
        </svg>
      </div>
    ),
    { width: 200, height: 200 }
  );
}
