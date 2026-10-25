export type SceneLayout = "cluster" | "scatter" | "ring" | "funnel" | "grid";

export interface SceneCta {
  id: string;
  label: string;
  href: string;
  variant: "brand" | "outline";
}

export interface HomeScene {
  id: string;
  /** Scroll range of the immersive section, as fractions 0–1. */
  start: number;
  end: number;
  eyebrow: string;
  heading: string;
  body: string;
  /** Optional bullet list shown under the body. */
  points?: string[];
  ctas?: SceneCta[];
  /** Layout the 3D nodes move into when this scene is active. */
  layout: SceneLayout;
  /** Text for assistive tech describing the 3D scene. The canvas itself is aria-hidden. */
  visualDescription: string;
}

export const WHATSAPP_URL =
  "https://wa.me/923120141581?text=" +
  encodeURIComponent("Hello BITSOL Marketing! I'd like to discuss my growth goals.");

export const HOMEPAGE_SCENES: HomeScene[] = [
  {
    id: "beginning",
    start: 0,
    end: 0.14,
    eyebrow: "BITSOL Marketing",
    heading: "Your Next Stage of Growth Starts Here.",
    body: "BITSOL Marketing is an AI-powered digital growth partner. We connect SEO, paid ads, social media, web development and WhatsApp automation into one system.",
    ctas: [
      { id: "hero-build-system", label: "Build My Growth System", href: "/contact", variant: "brand" },
      { id: "hero-explore-solutions", label: "Explore Solutions", href: "/services", variant: "outline" },
    ],
    layout: "cluster",
    visualDescription: "A glass sculpture at the centre of the screen, built from connected nodes.",
  },
  {
    id: "challenge",
    start: 0.14,
    end: 0.28,
    eyebrow: "The Challenge",
    heading: "Disconnected tools create disconnected growth.",
    body: "Separate ad accounts, websites that do not talk to your CRM, scattered enquiries, missed follow-ups and reports that never line up. Each gap leaks budget and attention.",
    layout: "scatter",
    visualDescription: "Separate fragments drifting apart, then gradually converging into one shape.",
  },
  {
    id: "intelligence",
    start: 0.28,
    end: 0.44,
    eyebrow: "The Intelligence",
    heading: "Make your business systems work together.",
    body: "We connect the layers that run a modern business to a single source of truth.",
    points: [
      "AI agents for repetitive, rules-based work",
      "Workflow automation between your tools",
      "WhatsApp chatbots for enquiries",
      "CRM and lead management",
      "Analytics across channels",
    ],
    layout: "ring",
    visualDescription: "Independent modules orbiting and linking to a central hub.",
  },
  {
    id: "growth-engine",
    start: 0.44,
    end: 0.62,
    eyebrow: "The Growth Engine",
    heading: "Turn attention into qualified opportunities.",
    body: "Traffic from search, social, paid ads and messaging flows through the same path: landing page, lead capture, qualification, follow-up and conversion tracking.",
    points: [
      "Search and social traffic",
      "Paid advertising",
      "Messaging enquiries",
      "Landing page and lead capture",
      "Qualification and follow-up",
      "Conversion tracking",
    ],
    layout: "funnel",
    visualDescription: "Incoming streams from several channels converging into one organised pipeline.",
  },
  {
    id: "solutions",
    start: 0.62,
    end: 0.77,
    eyebrow: "The Solutions",
    heading: "One ecosystem, many services.",
    body: "Each service works on its own and gets stronger when combined with the others.",
    points: [
      "SEO and Google Business Profile",
      "Social media marketing",
      "Meta advertising",
      "Google advertising",
      "Website design and development",
      "WhatsApp chatbot automation",
      "AI agents and workflow automation",
    ],
    ctas: [{ id: "solutions-view-services", label: "View All Services", href: "/services", variant: "outline" }],
    layout: "ring",
    visualDescription: "Service modules arranged in a ring, each lighting up as the story moves on.",
  },
  {
    id: "evidence",
    start: 0.77,
    end: 0.89,
    eyebrow: "The Evidence",
    heading: "Built to be measured.",
    body: "Every campaign and automation is set up with conversion tracking, so results can be reviewed with you in plain terms. We only share outcomes that are backed by your own data.",
    ctas: [{ id: "evidence-see-work", label: "See Our Work", href: "/portfolio", variant: "outline" }],
    layout: "grid",
    visualDescription: "A structured grid of modules showing a measured, organised system.",
  },
  {
    id: "next-chapter",
    start: 0.89,
    end: 1,
    eyebrow: "The Next Chapter",
    heading: "Let’s Build Your Growth System.",
    body: "Tell us where growth is getting stuck. We will reply with honest next steps. The details you share are used only to answer your enquiry. See our Privacy Policy for more.",
    ctas: [
      { id: "closing-consultation", label: "Book Your Free Consultation", href: "/contact", variant: "brand" },
      { id: "closing-whatsapp", label: "Chat on WhatsApp", href: WHATSAPP_URL, variant: "outline" },
    ],
    layout: "cluster",
    visualDescription: "The connected system gathers back into a single, resolved form.",
  },
];

/** Number of nodes drawn in the 3D scene. Layouts are defined for this count. */
export const SCENE_NODE_COUNT = 8;

/** Index of the scene that contains a 0–1 progress value. */
export function sceneIndexForProgress(progress: number): number {
  const p = Math.min(Math.max(progress, 0), 1);
  for (let i = HOMEPAGE_SCENES.length - 1; i >= 0; i--) {
    if (p >= HOMEPAGE_SCENES[i].start) return i;
  }
  return 0;
}
