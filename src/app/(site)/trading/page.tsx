import type { Metadata } from "next";
import { DEFAULT_OG_IMAGE } from "@/lib/seo";
import TradingClient from "./TradingClient";

export const metadata: Metadata = {
  title: "PSX, PMEX & Crypto Trading Technology",
  description:
    "Algorithmic trading systems for PSX, PMEX, Binance and crypto markets, with AI-driven risk management and trading signals, built by BITSOL Marketing.",
  alternates: { canonical: "https://bitsolmarketing.com/trading" },
  openGraph: {
    title: "Algorithmic Trading Technology | BITSOL Marketing",
    description:
      "High-frequency trading systems, AI risk management, and automated bots for PSX, PMEX, and crypto markets built by BITSOL Marketing Pakistan.",
    url: "https://bitsolmarketing.com/trading",
    images: [DEFAULT_OG_IMAGE],
  },
};

export default function TradingSolutionsPage() {
  return <TradingClient />;
}
