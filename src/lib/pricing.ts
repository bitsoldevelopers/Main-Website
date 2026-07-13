import { Zap, Rocket, Building2 } from "lucide-react";

export interface Plan {
  name: string;
  icon: typeof Zap;
  price: string;
  period: string;
  desc: string;
  color: string;
  bg: string;
  popular: boolean;
  features: string[];
}

export const plans: Plan[] = [
  {
    name: "Starter",
    icon: Zap,
    price: "$500",
    period: "/month",
    desc: "For startups and small businesses ready to go digital with AI.",
    color: "#06b6d4",
    bg: "rgba(6,182,212,0.1)",
    popular: false,
    features: [
      "AI-powered SEO audit & on-page optimisation",
      "2× social media channels managed",
      "Meta Ads setup & management (up to $1k ad spend)",
      "Monthly analytics report",
      "1 landing page / content update",
      "WhatsApp Business integration",
      "Email support (48-hr response)",
    ],
  },
  {
    name: "Growth",
    icon: Rocket,
    price: "$1,500",
    period: "/month",
    desc: "Full-stack AI marketing for businesses scaling fast.",
    color: "#a855f7",
    bg: "rgba(168,85,247,0.1)",
    popular: true,
    features: [
      "Everything in Starter",
      "Advanced SEO — technical, off-page & link building",
      "Google Ads + Meta Ads (up to $5k ad spend)",
      "AI chatbot development (WhatsApp / web)",
      "Automated lead-nurturing workflows",
      "Monthly blog content (4 posts)",
      "Bi-weekly strategy calls",
      "Priority support (24-hr response)",
    ],
  },
  {
    name: "Enterprise",
    icon: Building2,
    price: "Custom",
    period: "",
    desc: "Bespoke AI systems and dedicated teams for large organisations.",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.1)",
    popular: false,
    features: [
      "Everything in Growth",
      "Custom LLM / AI agent development",
      "Multi-channel paid media (unlimited spend)",
      "Full web or mobile app development",
      "Algorithmic trading software (PSX / crypto)",
      "Dedicated account manager",
      "Weekly executive reporting",
      "SLA-backed 12-hr response",
    ],
  },
];
