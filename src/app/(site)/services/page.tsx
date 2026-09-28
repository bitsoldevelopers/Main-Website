import type { Metadata } from "next";
import ServicesClient from "./ServicesClient";
import { DEFAULT_OG_IMAGE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Digital Marketing & AI Services",
  description:
    "Explore BITSOL Marketing's services: SEO, AI chatbot development, Meta Ads, social media management, web development and business automation.",
  alternates: { canonical: "https://bitsolmarketing.com/services" },
  openGraph: {
    title: "AI Marketing Services | BITSOL Marketing",
    description:
      "Full-service AI marketing: SEO, chatbots, Meta ads, automation, web development. Serving Pakistan and global markets.",
    url: "https://bitsolmarketing.com/services",
    images: [DEFAULT_OG_IMAGE],
  },
};

export default function ServicesPage() {
  return <ServicesClient />;
}
