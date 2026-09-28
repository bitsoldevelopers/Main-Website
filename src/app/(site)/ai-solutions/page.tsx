import type { Metadata } from "next";
import { DEFAULT_OG_IMAGE } from "@/lib/seo";
import AISolutionsClient from "./AISolutionsClient";

export const metadata: Metadata = {
  title: "AI Chatbots & Automation in Pakistan",
  description:
    "BITSOL Marketing builds custom AI chatbots, autonomous agents, voice assistants, and workflow automation systems for businesses in Pakistan and globally.",
  alternates: { canonical: "https://bitsolmarketing.com/ai-solutions" },
  openGraph: {
    title: "AI Solutions | BITSOL Marketing Pakistan",
    description:
      "Custom AI chatbots, agents, voice assistants, and automation systems built by Pakistan's leading AI agency.",
    url: "https://bitsolmarketing.com/ai-solutions",
    images: [DEFAULT_OG_IMAGE],
  },
};

export default function AISolutionsPage() {
  return <AISolutionsClient />;
}
