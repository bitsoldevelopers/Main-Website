import Link from "next/link";
import { DIcons } from "dicons";
import FooterThemeToggle from "@/components/ui/footer-theme-toggle";
import { Logo } from "@/components/ui/Logo";

const navigation = {
  categories: [
    {
      id: "services",
      name: "Services",
      sections: [
        {
          id: "solutions",
          name: "Solutions",
          items: [
            { name: "AI Automation", href: "/services/ai-automation" },
            { name: "Digital Marketing", href: "/services/digital-marketing" },
            { name: "Web Development", href: "/services/web-development" },
            { name: "Trading Tech", href: "/services/trading-tech" },
          ],
        },
        {
          id: "innovations",
          name: "Innovations",
          items: [
            { name: "Nexus AI Engine", href: "/portfolio/nexus-ai-engine" },
            { name: "AlphaTrade Pro", href: "/portfolio/alpha-trade-pro" },
            { name: "Quantum Data Lake", href: "/portfolio/quantum-data-lake" },
            { name: "CryptoVault OS", href: "/portfolio/crypto-vault-os" },
          ],
        },
        {
          id: "company",
          name: "Company",
          items: [
            { name: "About Us", href: "/about" },
            { name: "Careers", href: "/careers" },
            { name: "Our Process", href: "/about#process" },
            { name: "Blog", href: "/blog" },
          ],
        },
        {
          id: "legal",
          name: "Legal",
          items: [
            { name: "Terms of Service", href: "/terms" },
            { name: "Privacy Policy", href: "/privacy" },
            { name: "Cookie Policy", href: "/cookies" },
            { name: "Refund Policy", href: "/refund" },
            { name: "Compliance", href: "/compliance" },
          ],
        },
      ],
    },
  ],
};

const Underline = `hover:-translate-y-1 border border-dotted border-slate-300 dark:border-white/20 rounded-xl p-2.5 transition-all hover:border-brand-cyan hover:text-brand-cyan shadow-sm hover:shadow-brand-cyan/20`;

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 dark:border-white/5 bg-white dark:bg-[#050816] transition-colors duration-500">
      <div className="relative mx-auto grid max-w-7xl items-center justify-center gap-10 p-10 pb-0 md:flex">
        <Link href="/">
          <div className="flex items-center justify-center rounded-full p-4 bg-brand-cyan/5 border border-dotted border-brand-cyan/30">
            <Logo className="w-12 h-12" />
          </div>
        </Link>
        <p className="bg-transparent text-center text-sm leading-7 text-slate-600 dark:text-brand-muted md:text-left max-w-4xl italic">
          At BITSOL, we architect the digital future by merging artificial intelligence with human creativity. 
          Our mission is to empower enterprises through scalable digital ecosystems, high-performance web engineering, 
          and data-driven marketing strategies. We believe in building technology that doesn't just solve problems, 
          but accelerates human potential.
        </p>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="border-b border-dotted border-slate-200 dark:border-white/10"> </div>
        <div className="py-16">
          {navigation.categories.map((category) => (
            <div
              key={category.name}
              className="grid grid-cols-2 md:grid-cols-4 gap-12 leading-6"
            >
              {category.sections.map((section) => (
                <div key={section.name}>
                  <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-900 dark:text-white mb-8 border-l-2 border-brand-cyan pl-4">
                    {section.name}
                  </h4>
                  <ul
                    role="list"
                    className="flex flex-col space-y-4"
                  >
                    {section.items.map((item) => (
                      <li key={item.name} className="flow-root">
                        <Link
                          href={item.href}
                          className="text-sm text-slate-500 hover:text-brand-cyan dark:text-brand-muted hover:dark:text-white transition-colors"
                        >
                          {item.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="border-b border-dotted border-slate-200 dark:border-white/10"> </div>
      </div>

      <div className="flex flex-col items-center justify-center gap-10 pb-16">
        <div className="flex flex-wrap items-center justify-center gap-6 px-6">
          <Link
            aria-label="Email"
            href="mailto:info@bitsolmarketing.com"
            className={Underline}
          >
            <DIcons.Mail strokeWidth={1.5} className="h-5 w-5" />
          </Link>
          <Link
            aria-label="WhatsApp"
            href="https://wa.me/923103175175"
            target="_blank"
            rel="noopener noreferrer"
            className={Underline}
          >
            <DIcons.WhatsApp className="h-5 w-5" />
          </Link>
          <Link
            aria-label="LinkedIn"
            href="https://www.linkedin.com/company/bitsolpvtltd/"
            target="_blank"
            rel="noopener noreferrer"
            className={Underline}
          >
            <DIcons.LinkedIn className="h-5 w-5" />
          </Link>
          <Link
            aria-label="Instagram"
            href="https://www.instagram.com/bitsol_marketing/"
            target="_blank"
            rel="noopener noreferrer"
            className={Underline}
          >
            <DIcons.Instagram className="h-5 w-5" />
          </Link>
          <Link
            aria-label="Facebook"
            href="https://www.facebook.com/bitsolmarketing/"
            target="_blank"
            rel="noopener noreferrer"
            className={Underline}
          >
            <DIcons.Facebook className="h-5 w-5" />
          </Link>
        </div>
        <FooterThemeToggle />
      </div>

      <div className="mx-auto pb-10 flex flex-col justify-between text-center text-xs md:max-w-7xl">
        <div className="flex flex-row items-center justify-center gap-1 text-slate-500 dark:text-brand-muted">
          <span> © </span>
          <span>{new Date().getFullYear()}</span>
          <span className="font-bold text-slate-900 dark:text-white mx-1">BITSOL MARKETING PVT LTD</span>
          -
          <span>Made with</span>
          <DIcons.Heart className="text-red-500 mx-1 h-3 w-3 animate-pulse" />
          <span>by the</span>
          <span className="text-brand-cyan font-bold ml-1">Architects of Innovation</span>
        </div>
      </div>
    </footer>
  );
}
