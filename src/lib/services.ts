import {
  Rocket,
  Brain,
  Globe,
  Smartphone,
  Search,
  TrendingUp,
  PenTool,
  Palette,
} from "lucide-react";

export interface ServiceFAQ {
  question: string;
  answer: string;
}

export interface Service {
  slug: string;
  title: string;
  desc: string;
  fullDesc: string;
  metaTitle: string;
  metaDescription: string;
  icon: typeof Brain;
  iconBg: string;
  iconColor: string;
  features: string[];
  benefits: string[];
  processSteps: { step: string; detail: string }[];
  faq: ServiceFAQ[];
}

export const services: Service[] = [
  {
    slug: "ai-automation",
    title: "AI Automation",
    desc: "Scale your business with intelligent autonomous workflows and custom AI agents.",
    fullDesc:
      "BITSOL Marketing builds custom AI automation systems that eliminate repetitive work and unlock exponential productivity for businesses in Pakistan and globally. Our engineers design LLM-powered agents, predictive analytics pipelines, and end-to-end workflow automation that integrate with your existing tools — from CRMs to ERPs to WhatsApp. Whether you need a customer service bot that handles 500 queries a day, a lead qualification agent, or a data pipeline that predicts churn before it happens, we architect AI solutions that scale with your ambitions. Every system we deploy is trained on your specific business context, tested rigorously, and monitored continuously so it keeps improving over time.",
    metaTitle: "AI Automation Services in Pakistan",
    metaDescription:
      "Custom AI automation for businesses in Pakistan: LLM agents, workflow automation, chatbots and predictive analytics. Book a free consultation.",
    icon: Brain,
    iconBg: "#00D9FF1A",
    iconColor: "#00D9FF",
    features: [
      "Custom GPT & LLM Training",
      "Workflow Automation Agents",
      "Predictive Data Analytics",
      "Neural Network Architecture",
    ],
    benefits: [
      "Reduce manual workload by 40–60% within the first 90 days of deployment.",
      "Respond to customers 24/7 with AI agents that sound human and resolve issues autonomously.",
      "Make smarter business decisions using predictive models trained on your own data.",
      "Scale operations without scaling headcount — our AI systems grow as your business grows.",
    ],
    processSteps: [
      { step: "Discovery", detail: "We audit your current workflows and identify the highest-ROI automation opportunities." },
      { step: "Architecture", detail: "We design your AI system — model selection, data pipelines, integration points, and fallback logic." },
      { step: "Training & Testing", detail: "We train LLMs on your business data, run adversarial testing, and validate accuracy thresholds." },
      { step: "Integration", detail: "We deploy into your existing stack — CRM, WhatsApp, website, ERP — with zero downtime." },
      { step: "Monitoring", detail: "We track performance, retrain models as needed, and provide monthly improvement reports." },
    ],
    faq: [
      {
        question: "How long does it take to build a custom AI automation system?",
        answer: "Simple workflow automation (like chatbots or email responders) typically takes 2–4 weeks. Complex multi-agent systems with custom LLM training take 6–12 weeks. We provide a detailed timeline after the discovery call.",
      },
      {
        question: "Do I need technical knowledge to use the AI systems BITSOL builds?",
        answer: "No. We build AI automation with non-technical business owners in mind. All systems include dashboards, simple controls, and hands-on training so your team can run them without developers.",
      },
      {
        question: "Can BITSOL integrate AI automation with WhatsApp?",
        answer: "Yes. WhatsApp AI automation is one of our most popular services in Pakistan. We build WhatsApp bots that handle customer queries, send order updates, collect leads, and qualify prospects — all automatically.",
      },
      {
        question: "What industries do you serve with AI automation?",
        answer: "We serve e-commerce, real estate, healthcare, education, finance, retail, and professional services businesses across Pakistan and the GCC region.",
      },
      {
        question: "How much does AI automation cost in Pakistan?",
        answer: "Pricing depends on complexity. Simple chatbots start from PKR 50,000. Full custom LLM agents with integrations range from PKR 200,000–500,000+. We offer flexible payment plans for Pakistani businesses.",
      },
    ],
  },
  {
    slug: "digital-marketing",
    title: "Digital Marketing",
    desc: "Data-driven strategies that dominate search results and social media engagement.",
    fullDesc:
      "BITSOL Marketing delivers full-funnel digital marketing for businesses in Pakistan that want real, measurable growth — not vanity metrics. Our team combines psychological insight with algorithmic precision to build marketing systems that attract the right audience, convert them into buyers, and turn buyers into loyal brand advocates. We manage everything from Meta and Google ad campaigns to social media content, email sequences, and conversion rate optimization. Every rupee of your marketing budget is tracked, attributed, and optimized. Our clients in Karachi, Lahore, and Islamabad consistently see 3–10x returns on their ad spend within the first 60 days of working with us. We don't run campaigns; we build growth engines.",
    metaTitle: "Digital Marketing Services in Pakistan",
    metaDescription:
      "Digital marketing services in Pakistan: Meta Ads, Google Ads, social media, CRO and email marketing for businesses in Karachi, Lahore and Islamabad.",
    icon: Rocket,
    iconBg: "#7C3AED1A",
    iconColor: "#7C3AED",
    features: [
      "Algorithmic Media Buying",
      "Conversion Rate Optimization",
      "Social Media Management",
      "Marketing Automation Stacks",
    ],
    benefits: [
      "Generate consistent, qualified leads every month with predictable ad spend.",
      "Build a recognisable brand across Meta, Google, LinkedIn, and TikTok simultaneously.",
      "Stop wasting budget on untargeted ads — every campaign is audience-specific and intent-driven.",
      "Get complete transparency with weekly performance reports and live dashboards.",
    ],
    processSteps: [
      { step: "Audit", detail: "We audit your existing digital presence, ad accounts, and competitors to find the gaps." },
      { step: "Strategy", detail: "We build a custom growth strategy with channel allocation, budget split, and 90-day KPIs." },
      { step: "Creative Production", detail: "Our team produces ad creatives, copy, and landing pages optimised for conversion." },
      { step: "Launch & Optimise", detail: "We launch campaigns and run daily optimisations — audience testing, bid adjustments, creative rotation." },
      { step: "Report & Scale", detail: "Monthly strategy calls with full performance data. We scale what works, cut what doesn't." },
    ],
    faq: [
      {
        question: "How quickly can I see results from digital marketing in Pakistan?",
        answer: "Paid campaigns (Meta Ads, Google Ads) typically show results within 7–14 days of launch. SEO and organic growth take 3–6 months to build momentum. We set realistic timelines from day one.",
      },
      {
        question: "What is a good monthly budget for digital marketing in Pakistan?",
        answer: "We recommend a minimum ad spend of PKR 50,000–100,000/month for meaningful results. Smaller budgets work for local businesses; larger brands typically invest PKR 300,000–1,000,000+/month.",
      },
      {
        question: "Do you manage Facebook and Instagram ads for Pakistani businesses?",
        answer: "Yes. Meta advertising (Facebook + Instagram) is one of our core services. We handle setup, creative, audience targeting, A/B testing, and daily optimisation for businesses across Pakistan.",
      },
      {
        question: "Can you help with Google Ads in Pakistan?",
        answer: "Absolutely. We run Search, Display, Shopping, and Performance Max campaigns on Google for Pakistani businesses. We are certified Google Ads partners with experience scaling accounts from PKR 50K to PKR 2M+ monthly spend.",
      },
      {
        question: "Do you offer social media management along with paid advertising?",
        answer: "Yes. We offer bundled packages that include content creation, scheduling, community management, and paid amplification across Instagram, Facebook, LinkedIn, and TikTok.",
      },
    ],
  },
  {
    slug: "web-development",
    title: "Web Development",
    desc: "Futuristic, high-performance web applications built with the latest technologies.",
    fullDesc:
      "BITSOL Marketing engineers high-performance websites and web applications for businesses in Pakistan that demand more than a basic WordPress template. We build on Next.js, React, and edge computing infrastructure to deliver sub-second load times, pixel-perfect designs, and conversion-optimised user experiences. Our development team has shipped 150+ projects ranging from e-commerce stores and SaaS platforms to real estate portals and fintech dashboards. Every site we build is SEO-ready from day one — structured data, Core Web Vitals compliance, mobile-first architecture, and server-side rendering baked in. If your website is slow, outdated, or failing to convert visitors into leads, we rebuild it to perform.",
    metaTitle: "Web Development Company in Pakistan",
    metaDescription:
      "Web development company in Pakistan building fast, SEO-ready Next.js, React, e-commerce and SaaS websites for Karachi, Lahore and Islamabad.",
    icon: Globe,
    iconBg: "#00D9FF1A",
    iconColor: "#00D9FF",
    features: [
      "Next.js & React Architectures",
      "Interactive 3D Web Experiences",
      "Scalable Microservices Backend",
      "Cloud-Native Infrastructure",
    ],
    benefits: [
      "Launch a website that loads in under 2 seconds — fast sites rank higher and convert more.",
      "Own a site built on scalable architecture that can handle 100 or 100,000 visitors without breaking.",
      "Every page is SEO-optimised with proper schema, canonical URLs, and Core Web Vitals compliance.",
      "Get a mobile-first design that delivers a flawless experience on every screen size.",
    ],
    processSteps: [
      { step: "Discovery", detail: "We scope your requirements, study competitors, and define the technical architecture." },
      { step: "Design", detail: "Our UI/UX team creates wireframes and high-fidelity Figma designs aligned with your brand." },
      { step: "Development", detail: "We build in sprints with weekly demos — Next.js frontend, scalable backend, cloud deployment." },
      { step: "SEO & Performance", detail: "We run Lighthouse audits, implement schema markup, and optimise Core Web Vitals before launch." },
      { step: "Launch & Support", detail: "We handle deployment, DNS, and provide 3 months of post-launch support." },
    ],
    faq: [
      {
        question: "How much does a professional website cost in Pakistan?",
        answer: "A basic business website starts from PKR 80,000–150,000. E-commerce stores range from PKR 200,000–500,000. Custom SaaS or portal projects start from PKR 500,000+. We provide detailed quotes after understanding your requirements.",
      },
      {
        question: "How long does web development take?",
        answer: "Simple brochure sites take 2–3 weeks. E-commerce stores take 4–8 weeks. Complex web applications take 3–6 months. We follow agile sprints with weekly deliverables so you always know the progress.",
      },
      {
        question: "Do you build websites on WordPress or custom code?",
        answer: "We build on Next.js/React for clients who need performance and SEO superiority. We also build on WordPress for clients who need a simple CMS. We recommend the best technology for your specific goals.",
      },
      {
        question: "Is SEO included in the website development?",
        answer: "Yes. Every website we build includes technical SEO foundations — proper heading structure, schema markup, canonical URLs, sitemap, robots.txt, Core Web Vitals optimisation, and mobile responsiveness.",
      },
      {
        question: "Do you provide website maintenance after launch?",
        answer: "Yes. We offer monthly maintenance packages that include security updates, performance monitoring, content updates, and priority bug fixes.",
      },
    ],
  },
  {
    slug: "mobile-apps",
    title: "Mobile Apps",
    desc: "Immersive iOS and Android experiences designed for maximum user retention.",
    fullDesc:
      "BITSOL Marketing builds native and cross-platform mobile applications for Pakistani businesses ready to serve customers on their phones. Our mobile team has shipped apps on the Apple App Store and Google Play Store across fintech, healthtech, e-commerce, and on-demand service categories. We use Flutter for cross-platform efficiency and native Swift/Kotlin for performance-critical applications. Every app we build includes biometric authentication, real-time sync, push notification infrastructure, and analytics dashboards so you can track user behaviour and improve retention. From MVP to full-scale launch, we handle UX design, engineering, QA, and App Store submission — you just bring the idea.",
    metaTitle: "Mobile App Development in Pakistan",
    metaDescription:
      "Mobile app development in Pakistan: native iOS, Android and Flutter apps for e-commerce, fintech, healthcare and on-demand businesses. Get a quote.",
    icon: Smartphone,
    iconBg: "#7C3AED1A",
    iconColor: "#7C3AED",
    features: [
      "Native iOS & Android Development",
      "Cross-Platform Flutter Solutions",
      "Real-time Data Sync",
      "Biometric Security Integration",
    ],
    benefits: [
      "Reach your customers where they spend 4+ hours a day — on their phones.",
      "Reduce churn with push notifications, personalised in-app experiences, and loyalty features.",
      "Launch on both iOS and Android simultaneously with Flutter — at a fraction of the cost of two native apps.",
      "Enterprise-grade security with biometric auth, encrypted storage, and secure API communication.",
    ],
    processSteps: [
      { step: "Concept & UX", detail: "We map user journeys, create wireframes, and validate the UX before writing a line of code." },
      { step: "Design", detail: "Pixel-perfect UI design in Figma with your brand identity, animations, and interaction patterns." },
      { step: "Development", detail: "Agile sprints with working builds delivered every 2 weeks for your feedback." },
      { step: "QA & Testing", detail: "Rigorous testing on real devices — functional, performance, security, and accessibility." },
      { step: "Launch", detail: "We handle App Store and Play Store submission, review responses, and post-launch monitoring." },
    ],
    faq: [
      {
        question: "How much does mobile app development cost in Pakistan?",
        answer: "Simple apps start from PKR 300,000–500,000. Mid-complexity apps with backend and admin panel range from PKR 500,000–1,500,000. Enterprise apps start from PKR 2,000,000+. We provide detailed quotes after the discovery call.",
      },
      {
        question: "How long does it take to build a mobile app?",
        answer: "An MVP (minimum viable product) typically takes 8–12 weeks. Full-featured apps take 4–6 months. We use agile sprints so you see progress every 2 weeks.",
      },
      {
        question: "Should I build a native app or use Flutter?",
        answer: "Flutter is ideal for most businesses — one codebase, both platforms, 80% cost saving. Native (Swift/Kotlin) is better when you need maximum performance or deep hardware integration. We recommend the right approach after understanding your needs.",
      },
      {
        question: "Can you add AI features to our mobile app?",
        answer: "Yes. We integrate AI capabilities including personalised recommendations, voice interfaces, image recognition, and predictive analytics into mobile apps.",
      },
      {
        question: "Do you handle App Store submission and approval?",
        answer: "Yes. We handle the full App Store (Apple) and Play Store (Google) submission process, respond to review feedback, and ensure compliance with all platform guidelines.",
      },
    ],
  },
  {
    slug: "seo-optimization",
    title: "SEO Services",
    desc: "Result-driven SEO and Google Business Profile optimization to rank higher and get found locally.",
    fullDesc:
      "BITSOL Marketing delivers comprehensive SEO services that drive sustainable organic growth for businesses in Pakistan and beyond. Our SEO team combines technical excellence, topic cluster content strategy, and authority link building to push your pages to page one of Google. We specialise in local SEO for Karachi, Lahore, and Islamabad businesses — including full Google Business Profile (GBP) optimisation to dominate the Google Map Pack for local searches. From technical audits and on-page optimisation to link building and AI Overview optimisation, we run every element of the SEO process. Our clients consistently see first-page rankings within 60–90 days for local keywords and 3–6 months for competitive national terms.",
    metaTitle: "SEO Services & Local SEO in Pakistan",
    metaDescription:
      "SEO agency in Pakistan offering technical SEO, local SEO, Google Business Profile optimization, content strategy and link building. Free SEO audit.",
    icon: Search,
    iconBg: "#00D9FF1A",
    iconColor: "#00D9FF",
    features: [
      "Google Business Profile Optimization",
      "Technical SEO & Core Web Vitals",
      "Local SEO for Pakistani Cities",
      "AI-Powered Keyword Intelligence",
    ],
    benefits: [
      "Rank on page one for your highest-value keywords and capture buyers at the moment of intent.",
      "Appear in Google Maps and Local Pack for searches in Karachi, Lahore, and Islamabad.",
      "Build a compounding organic traffic channel that reduces dependency on paid ads over time.",
      "Future-proof your visibility in AI-generated search results (Google AI Overviews, ChatGPT, Perplexity).",
    ],
    processSteps: [
      { step: "Technical Audit", detail: "Full site crawl — indexation, Core Web Vitals, schema, canonicals, internal linking, and mobile performance." },
      { step: "Keyword Strategy", detail: "Topic cluster mapping with search volume, intent classification, and competitive difficulty scoring." },
      { step: "On-Page Optimisation", detail: "Title tags, meta descriptions, H1/H2 structure, schema markup, and content depth improvements." },
      { step: "GBP & Local SEO", detail: "Google Business Profile setup, optimisation, review strategy, and local citation building." },
      { step: "Link Building", detail: "White-hat backlink acquisition through digital PR, directory citations, and strategic outreach." },
    ],
    faq: [
      {
        question: "How long does SEO take to show results in Pakistan?",
        answer: "Measurable ranking improvements typically appear in 60–90 days for local and low-competition keywords and 4–6 months for competitive terms. Organic traffic compounds over time — the longer you invest, the higher the returns.",
      },
      {
        question: "How much do SEO services cost in Pakistan?",
        answer: "Basic local SEO starts from PKR 25,000/month. Comprehensive national SEO ranges from PKR 50,000–150,000/month. Enterprise and e-commerce SEO starts from PKR 150,000/month. All plans include monthly reporting.",
      },
      {
        question: "Do you offer Google Business Profile optimization?",
        answer: "Yes. Google Business Profile (GBP) optimisation is a core part of our local SEO service. We set up and fully optimise your GBP listing, manage reviews, add posts, and build citations to rank your business in the Google Map Pack.",
      },
      {
        question: "Do you offer local SEO for businesses in Karachi, Lahore and Islamabad?",
        answer: "Yes. Local SEO is one of our strongest services. We optimise your Google Business Profile, build local citations, create city-specific landing pages, and build links from Pakistan-relevant domains to dominate local search results.",
      },
      {
        question: "Can you recover a website from a Google penalty?",
        answer: "Yes. We have experience recovering sites from manual actions and algorithmic penalties (Helpful Content Updates, Core Updates, link-based penalties). Recovery typically takes 3–6 months with a proper remediation plan.",
      },
    ],
  },
  {
    slug: "trading-tech",
    title: "Trading Tech",
    desc: "Advanced algorithmic trading systems for PSX, PMEX, and Crypto markets.",
    fullDesc:
      "BITSOL Marketing engineers institutional-grade algorithmic trading technology for investors and trading firms operating on the Pakistan Stock Exchange (PSX), PMEX, and global crypto markets. Our trading systems combine low-latency execution architecture with machine learning models that identify alpha-generating opportunities in real time. We build custom trading bots, backtesting frameworks, portfolio risk management dashboards, and market-making algorithms tailored to your strategy. Whether you are a proprietary trading desk, an asset manager, or an individual investor ready to automate your edge, our team brings the same engineering rigour used by global quantitative hedge funds — packaged for the Pakistani market.",
    metaTitle: "Algorithmic Trading Software in Pakistan",
    metaDescription:
      "Custom algorithmic trading software for PSX, PMEX and crypto markets: trading bots, backtesting and AI risk management. Free consultation.",
    icon: TrendingUp,
    iconBg: "#7C3AED1A",
    iconColor: "#7C3AED",
    features: [
      "Algorithmic Execution Engines",
      "Market Making Algorithms",
      "Real-time Portfolio Risk AI",
      "Low-Latency API Integration",
    ],
    benefits: [
      "Remove emotion from trading decisions with rule-based algorithms that execute your strategy consistently.",
      "Backtest strategies against years of historical PSX, PMEX, and crypto data before risking real capital.",
      "Monitor portfolio risk in real time with AI-powered drawdown alerts and position sizing recommendations.",
      "Execute trades in milliseconds with low-latency infrastructure designed for competitive market microstructure.",
    ],
    processSteps: [
      { step: "Strategy Definition", detail: "We document your trading rules, risk parameters, and performance benchmarks." },
      { step: "Backtesting", detail: "We build and run your strategy against historical data to validate statistical edge." },
      { step: "System Architecture", detail: "We design the execution engine, data feeds, broker API integration, and risk controls." },
      { step: "Paper Trading", detail: "We deploy in simulation mode against live markets to validate real-world performance before going live." },
      { step: "Live Deployment", detail: "We go live with monitoring dashboards, alert systems, and ongoing strategy refinement." },
    ],
    faq: [
      {
        question: "Can you build a trading bot for the Pakistan Stock Exchange (PSX)?",
        answer: "Yes. We build custom algorithmic trading systems for PSX including equity trading bots, options strategies, and market-making algorithms. We integrate with PSX-compliant broker APIs.",
      },
      {
        question: "How much does a custom trading bot cost in Pakistan?",
        answer: "Simple signal-based trading bots start from PKR 150,000. Full algorithmic trading systems with backtesting, risk management, and live execution range from PKR 400,000–1,500,000+.",
      },
      {
        question: "Do you build crypto trading bots?",
        answer: "Yes. We build crypto trading bots for Binance, Bybit, OKX, and other major exchanges. Strategies include grid trading, trend following, arbitrage, and market making.",
      },
      {
        question: "Is algorithmic trading legal in Pakistan?",
        answer: "Algorithmic trading for personal investment is legal in Pakistan. Firms offering automated trading to clients must comply with SECP regulations. We ensure all systems we build meet applicable regulatory requirements.",
      },
      {
        question: "Can I run a trading bot without programming knowledge?",
        answer: "Yes. We build trading systems with visual dashboards and simple controls. You can monitor positions, pause strategies, and adjust risk parameters without writing a single line of code.",
      },
    ],
  },
  {
    slug: "content-marketing",
    title: "Content Marketing",
    desc: "Strategic content that attracts, engages, and converts your ideal audience at every stage.",
    fullDesc:
      "BITSOL Marketing builds content marketing systems for businesses in Pakistan that generate qualified leads and establish authority — not just blog posts that nobody reads. Our content team creates SEO-optimised articles, case studies, email sequences, video scripts, social media content, and lead magnets that move prospects through your sales funnel. Every piece of content we produce is mapped to a specific keyword, a specific buyer persona, and a specific stage of the customer journey. We measure content performance by organic traffic, leads generated, and revenue attributed — not page views. Whether you need a 12-month editorial calendar, a weekly blog service, or a complete inbound marketing system, we build content that compounds in value over time.",
    metaTitle: "Content Marketing Agency in Pakistan",
    metaDescription:
      "Content marketing for businesses in Pakistan: SEO blog content, email sequences, social media copy and lead magnets that generate qualified leads.",
    icon: PenTool,
    iconBg: "#00D9FF1A",
    iconColor: "#00D9FF",
    features: [
      "SEO-Optimised Blog & Article Writing",
      "Email Marketing Sequences",
      "Social Media Content Production",
      "Lead Magnet & Landing Page Copy",
    ],
    benefits: [
      "Attract qualified prospects to your website through content that ranks on Google.",
      "Build authority in your industry so buyers trust you before they've even spoken to your team.",
      "Generate leads 24/7 through evergreen content that keeps producing results long after it's published.",
      "Reduce paid ad dependency as organic content compounds into a self-sustaining traffic channel.",
    ],
    processSteps: [
      { step: "Content Audit", detail: "We audit your existing content, identify gaps, and map your buyer's journey." },
      { step: "Strategy & Calendar", detail: "We build a 90-day content calendar with keyword targets, formats, and distribution channels." },
      { step: "Production", detail: "Our writers produce SEO-optimised content reviewed by subject matter experts before publishing." },
      { step: "Distribution", detail: "We publish, distribute via email and social, and promote content to build backlinks and reach." },
      { step: "Measure & Optimise", detail: "Monthly reporting on organic traffic, leads generated, and top-performing content. We update underperforming articles." },
    ],
    faq: [
      {
        question: "How much does content marketing cost in Pakistan?",
        answer: "Content marketing packages start from PKR 30,000/month for 4 SEO-optimised articles. Full-service inbound marketing (content + email + social + distribution) starts from PKR 80,000/month.",
      },
      {
        question: "How long before content marketing generates results?",
        answer: "SEO content typically starts ranking within 2–4 months of publishing. The compounding effect — where each article adds to your organic traffic base — becomes significant at the 6–12 month mark.",
      },
      {
        question: "Do you write content in English and Urdu?",
        answer: "Yes. We produce content in both English and Urdu depending on your target audience. English content targets international and urban Pakistani audiences; Urdu content reaches a broader domestic Pakistani audience.",
      },
      {
        question: "Can you handle social media content production?",
        answer: "Yes. Our content service includes social media post production for Instagram, Facebook, LinkedIn, and TikTok — captions, graphics briefs, and video scripts. We can also manage scheduling and publishing.",
      },
      {
        question: "Does content marketing work for B2B businesses in Pakistan?",
        answer: "Absolutely. B2B content marketing — case studies, industry guides, LinkedIn articles, and email nurture sequences — is one of the most effective lead generation channels for Pakistani B2B businesses targeting decision-makers.",
      },
    ],
  },
  {
    slug: "branding",
    title: "Branding",
    desc: "Strategic brand identity that builds recognition, trust, and premium positioning.",
    fullDesc:
      "BITSOL Marketing builds brand identities for Pakistani businesses that want to look as professional as international agencies — and charge accordingly. Our branding team covers everything from brand strategy and naming to logo design, visual identity systems, brand guidelines, and brand voice frameworks. We don't just design logos; we build the complete system that ensures your brand is consistent and recognisable across your website, social media, packaging, signage, and sales materials. Whether you're launching a new brand, rebranding an existing business, or building a sub-brand for a new product, we deliver brand assets that command trust and justify premium pricing. Our clients consistently report that professional branding directly impacts their ability to close deals with larger clients and charge higher fees.",
    metaTitle: "Branding & Logo Design Agency in Pakistan",
    metaDescription:
      "Branding agency in Pakistan for logo design, brand identity, visual systems and brand guidelines. Serving Karachi, Lahore and Islamabad.",
    icon: Palette,
    iconBg: "#7C3AED1A",
    iconColor: "#7C3AED",
    features: [
      "Brand Strategy & Positioning",
      "Logo & Visual Identity Design",
      "Brand Guidelines & Style Guide",
      "Brand Voice & Messaging Framework",
    ],
    benefits: [
      "Command higher prices with a brand that communicates professionalism and quality from first impression.",
      "Build instant recognition with a consistent visual identity across every customer touchpoint.",
      "Differentiate from competitors with a brand strategy that owns a specific positioning in your market.",
      "Scale marketing faster — consistent brand assets make every campaign, post, and ad more effective.",
    ],
    processSteps: [
      { step: "Brand Discovery", detail: "We run a brand strategy workshop — positioning, audience, competitors, values, and differentiation." },
      { step: "Strategy Document", detail: "We deliver a brand strategy document: positioning statement, value proposition, and target audience profiles." },
      { step: "Visual Identity", detail: "Logo design (3 concepts), colour palette, typography, and core brand elements." },
      { step: "Brand Guidelines", detail: "Comprehensive brand guidelines covering logo usage, colours, fonts, photography style, and dos and don'ts." },
      { step: "Asset Production", detail: "We produce all required brand assets — social templates, business cards, email signatures, and letterheads." },
    ],
    faq: [
      {
        question: "How much does branding cost in Pakistan?",
        answer: "Logo and basic brand identity packages start from PKR 50,000. Full brand identity with strategy, logo, guidelines, and asset production ranges from PKR 150,000–400,000. Enterprise rebranding projects are priced on scope.",
      },
      {
        question: "How long does a branding project take?",
        answer: "A logo-only project takes 2–3 weeks. A full brand identity with guidelines takes 4–6 weeks. Comprehensive brand strategy + identity projects take 6–10 weeks.",
      },
      {
        question: "Do you offer rebranding for existing businesses?",
        answer: "Yes. Rebranding is one of our most common branding projects. We audit your current brand, identify what's working and what's not, and build a new identity that retains brand equity while projecting a more professional image.",
      },
      {
        question: "Do you design logos in vector format for print and digital?",
        answer: "Yes. All logos are delivered in vector format (AI, EPS, SVG) suitable for any size — from business cards to billboards. We also provide PNG and JPG versions in all required dimensions for digital use.",
      },
      {
        question: "Can you create social media templates as part of the branding?",
        answer: "Yes. Our branding packages include branded social media templates for Instagram, Facebook, and LinkedIn — so your team can create on-brand posts without a designer for every piece of content.",
      },
    ],
  },
];
