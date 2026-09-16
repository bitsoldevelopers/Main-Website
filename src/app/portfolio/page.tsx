import type { Metadata } from "next";
import PortfolioClient from "./PortfolioClient";
import { DEFAULT_OG_IMAGE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Portfolio | AI & Web Development Projects",
  description:
    "Browse BITSOL Marketing's portfolio of AI automation systems, websites, trading platforms and digital marketing campaigns.",
  alternates: { canonical: "https://bitsolmarketing.com/portfolio" },
  openGraph: {
    title: "Portfolio | BITSOL Marketing",
    description:
      "AI systems, web platforms, trading tech, and digital marketing campaigns. See what BITSOL Marketing builds for ambitious businesses.",
    url: "https://bitsolmarketing.com/portfolio",
    images: [DEFAULT_OG_IMAGE],
  },
};

export default function PortfolioPage() {
  return <PortfolioClient />;
}
