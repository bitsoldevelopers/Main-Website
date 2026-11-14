const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(__dirname, "..", "social-posts-v2");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// Use local dev server — faster, no CDN delay, animations settle properly
const BASE = "http://localhost:3000";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const shots = [
  // HOME
  { name: "01-home-hero",       url: "/",           scrollY: 0    },
  { name: "02-home-stats",      url: "/",           scrollY: 900  },
  { name: "03-home-services",   url: "/",           scrollY: 1900 },
  { name: "04-home-why-us",     url: "/",           scrollY: 3000 },
  { name: "05-home-cta",        url: "/",           scrollY: 4200 },

  // SERVICES
  { name: "06-services-hero",   url: "/services",   scrollY: 0    },
  { name: "07-services-card-1", url: "/services",   scrollY: 550  },
  { name: "08-services-card-2", url: "/services",   scrollY: 1650 },
  { name: "09-services-card-3", url: "/services",   scrollY: 2750 },
  { name: "10-services-card-4", url: "/services",   scrollY: 3850 },

  // PRICING
  { name: "11-pricing-hero",    url: "/pricing",    scrollY: 0    },
  { name: "12-pricing-plans",   url: "/pricing",    scrollY: 700  },
  { name: "13-pricing-addons",  url: "/pricing",    scrollY: 2200 },
  { name: "14-pricing-faq",     url: "/pricing",    scrollY: 3100 },
  { name: "15-pricing-cta",     url: "/pricing",    scrollY: 4400 },

  // OTHER PAGES
  { name: "16-contact-hero",    url: "/contact",    scrollY: 0    },
  { name: "17-contact-form",    url: "/contact",    scrollY: 800  },
  { name: "18-blog-page",       url: "/blog",       scrollY: 0    },
  { name: "19-ai-solutions",    url: "/ai-solutions", scrollY: 0  },
  { name: "20-trading-page",    url: "/trading",    scrollY: 0    },
];

async function prepPage(page, url) {
  await page.goto(`${BASE}${url}`, { waitUntil: "networkidle2", timeout: 60000 });

  // Force light mode, hide floating dock + navbar shadow, kill animations
  await page.evaluate(() => {
    // Force light theme
    document.documentElement.classList.remove("dark");
    document.documentElement.classList.add("light");
    try { localStorage.setItem("theme", "light"); } catch { /* storage may be blocked */ }

    // Hide floating dock so it doesn't overlap
    const style = document.createElement("style");
    style.textContent = `
      [class*="fixed bottom"] { opacity: 0 !important; pointer-events: none !important; }
      [class*="z-[250]"] { opacity: 0 !important; }
      [class*="z-[200]"] { opacity: 0 !important; }
    `;
    document.head.appendChild(style);

    // Stop all CSS animations/transitions for clean screenshots
    const noAnim = document.createElement("style");
    noAnim.textContent = `
      *, *::before, *::after {
        animation-duration: 0.001ms !important;
        transition-duration: 0.001ms !important;
      }
    `;
    document.head.appendChild(noAnim);
  });

  // Wait for h1 to appear (content loaded past loading state)
  try {
    await page.waitForSelector("h1", { timeout: 15000 });
  } catch { /* page may not have h1 */ }

  // Extra settle time for Framer Motion / Lenis
  await wait(3000);
}

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-web-security"]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 2 });

  let currentUrl = null;

  for (const shot of shots) {
    if (currentUrl !== shot.url) {
      console.log(`  → loading ${shot.url}...`);
      await prepPage(page, shot.url);
      currentUrl = shot.url;
    }

    // Scroll to position using window.scrollTo (bypasses Lenis)
    await page.evaluate((y) => {
      window.scrollTo(0, y);
      // Also try Lenis-wrapped container if present
      const main = document.querySelector("main");
      if (main) main.scrollTop = 0;
    }, shot.scrollY);
    await wait(1000);

    const outPath = path.join(OUT_DIR, `${shot.name}.png`);
    await page.screenshot({
      path: outPath,
      type: "png",
      clip: { x: 0, y: 0, width: 1080, height: 1080 },
    });

    console.log(`✓ ${shot.name}.png`);
  }

  await browser.close();
  console.log(`\n✅ All 20 posts → ${OUT_DIR}`);
})();
