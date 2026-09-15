import { ImageResponse } from "next/og";

// This URL is the logo in the Organization schema, and it returned 503 in
// production: the route ran on the edge runtime and the image was built from
// an SVG <text> node, which the renderer rejects ("<text> nodes are not
// currently supported"). The wordmark is now real text laid out by the image
// renderer, and the file is generated once at build time on the Node runtime.
export const dynamic = "force-static";

export function GET() {
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
          position: "relative",
        }}
      >
        {/* Rings and rocket mark — shapes only, no text nodes. */}
        <svg
          width="200"
          height="200"
          viewBox="0 0 500 500"
          xmlns="http://www.w3.org/2000/svg"
          style={{ position: "absolute", top: 0, left: 0 }}
        >
          <circle cx="250" cy="250" r="230" fill="none" stroke="#00D9FF" strokeWidth="8" />
          <circle cx="250" cy="250" r="215" fill="none" stroke="#052E3B" strokeWidth="4" />
          <path
            d="M255 180 L265 170 L275 180 L265 195 Z"
            fill="#00D9FF"
            transform="rotate(-45 265 180)"
          />
          <path d="M260 190 L265 200 L270 190" fill="#00D9FF" opacity="0.6" />
        </svg>

        <div
          style={{
            display: "flex",
            marginTop: 14,
            fontSize: 58,
            fontWeight: 800,
            letterSpacing: -2,
            color: "#052E3B",
          }}
        >
          bitsol
        </div>
      </div>
    ),
    { width: 200, height: 200 }
  );
}
