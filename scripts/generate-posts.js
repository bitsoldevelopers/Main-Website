const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(__dirname, "..", "social-posts");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

const CYAN = "#00D9FF";
const PURPLE = "#7C3AED";
const DARK = "#050816";
const SLATE = "#0F172A";
const MUTED = "#94A3B8";
const WHITE = "#FFFFFF";
const FONT = "'Montserrat', 'Segoe UI', sans-serif";

const noise = `
  <svg style="position:absolute;inset:0;width:100%;height:100%;opacity:0.03;pointer-events:none;" xmlns="http://www.w3.org/2000/svg">
    <filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="4" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>
    <rect width="100%" height="100%" filter="url(#noise)"/>
  </svg>`;

const grid = `
  <svg style="position:absolute;inset:0;width:100%;height:100%;opacity:0.04;pointer-events:none;" xmlns="http://www.w3.org/2000/svg">
    <defs><pattern id="g" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M 60 0 L 0 0 0 60" fill="none" stroke="${CYAN}" stroke-width="0.5"/></pattern></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
  </svg>`;

const logo = `<div style="display:flex;align-items:center;gap:10px;">
  <div style="width:36px;height:36px;background:linear-gradient(135deg,${CYAN},${PURPLE});border-radius:8px;display:flex;align-items:center;justify-content:center;">
    <span style="color:#fff;font-weight:900;font-size:14px;">B</span>
  </div>
  <span style="font-weight:800;font-size:14px;letter-spacing:1px;color:${WHITE};">BITSOL <span style="color:${CYAN};">MARKETING</span></span>
</div>`;

const tag = (text) =>
  `<span style="display:inline-block;padding:4px 14px;border-radius:50px;background:${CYAN}22;border:1px solid ${CYAN}44;color:${CYAN};font-size:10px;font-weight:800;letter-spacing:2px;text-transform:uppercase;">${text}</span>`;

function wrap(content) {
  return `<!DOCTYPE html><html><head>
  <meta charset="UTF-8">
  <style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif;}</style>
  </head>
  <body style="width:1080px;height:1080px;overflow:hidden;font-family:${FONT};background:${DARK};position:relative;">
    ${noise}${grid}
    <!-- corner glow top-left -->
    <div style="position:absolute;top:-200px;left:-200px;width:600px;height:600px;border-radius:50%;background:radial-gradient(circle,${CYAN}18 0%,transparent 70%);pointer-events:none;"></div>
    <!-- corner glow bottom-right -->
    <div style="position:absolute;bottom:-200px;right:-200px;width:600px;height:600px;border-radius:50%;background:radial-gradient(circle,${PURPLE}18 0%,transparent 70%);pointer-events:none;"></div>
    <!-- top bar -->
    <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,${CYAN},${PURPLE});"></div>
    <!-- header -->
    <div style="position:absolute;top:36px;left:50px;right:50px;display:flex;justify-content:space-between;align-items:center;">
      ${logo}
      <span style="font-size:11px;color:${MUTED};letter-spacing:1px;">bitsolmarketing.com</span>
    </div>
    <!-- main content -->
    <div style="position:absolute;top:110px;left:50px;right:50px;bottom:90px;display:flex;flex-direction:column;justify-content:center;">
      ${content}
    </div>
    <!-- footer -->
    <div style="position:absolute;bottom:0;left:0;right:0;height:3px;background:linear-gradient(90deg,${PURPLE},${CYAN});"></div>
    <div style="position:absolute;bottom:20px;left:50px;right:50px;display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:10px;color:${MUTED}44;letter-spacing:1px;">AI DIGITAL MARKETING AGENCY · PAKISTAN</span>
      <span style="font-size:10px;color:${MUTED}44;">+92 312 014 1581</span>
    </div>
  </body></html>`;
}

