/**
 * The content the site shipped with before the CMS existed. It doubles as:
 *  - the fallback the public pages render when the tables are empty or the
 *    database is unreachable (the site never goes blank), and
 *  - the "import defaults" seed offered in the admin, so editing starts from
 *    what is actually live instead of an empty screen.
 *
 * Client-safe: no server imports.
 */

export interface FaqItem {
  question: string;
  answer: string;
}

export const HOME_FAQ_DEFAULTS: FaqItem[] = [
  {
    question: "What digital marketing services does BITSOL Marketing offer in Pakistan?",
    answer:
      "BITSOL Marketing offers a complete range of digital marketing services in Pakistan: SEO, social media marketing, Google Ads, Meta Ads (Facebook & Instagram), web development, content marketing, Google Business Profile optimization, and branding. We serve businesses in Karachi, Lahore, Islamabad, and internationally.",
  },
  {
    question: "How do SEO services from BITSOL Marketing help my business rank on Google?",
    answer:
      "We run a full SEO process — technical audit, keyword research, on-page optimisation, content production, and link building. We also optimise your Google Business Profile so your business ranks in the Google Map Pack for local searches. Most clients see first-page rankings for local keywords within 60–90 days.",
  },
  {
    question: "Does BITSOL Marketing manage Google Ads and Meta Ads campaigns?",
    answer:
      "Yes. Paid media management is a core BITSOL service. We manage Google Search, Display, Shopping, and Performance Max campaigns alongside Meta Ads (Facebook + Instagram) for Pakistani businesses. We handle creative, audience targeting, bidding, and daily optimisation — with transparent weekly reporting.",
  },
  {
    question: "Can BITSOL Marketing build a professional website for my business?",
    answer:
      "Yes. Our web development team builds fast, mobile-responsive, SEO-optimised websites and web applications on Next.js, React, and WordPress. Every site includes proper schema markup, Core Web Vitals compliance, and conversion-optimised design. We serve businesses in Karachi, Lahore, Islamabad, and the UAE.",
  },
  {
    question: "What is Google Business Profile optimization and why does it matter?",
    answer:
      "Google Business Profile (GBP) optimization means setting up and fully completing your free Google listing so your business appears in Google Maps and the Local Pack when people search for your services nearby. BITSOL's local SEO team optimises your GBP profile, manages reviews, publishes regular posts, and builds local citations to maximise your visibility in local search.",
  },
  {
    question: "How do I get a free consultation from BITSOL Marketing?",
    answer:
      "Click the 'Get Free Consultation' button on this page or visit our Contact page. You can book a call directly or message us on WhatsApp. We'll review your current digital presence, identify the highest-ROI opportunities, and propose a tailored growth plan — with no obligation.",
  },
];

export interface TestimonialItem {
  id: string;
  /** Shown as the card heading — the client/company name. */
  title: string;
  /** The quote itself. */
  description: string;
}

export const TESTIMONIAL_DEFAULTS: TestimonialItem[] = [
  {
    id: "1",
    title: "Global Logistics Corp",
    description:
      "BITSOL transformed our supply chain with Nexus AI. We saw a 45% increase in operational efficiency within just three months. Their technical depth is unmatched.",
  },
  {
    id: "2",
    title: "Horizon Capital",
    description:
      "The precision of AlphaTrade Pro has given our institutional traders a massive edge. Millisecond execution and real-time risk AI changed how we handle PMEX markets.",
  },
  {
    id: "3",
    title: "Zenith Properties",
    description:
      "Our digital presence went from standard to cinematic. The 3D property tours built by BITSOL are our highest converting lead generation tool today.",
  },
  {
    id: "4",
    title: "SecureFinance",
    description:
      "Security was our top priority. BITSOL's CryptoVault OS exceeded every institutional-grade requirement we had. They are true architects of secure ecosystems.",
  },
  {
    id: "5",
    title: "Vitality Labs",
    description:
      "MobiHealth AI is more than an app; it's a life-saving tool. The biometric integration is seamless and the predictive analytics are incredibly accurate.",
  },
];
