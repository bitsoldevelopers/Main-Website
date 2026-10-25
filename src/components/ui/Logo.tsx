import React from "react";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 500 500"
      className={className}
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
        style={{ fontFamily: "var(--font-montserrat), Montserrat, sans-serif" }}
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
  );
}
