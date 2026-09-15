import {
  Search,
  Megaphone,
  BarChart3,
  Target,
  Video,
  Mail,
  Users,
  PenTool,
  Globe,
  ShoppingCart,
  Database,
  Boxes,
  AppWindow,
  Smartphone,
  Cloud,
  Braces,
  Sparkles,
  Layers,
  Palette,
  Film,
  Wand2,
  Camera,
  Bot,
  Workflow,
  MessageCircle,
  Mic,
  Link2,
  Cpu,
  LineChart,
  Shield,
  Building2,
  Code2,
  MessagesSquare,
  Store,
  Briefcase,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

export interface MegaMenuItem {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
}

export interface MegaMenuColumn {
  heading: string;
  items: MegaMenuItem[];
}

export interface NavItem {
  name: string;
  href: string;
  columns?: MegaMenuColumn[];
  featured?: MegaMenuItem;
}

export const servicesMenu: MegaMenuColumn[] = [
  {
    heading: "Digital Marketing",
    items: [
      { title: "SEO", description: "Rank higher and get found on Google.", href: "/services/seo-optimization", icon: Search },
      { title: "Social Media Marketing", description: "Grow engaged communities that convert.", href: "/services/digital-marketing", icon: Megaphone },
      { title: "Google Ads", description: "High-intent traffic that turns into revenue.", href: "/services/digital-marketing", icon: BarChart3 },
      { title: "Meta Ads", description: "Scroll-stopping campaigns on Facebook & Instagram.", href: "/services/digital-marketing", icon: Target },
      { title: "TikTok Marketing", description: "Viral-ready content for the next generation.", href: "/services/digital-marketing", icon: Video },
      { title: "Email Marketing", description: "Automated sequences that nurture and sell.", href: "/services/digital-marketing", icon: Mail },
      { title: "Influencer Marketing", description: "Partnerships that build trust at scale.", href: "/services/digital-marketing", icon: Users },
      { title: "Content Marketing", description: "Strategic content that attracts and converts.", href: "/services/content-marketing", icon: PenTool },
    ],
  },
  {
    heading: "Software Development",
    items: [
      { title: "Website Development", description: "Fast, SEO-ready sites built to convert.", href: "/services/web-development", icon: Globe },
      { title: "E-Commerce", description: "Storefronts engineered to sell around the clock.", href: "/services/web-development", icon: ShoppingCart },
      { title: "CRM Development", description: "Custom systems to manage every customer.", href: "/services/web-development", icon: Database },
      { title: "ERP Solutions", description: "Unify operations across your entire business.", href: "/services/web-development", icon: Boxes },
      { title: "Web Applications", description: "Scalable apps built on modern architecture.", href: "/services/web-development", icon: AppWindow },
      { title: "Mobile Apps", description: "Native & cross-platform iOS/Android apps.", href: "/services/mobile-apps", icon: Smartphone },
      { title: "Cloud Solutions", description: "Cloud-native infrastructure that scales with you.", href: "/services/web-development", icon: Cloud },
      { title: "API Development", description: "Robust integrations connecting your stack.", href: "/services/web-development", icon: Braces },
    ],
  },
  {
    heading: "Creative Services",
    items: [
      { title: "Brand Identity", description: "Strategic positioning and visual systems.", href: "/services/branding", icon: Sparkles },
      { title: "Logo Design", description: "Distinct marks that command recognition.", href: "/services/branding", icon: PenTool },
      { title: "UI/UX Design", description: "Interfaces designed for clarity and conversion.", href: "/services/web-development", icon: Layers },
      { title: "Graphic Design", description: "Visuals that elevate every touchpoint.", href: "/services/branding", icon: Palette },
      { title: "Video Editing", description: "Polished edits for ads, reels, and campaigns.", href: "/services/content-marketing", icon: Film },
      { title: "Motion Graphics", description: "Animated storytelling that grabs attention.", href: "/services/content-marketing", icon: Wand2 },
      { title: "3D Animation", description: "Immersive visuals for standout campaigns.", href: "/services/content-marketing", icon: Boxes },
      { title: "Photography", description: "Professional imagery for brand and product.", href: "/services/branding", icon: Camera },
    ],
  },
];

export const solutionsMenu: MegaMenuColumn[] = [
  {
    heading: "AI Automation",
    items: [
      { title: "AI Automation", description: "Autonomous agents that eliminate busywork.", href: "/services/ai-automation", icon: Bot },
      { title: "Business Automation", description: "Streamline operations end-to-end.", href: "/services/ai-automation", icon: Cpu },
      { title: "WhatsApp AI Chatbots", description: "24/7 conversational agents that convert.", href: "/services/ai-automation", icon: MessageCircle },
      { title: "Lead Generation Systems", description: "Automated pipelines that qualify buyers.", href: "/services/ai-automation", icon: Target },
      { title: "AI Voice Agents", description: "Natural-sounding voice automation at scale.", href: "/ai-solutions", icon: Mic },
      { title: "CRM Integration", description: "Connect AI directly into your sales stack.", href: "/services/ai-automation", icon: Link2 },
      { title: "Workflow Automation", description: "Eliminate repetitive manual processes.", href: "/services/ai-automation", icon: Workflow },
    ],
  },
  {
    heading: "Enterprise & Data",
    items: [
      { title: "Business Intelligence", description: "Turn raw data into decisive action.", href: "/ai-solutions", icon: BarChart3 },
      { title: "Analytics Dashboards", description: "Real-time visibility into what matters.", href: "/ai-solutions", icon: LineChart },
      { title: "Cloud Infrastructure", description: "Resilient, scalable infrastructure by design.", href: "/services/web-development", icon: Cloud },
      { title: "Cyber Security", description: "Protect systems, data, and customer trust.", href: "/ai-solutions", icon: Shield },
      { title: "Enterprise Software", description: "Custom platforms for complex operations.", href: "/services/web-development", icon: Building2 },
      { title: "Algorithmic Trading Tech", description: "Institutional-grade systems for PSX & crypto.", href: "/services/trading-tech", icon: TrendingUp },
    ],
  },
];

export const trainingMenu: MegaMenuColumn[] = [
  {
    heading: "Marketing & Creative",
    items: [
      { title: "Digital Marketing", description: "SEO, PPC, and AI-driven strategy.", href: "/courses", icon: Megaphone },
      { title: "Graphic Designing", description: "Master visual design fundamentals.", href: "/courses", icon: Palette },
      { title: "Video Editing", description: "Professional editing for every platform.", href: "/courses", icon: Film },
      { title: "Freelancing", description: "Build a profitable freelance career.", href: "/courses", icon: Briefcase },
    ],
  },
  {
    heading: "Tech & AI",
    items: [
      { title: "Web Development", description: "Ship modern, production-ready sites.", href: "/courses", icon: Code2 },
      { title: "Python Programming", description: "From fundamentals to real-world projects.", href: "/courses", icon: Braces },
      { title: "Artificial Intelligence", description: "Build and deploy real AI systems.", href: "/courses", icon: Cpu },
      { title: "Prompt Engineering", description: "Master the craft of directing AI models.", href: "/courses", icon: Wand2 },
      { title: "ChatGPT Mastery", description: "Practical AI workflows for daily work.", href: "/courses", icon: MessagesSquare },
    ],
  },
  {
    heading: "E-Commerce & Web",
    items: [
      { title: "Shopify", description: "Launch and scale a Shopify store.", href: "/courses", icon: Store },
      { title: "Amazon VA", description: "Become an in-demand Amazon virtual assistant.", href: "/courses", icon: Briefcase },
      { title: "TikTok Shop", description: "Turn TikTok into a sales channel.", href: "/courses", icon: Video },
      { title: "WordPress", description: "Build and manage WordPress sites with confidence.", href: "/courses", icon: Globe },
    ],
  },
];

export const primaryNav: NavItem[] = [
  { name: "Home", href: "/" },
  { name: "About", href: "/about" },
  { name: "Services", href: "/services", columns: servicesMenu },
  { name: "Solutions", href: "/ai-solutions", columns: solutionsMenu },
  { name: "Training", href: "/courses", columns: trainingMenu },
  // "Case Studies" used to sit here pointing at /portfolio as well — two menu
  // items for one page.
  { name: "Portfolio", href: "/portfolio" },
  { name: "Blog", href: "/blog" },
  { name: "Contact", href: "/contact" },
];

export interface SearchablePage {
  title: string;
  href: string;
  keywords: string;
}

export const searchIndex: SearchablePage[] = [
  { title: "Home", href: "/", keywords: "homepage bitsol marketing" },
  { title: "About Us", href: "/about", keywords: "about company team story" },
  { title: "Services", href: "/services", keywords: "services overview" },
  { title: "AI Solutions", href: "/ai-solutions", keywords: "ai automation chatbots voice agents" },
  { title: "Academy / Training", href: "/courses", keywords: "courses training academy learning" },
  { title: "Portfolio", href: "/portfolio", keywords: "case studies work projects" },
  { title: "Blog", href: "/blog", keywords: "articles insights news" },
  { title: "Pricing", href: "/pricing", keywords: "plans packages cost" },
  { title: "Careers", href: "/careers", keywords: "jobs hiring work with us" },
  { title: "Contact", href: "/contact", keywords: "contact support reach us" },
  ...servicesMenu.flatMap((c) => c.items.map((i) => ({ title: i.title, href: i.href, keywords: `${c.heading} ${i.description}` }))),
  ...solutionsMenu.flatMap((c) => c.items.map((i) => ({ title: i.title, href: i.href, keywords: `${c.heading} ${i.description}` }))),
];

export const contactInfo = {
  phone: "+923103175175",
  whatsapp: "923120141581",
  email: "info@bitsolmarketing.com",
  social: {
    linkedin: "https://www.linkedin.com/company/bitsolpvtltd/",
    instagram: "https://www.instagram.com/bitsol_marketing/",
    facebook: "https://www.facebook.com/bitsolmarketing/",
  },
};
