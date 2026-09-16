import type { Metadata } from "next";
import AboutClient from "./AboutClient";
import { DEFAULT_OG_IMAGE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "About Us | AI Marketing Agency Team",
  description:
    "Meet the BITSOL Marketing team: AI engineers, SEO strategists and growth marketers building digital systems for businesses in Pakistan and worldwide.",
  alternates: { canonical: "https://bitsolmarketing.com/about" },
  openGraph: {
    title: "About BITSOL Marketing | AI-Powered Growth Agency",
    description:
      "Meet the team behind Pakistan's leading AI digital marketing agency. AI engineers, SEO experts, and automation specialists.",
    url: "https://bitsolmarketing.com/about",
    images: [DEFAULT_OG_IMAGE],
  },
};

export default function AboutPage() {
  return <AboutClient />;
}