const posts = [
  // 1 – Hero Brand
  {
    name: "01-hero-brand",
    html: wrap(`
      <div style="text-align:center;">
        ${tag("Pakistan's Premier AI Agency")}
        <h1 style="margin-top:28px;font-size:82px;font-weight:900;line-height:1;color:${WHITE};">Architects of<br><span style="background:linear-gradient(90deg,${CYAN},${PURPLE});-webkit-background-clip:text;-webkit-text-fill-color:transparent;">Digital Future</span></h1>
        <p style="margin-top:28px;font-size:22px;color:${MUTED};max-width:700px;margin-left:auto;margin-right:auto;line-height:1.6;">AI-powered marketing that turns clicks into clients.</p>
        <div style="margin-top:44px;display:inline-block;padding:18px 48px;background:linear-gradient(135deg,${CYAN},${PURPLE});border-radius:50px;color:#fff;font-weight:800;font-size:18px;letter-spacing:1px;">Get Started Free</div>
      </div>`)
  },
  // 2 – Stats
  {
    name: "02-stats",
    html: wrap(`
      <div style="text-align:center;">
        ${tag("Proven Results")}
        <h2 style="margin-top:24px;font-size:52px;font-weight:900;color:${WHITE};">Numbers That <span style="color:${CYAN};">Speak</span></h2>
        <div style="margin-top:56px;display:grid;grid-template-columns:1fr 1fr;gap:32px;">
          ${[["25+","AI Experts"],["150+","Projects Delivered"],["2M+","Lines of Code"],["98%","Satisfied Clients"]].map(([n,l])=>`
          <div style="padding:36px 24px;background:${SLATE};border:1px solid ${CYAN}22;border-radius:20px;text-align:center;">
            <div style="font-size:64px;font-weight:900;background:linear-gradient(135deg,${CYAN},${PURPLE});-webkit-background-clip:text;-webkit-text-fill-color:transparent;">${n}</div>
            <div style="font-size:16px;color:${MUTED};margin-top:8px;font-weight:600;">${l}</div>
          </div>`).join("")}
        </div>
      </div>`)
  },
  // 3 – AI Automation
  {
    name: "03-ai-automation",
    html: wrap(`
      <div>
        ${tag("Service Spotlight")}
        <h2 style="margin-top:24px;font-size:64px;font-weight:900;color:${WHITE};line-height:1.05;">AI <span style="color:${CYAN};">Automation</span></h2>
        <p style="margin-top:20px;font-size:20px;color:${MUTED};line-height:1.7;max-width:740px;">We build intelligent workflows that eliminate repetitive tasks, reduce costs, and free your team to focus on growth.</p>
        <div style="margin-top:48px;display:flex;flex-direction:column;gap:20px;">
          ${["WhatsApp AI Chatbots","Lead Nurturing Workflows","CRM Automation","AI Voice Agents"].map(f=>`
          <div style="display:flex;align-items:center;gap:16px;">
            <div style="width:10px;height:10px;border-radius:50%;background:${CYAN};flex-shrink:0;"></div>
            <span style="font-size:20px;font-weight:600;color:${WHITE};">${f}</span>
          </div>`).join("")}
        </div>
        <div style="margin-top:52px;display:inline-block;padding:16px 40px;border:2px solid ${CYAN};border-radius:50px;color:${CYAN};font-weight:800;font-size:16px;">wa.me/923120141581</div>
      </div>`)
  },
  // 4 – SEO
  {
    name: "04-seo",
    html: wrap(`
      <div>
        ${tag("AI SEO Services")}
        <h2 style="margin-top:24px;font-size:64px;font-weight:900;color:${WHITE};line-height:1.05;">Rank #1 on<br><span style="background:linear-gradient(90deg,${CYAN},${PURPLE});-webkit-background-clip:text;-webkit-text-fill-color:transparent;">Google</span></h2>
        <p style="margin-top:20px;font-size:20px;color:${MUTED};line-height:1.7;max-width:700px;">Our AI-driven SEO strategies bring organic traffic that converts — not just rankings.</p>
        <div style="margin-top:44px;display:grid;grid-template-columns:1fr 1fr;gap:20px;">
          ${["Technical SEO","On-Page Optimization","Link Building","Content Strategy","Keyword Research","Local SEO"].map(f=>`
          <div style="display:flex;align-items:center;gap:12px;background:${SLATE};padding:14px 20px;border-radius:12px;border-left:3px solid ${CYAN};">
            <span style="font-size:16px;font-weight:600;color:${WHITE};">${f}</span>
          </div>`).join("")}
        </div>
      </div>`, CYAN)
  },
  // 5 – Meta Ads
  {
    name: "05-meta-ads",
    html: wrap(`
      <div>
        ${tag("Meta & Google Ads")}
        <h2 style="margin-top:24px;font-size:60px;font-weight:900;color:${WHITE};line-height:1.05;">Ads That<br><span style="color:${PURPLE};">Convert</span></h2>
        <p style="margin-top:20px;font-size:20px;color:${MUTED};line-height:1.7;max-width:700px;">Stop wasting ad budget. We build data-driven campaigns that deliver measurable ROI across Meta and Google.</p>
        <div style="margin-top:52px;display:flex;gap:24px;flex-wrap:wrap;">
          ${[["Facebook Ads","↗ 3.2x ROAS"],["Instagram Ads","↗ 41% CTR"],["Google Ads","↗ 67% Conversions"],["Retargeting","↗ 5x Revenue"]].map(([t,s])=>`
          <div style="flex:1;min-width:200px;padding:24px;background:${SLATE};border:1px solid ${PURPLE}33;border-radius:16px;">
            <div style="font-size:16px;font-weight:700;color:${WHITE};">${t}</div>
            <div style="font-size:14px;color:${CYAN};margin-top:8px;font-weight:700;">${s}</div>
          </div>`).join("")}
        </div>
      </div>`, PURPLE)
  },
  // 6 – Web Development
  {
    name: "06-web-development",
    html: wrap(`
      <div>
        ${tag("Web Development")}
        <h2 style="margin-top:24px;font-size:60px;font-weight:900;color:${WHITE};line-height:1.05;">Websites That<br><span style="color:${CYAN};">Win Business</span></h2>
        <p style="margin-top:20px;font-size:20px;color:${MUTED};line-height:1.7;max-width:700px;">From landing pages to enterprise platforms — we build fast, beautiful, and conversion-optimised web experiences.</p>
        <div style="margin-top:44px;display:flex;gap:16px;flex-wrap:wrap;">
          ${["Next.js","React","Node.js","PostgreSQL","Tailwind CSS","Vercel"].map(t=>`
          <span style="padding:10px 22px;border-radius:50px;background:${SLATE};border:1px solid ${CYAN}33;color:${WHITE};font-size:15px;font-weight:700;">${t}</span>`).join("")}
        </div>
      </div>`)
  },
  // 7 – Mobile Apps
  {
    name: "07-mobile-apps",
    html: wrap(`
      <div style="text-align:center;">
        ${tag("Mobile App Development")}
        <h2 style="margin-top:24px;font-size:62px;font-weight:900;color:${WHITE};line-height:1.05;">Apps Your Users<br><span style="background:linear-gradient(90deg,${CYAN},${PURPLE});-webkit-background-clip:text;-webkit-text-fill-color:transparent;">Love</span></h2>
        <p style="margin-top:20px;font-size:20px;color:${MUTED};line-height:1.7;max-width:700px;margin-left:auto;margin-right:auto;">Cross-platform mobile apps for iOS & Android that deliver seamless user experiences and real business results.</p>
        <div style="margin-top:52px;display:flex;justify-content:center;gap:40px;">
          ${[["iOS","App Store"],["Android","Google Play"],["React Native","Cross-Platform"]].map(([p,s])=>`
          <div style="text-align:center;">
            <div style="font-size:22px;font-weight:900;color:${WHITE};">${p}</div>
            <div style="font-size:13px;color:${MUTED};margin-top:6px;">${s}</div>
          </div>`).join("")}
        </div>
      </div>`, PURPLE)
  },
  // 8 – Trading Tech
  {
    name: "08-trading-tech",
    html: wrap(`
      <div>
        ${tag("Algorithmic Trading")}
        <h2 style="margin-top:24px;font-size:60px;font-weight:900;color:${WHITE};line-height:1.05;">Trading<br><span style="color:${CYAN};">Automation</span></h2>
        <p style="margin-top:20px;font-size:20px;color:${MUTED};line-height:1.7;max-width:700px;">Custom algorithmic trading systems for PSX and crypto markets — built with AI-powered signals and risk management.</p>
        <div style="margin-top:48px;display:flex;flex-direction:column;gap:18px;">
          ${["PSX / KSE-100 Algo Bots","Crypto Trading Systems","Risk Management Engines","Custom Trading Dashboards"].map(f=>`
          <div style="display:flex;align-items:center;gap:16px;padding:16px 24px;background:${SLATE};border-left:3px solid ${CYAN};border-radius:12px;">
            <span style="font-size:18px;font-weight:600;color:${WHITE};">${f}</span>
          </div>`).join("")}
        </div>
      </div>`)
  },
  // 9 – WhatsApp Automation
  {
    name: "09-whatsapp-automation",
    html: wrap(`
      <div>
        ${tag("WhatsApp Business AI")}
        <h2 style="margin-top:24px;font-size:60px;font-weight:900;color:${WHITE};line-height:1.05;">Automate Your<br><span style="color:#25D366;">WhatsApp</span></h2>
        <p style="margin-top:20px;font-size:20px;color:${MUTED};line-height:1.7;max-width:700px;">AI-powered WhatsApp chatbots that handle inquiries, qualify leads, and close sales — 24/7, automatically.</p>
        <div style="margin-top:44px;padding:32px;background:${SLATE};border:1px solid #25D36633;border-radius:20px;display:flex;align-items:center;gap:24px;">
          <div style="width:64px;height:64px;background:#25D36622;border-radius:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <span style="font-size:32px;">💬</span>
          </div>
          <div>
            <div style="font-size:20px;font-weight:800;color:${WHITE};">Chat with us now</div>
            <div style="font-size:16px;color:#25D366;margin-top:6px;font-weight:700;">wa.me/923120141581</div>
          </div>
        </div>
      </div>`)
  },
  // 10 – Pricing Starter
  {
    name: "10-pricing-starter",
    html: wrap(`
      <div style="text-align:center;">
        ${tag("Starter Plan")}
        <div style="margin-top:24px;font-size:100px;font-weight:900;background:linear-gradient(135deg,${CYAN},${PURPLE});-webkit-background-clip:text;-webkit-text-fill-color:transparent;line-height:1;">$500</div>
        <div style="font-size:18px;color:${MUTED};margin-top:4px;">per month</div>
        <p style="margin-top:20px;font-size:18px;color:${MUTED};">For startups ready to grow with AI marketing</p>
        <div style="margin-top:36px;display:flex;flex-direction:column;gap:14px;max-width:600px;margin-left:auto;margin-right:auto;">
          ${["AI-powered SEO audit","2× social channels managed","Meta Ads setup (up to $1k spend)","WhatsApp Business integration","Monthly analytics report"].map(f=>`
          <div style="display:flex;align-items:center;gap:12px;text-align:left;">
            <div style="width:8px;height:8px;border-radius:50%;background:${CYAN};flex-shrink:0;"></div>
            <span style="font-size:17px;color:${WHITE};font-weight:500;">${f}</span>
          </div>`).join("")}
        </div>
      </div>`)
  },
  // 11 – Pricing Growth
  {
    name: "11-pricing-growth",
    html: wrap(`
      <div style="text-align:center;">
        <div style="display:inline-block;padding:6px 20px;background:${CYAN};border-radius:50px;color:#000;font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;">Most Popular</div>
        <div style="margin-top:20px;font-size:100px;font-weight:900;background:linear-gradient(135deg,${PURPLE},${CYAN});-webkit-background-clip:text;-webkit-text-fill-color:transparent;line-height:1;">$1,500</div>
        <div style="font-size:18px;color:${MUTED};margin-top:4px;">Growth Plan · per month</div>
        <div style="margin-top:32px;display:flex;flex-direction:column;gap:12px;max-width:680px;margin-left:auto;margin-right:auto;">
          ${["Everything in Starter +","Advanced SEO — technical & link building","Google Ads + Meta Ads (up to $5k spend)","AI chatbot development","4× monthly blog posts","Bi-weekly strategy calls"].map(f=>`
          <div style="display:flex;align-items:center;gap:12px;text-align:left;">
            <div style="width:8px;height:8px;border-radius:50%;background:${PURPLE};flex-shrink:0;"></div>
            <span style="font-size:17px;color:${WHITE};font-weight:500;">${f}</span>
          </div>`).join("")}
        </div>
      </div>`, PURPLE)
  },
  // 12 – Why BITSOL
  {
    name: "12-why-bitsol",
    html: wrap(`
      <div style="text-align:center;">
        ${tag("Why Choose Us")}
        <h2 style="margin-top:24px;font-size:58px;font-weight:900;color:${WHITE};line-height:1.05;">Why <span style="color:${CYAN};">BITSOL?</span></h2>
        <div style="margin-top:48px;display:grid;grid-template-columns:1fr 1fr;gap:24px;">
          ${[["🤖","AI-First Approach","Every strategy is backed by artificial intelligence"],["📊","Data-Driven","Decisions made from real-time analytics, not guesses"],["🚀","Fast Results","See measurable growth within the first 30 days"],["🤝","Dedicated Support","Your team is always one WhatsApp message away"]].map(([e,t,d])=>`
          <div style="padding:28px;background:${SLATE};border:1px solid ${CYAN}22;border-radius:16px;text-align:left;">
            <div style="font-size:32px;">${e}</div>
            <div style="font-size:18px;font-weight:800;color:${WHITE};margin-top:12px;">${t}</div>
            <div style="font-size:14px;color:${MUTED};margin-top:8px;line-height:1.5;">${d}</div>
          </div>`).join("")}
        </div>
      </div>`)
  },
  // 13 – Testimonial / Trust
  {
    name: "13-trust",
    html: wrap(`
      <div style="text-align:center;">
        ${tag("Client Results")}
        <h2 style="margin-top:24px;font-size:52px;font-weight:900;color:${WHITE};">Building <span style="color:${CYAN};">Intelligent</span><br>Business Infrastructures</h2>
        <p style="margin-top:24px;font-size:20px;color:${MUTED};line-height:1.7;max-width:720px;margin-left:auto;margin-right:auto;">"BITSOL transformed our digital presence. Our organic traffic grew 340% in just 4 months."</p>
        <div style="margin-top:44px;display:flex;justify-content:center;gap:48px;">
          ${[["340%","Organic Traffic Growth"],["4.8x","Return on Ad Spend"],["60%","Cost Per Lead Reduction"]].map(([n,l])=>`
          <div>
            <div style="font-size:48px;font-weight:900;color:${CYAN};">${n}</div>
            <div style="font-size:13px;color:${MUTED};margin-top:8px;max-width:120px;">${l}</div>
          </div>`).join("")}
        </div>
      </div>`)
  },
  // 14 – Process
  {
    name: "14-our-process",
    html: wrap(`
      <div>
        ${tag("Our Process")}
        <h2 style="margin-top:24px;font-size:56px;font-weight:900;color:${WHITE};line-height:1.05;">How We <span style="color:${CYAN};">Work</span></h2>
        <div style="margin-top:48px;display:flex;flex-direction:column;gap:24px;">
          ${[["01","Discovery & Audit","We analyse your business, competitors, and market opportunities."],["02","Strategy Design","A custom AI marketing blueprint tailored to your goals."],["03","Execution","Our team deploys campaigns, content, and automation at scale."],["04","Optimise & Grow","Continuous data-driven refinement for compounding results."]].map(([n,t,d])=>`
          <div style="display:flex;align-items:flex-start;gap:24px;">
            <div style="font-size:36px;font-weight:900;color:${CYAN};opacity:0.4;min-width:52px;">${n}</div>
            <div>
              <div style="font-size:20px;font-weight:800;color:${WHITE};">${t}</div>
              <div style="font-size:15px;color:${MUTED};margin-top:4px;">${d}</div>
            </div>
          </div>`).join("")}
        </div>
      </div>`)
  },
  // 15 – CTA Contact
  {
    name: "15-cta-contact",
    html: wrap(`
      <div style="text-align:center;">
        <h2 style="font-size:70px;font-weight:900;color:${WHITE};line-height:1.05;">Ready to<br><span style="background:linear-gradient(90deg,${CYAN},${PURPLE});-webkit-background-clip:text;-webkit-text-fill-color:transparent;">Scale Your</span><br>Business?</h2>
        <p style="margin-top:28px;font-size:20px;color:${MUTED};line-height:1.7;max-width:680px;margin-left:auto;margin-right:auto;">Book a free 30-minute strategy call. No pressure, no obligation — just clarity on your growth path.</p>
        <div style="margin-top:52px;display:flex;justify-content:center;gap:20px;flex-wrap:wrap;">
          <div style="padding:18px 44px;background:linear-gradient(135deg,${CYAN},${PURPLE});border-radius:50px;color:#fff;font-weight:800;font-size:18px;">Book Free Strategy Call</div>
          <div style="padding:18px 44px;border:2px solid #25D366;border-radius:50px;color:#25D366;font-weight:800;font-size:18px;">WhatsApp Us Now</div>
        </div>
      </div>`)
  },
  // 16 – Pakistan Focus
  {
    name: "16-pakistan",
    html: wrap(`
      <div>
        ${tag("Serving Pakistan & Beyond")}
        <h2 style="margin-top:24px;font-size:62px;font-weight:900;color:${WHITE};line-height:1.05;">Pakistan's <span style="color:${CYAN};">#1</span><br>AI Marketing<br>Agency</h2>
        <p style="margin-top:24px;font-size:20px;color:${MUTED};line-height:1.7;max-width:660px;">From Karachi to Lahore to Islamabad — and clients across UAE, UK, and USA — we deliver world-class AI digital marketing.</p>
        <div style="margin-top:48px;display:flex;gap:16px;flex-wrap:wrap;">
          ${["🇵🇰 Pakistan","🇦🇪 UAE","🇬🇧 United Kingdom","🇺🇸 USA"].map(c=>`
          <span style="padding:12px 24px;border-radius:50px;background:${SLATE};border:1px solid ${CYAN}33;color:${WHITE};font-size:16px;font-weight:700;">${c}</span>`).join("")}
        </div>
      </div>`)
  },
  // 17 – Free Audit
  {
    name: "17-free-audit",
    html: wrap(`
      <div style="text-align:center;">
        <div style="margin-bottom:8px;">${tag("Limited Time Offer")}</div>
        <h2 style="margin-top:20px;font-size:72px;font-weight:900;color:${WHITE};line-height:1.05;"><span style="color:${CYAN};">FREE</span><br>SEO Audit</h2>
        <p style="margin-top:24px;font-size:20px;color:${MUTED};line-height:1.7;max-width:700px;margin-left:auto;margin-right:auto;">Get a comprehensive AI-powered audit of your website's SEO health, competitor gaps, and growth opportunities — completely free.</p>
        <div style="margin-top:24px;padding:28px;background:${SLATE};border:1px solid ${CYAN}33;border-radius:20px;display:inline-block;text-align:left;">
          ${["Technical SEO analysis","Top 10 competitor breakdown","Keyword opportunity report","Actionable growth roadmap"].map(f=>`
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
            <div style="width:8px;height:8px;border-radius:50%;background:${CYAN};"></div>
            <span style="font-size:17px;color:${WHITE};">${f}</span>
          </div>`).join("")}
        </div>
        <div style="margin-top:24px;font-size:17px;color:${CYAN};font-weight:700;">→ bitsolmarketing.com/contact</div>
      </div>`)
  },
  // 18 – Digital Marketing
  {
    name: "18-digital-marketing",
    html: wrap(`
      <div>
        ${tag("Digital Marketing")}
        <h2 style="margin-top:24px;font-size:60px;font-weight:900;color:${WHITE};line-height:1.05;">We Turn Clicks<br><span style="color:${PURPLE};">Into Clients</span></h2>
        <p style="margin-top:20px;font-size:20px;color:${MUTED};line-height:1.7;max-width:700px;">Full-funnel digital marketing — from brand awareness to purchase — powered by AI and human creativity.</p>
        <div style="margin-top:44px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;">
          ${[["SEO","Organic search dominance"],["Paid Ads","Meta + Google ROI"],["Social Media","Brand awareness"],["Email Marketing","Nurture sequences"],["Content Marketing","Authority building"],["Analytics","Data-driven decisions"]].map(([t,d])=>`
          <div style="padding:20px;background:${SLATE};border:1px solid ${PURPLE}22;border-radius:14px;">
            <div style="font-size:15px;font-weight:800;color:${WHITE};">${t}</div>
            <div style="font-size:12px;color:${MUTED};margin-top:6px;">${d}</div>
          </div>`).join("")}
        </div>
      </div>`, PURPLE)
  },
  // 19 – Enterprise Plan
  {
    name: "19-enterprise",
    html: wrap(`
      <div style="text-align:center;">
        ${tag("Enterprise Plan")}
        <h2 style="margin-top:20px;font-size:72px;font-weight:900;background:linear-gradient(135deg,#F59E0B,${CYAN});-webkit-background-clip:text;-webkit-text-fill-color:transparent;line-height:1;">Custom<br>Pricing</h2>
        <p style="margin-top:20px;font-size:20px;color:${MUTED};max-width:700px;margin-left:auto;margin-right:auto;">Bespoke AI systems and dedicated teams for large organisations with complex digital marketing needs.</p>
        <div style="margin-top:40px;display:flex;flex-direction:column;gap:14px;max-width:700px;margin-left:auto;margin-right:auto;">
          ${["Custom LLM & AI agent development","Multi-channel paid media (unlimited spend)","Full web or mobile app development","Algorithmic trading software","Dedicated account manager","SLA-backed 12-hr response"].map(f=>`
          <div style="display:flex;align-items:center;gap:12px;text-align:left;">
            <div style="width:8px;height:8px;border-radius:50%;background:#F59E0B;flex-shrink:0;"></div>
            <span style="font-size:17px;color:${WHITE};font-weight:500;">${f}</span>
          </div>`).join("")}
        </div>
      </div>`)
  },
  // 20 – Closing Brand
  {
    name: "20-closing-brand",
    html: wrap(`
      <div style="text-align:center;">
        <div style="width:100px;height:100px;background:linear-gradient(135deg,${CYAN},${PURPLE});border-radius:24px;display:flex;align-items:center;justify-content:center;margin:0 auto 32px;">
          <span style="color:#fff;font-weight:900;font-size:48px;">B</span>
        </div>
        <h1 style="font-size:56px;font-weight:900;color:${WHITE};">BITSOL <span style="color:${CYAN};">MARKETING</span></h1>
        <p style="margin-top:16px;font-size:20px;color:${MUTED};">Empowering Enterprises Through Scalable Digital Ecosystems</p>
        <div style="margin-top:52px;display:flex;justify-content:center;gap:40px;">
          ${[["bitsolmarketing.com","Website"],["@bitsolmarketing","Instagram"],["wa.me/923120141581","WhatsApp"]].map(([v,l])=>`
          <div style="text-align:center;">
            <div style="font-size:14px;color:${CYAN};font-weight:700;">${v}</div>
            <div style="font-size:12px;color:${MUTED};margin-top:4px;">${l}</div>
          </div>`).join("")}
        </div>
        <div style="margin-top:52px;padding:20px 56px;background:linear-gradient(135deg,${CYAN},${PURPLE});border-radius:50px;display:inline-block;color:#fff;font-weight:800;font-size:18px;letter-spacing:1px;">Pakistan's Premier AI Agency</div>
      </div>`)
  }
];

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-web-security"]
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 2 });

  for (const post of posts) {
    await page.setContent(post.html, { waitUntil: "domcontentloaded" });
    const outPath = path.join(OUT_DIR, `${post.name}.png`);
    await page.screenshot({ path: outPath, type: "png" });
    console.log(`✓ ${post.name}.png`);
  }

  await browser.close();
  console.log(`\n✅ All 20 posts saved to: ${OUT_DIR}`);
})();
