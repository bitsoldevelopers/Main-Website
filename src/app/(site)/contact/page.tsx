import type { Metadata } from "next";
import { DEFAULT_OG_IMAGE } from "@/lib/seo";
import ContactClient from "./ContactClient";

export const metadata: Metadata = {
  title: "Contact Us | Free Strategy Call",
  description:
    "Contact BITSOL Marketing to book a free 30-minute strategy call and get a custom marketing audit for your business, in Pakistan or abroad.",
  alternates: { canonical: "https://bitsolmarketing.com/contact" },
  openGraph: {
    title: "Contact BITSOL Marketing | Free Strategy Call",
    description:
      "Book a free AI marketing strategy call with BITSOL Marketing. Get a custom audit and 90-day growth roadmap for your business.",
    url: "https://bitsolmarketing.com/contact",
    images: [DEFAULT_OG_IMAGE],
  },
};

export default function ContactPage() {
  return <ContactClient />;
}
