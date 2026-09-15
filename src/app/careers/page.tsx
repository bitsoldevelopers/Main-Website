import type { Metadata } from "next";
import CareersClient from "./CareersClient";
import { DEFAULT_OG_IMAGE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Careers | Jobs in AI & Digital Marketing",
  description: "Join BITSOL Marketing. We're hiring frontend engineers, AI architects, SEO specialists and performance media buyers. See open roles and apply.",
  alternates: {
    canonical: "https://bitsolmarketing.com/careers",
  },
  openGraph: {
    title: "Careers at BITSOL Marketing | Join the Architects of Innovation",
    description: "Build scalable digital ecosystems with us. Explore careers in engineering, artificial intelligence, and result-driven growth marketing.",
    url: "https://bitsolmarketing.com/careers",
    type: "website",
    images: [DEFAULT_OG_IMAGE],
  },
};

export default function CareersPage() {
  return <CareersClient />;
}
