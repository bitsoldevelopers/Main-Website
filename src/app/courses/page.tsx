import type { Metadata } from "next";
import CoursesClient from "./CoursesClient";
import { DEFAULT_OG_IMAGE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Digital Marketing & AI Courses Online",
  description:
    "BITSOL Academy's online courses in digital marketing, AI automation and PSX trading. Expert-led programs with certificates for professionals in Pakistan.",
  alternates: { canonical: "https://bitsolmarketing.com/courses" },
  openGraph: {
    title: "BITSOL Academy | Online Courses in Pakistan",
    description:
      "Master digital marketing, AI automation, and trading with BITSOL Academy's expert-led online courses.",
    url: "https://bitsolmarketing.com/courses",
    images: [DEFAULT_OG_IMAGE],
  },
};

export default function CoursesPage() {
  return <CoursesClient />;
}
