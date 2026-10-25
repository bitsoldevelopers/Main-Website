import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DIcons } from "@/components/ui/dicons";
import { Eyebrow } from "@/components/home/editorial";
import GlassSpheres from "@/components/home/GlassSpheres";
import { contactInfo } from "@/lib/navigation";

const socials = [
  { label: "Email", href: `mailto:${contactInfo.email}`, icon: DIcons.Mail, external: false },
  { label: "WhatsApp", href: `https://wa.me/${contactInfo.whatsapp}`, icon: DIcons.WhatsApp, external: true },
  { label: "LinkedIn", href: contactInfo.social.linkedin, icon: DIcons.LinkedIn, external: true },
  { label: "Instagram", href: contactInfo.social.instagram, icon: DIcons.Instagram, external: true },
  { label: "Facebook", href: contactInfo.social.facebook, icon: DIcons.Facebook, external: true },
];

const links = [
  { name: "Services", href: "/services" },
  { name: "Portfolio", href: "/portfolio" },
  { name: "Pricing", href: "/pricing" },
  { name: "About", href: "/about" },
  { name: "Blog", href: "/blog" },
  { name: "Careers", href: "/careers" },
  { name: "Contact", href: "/contact" },
  { name: "Privacy", href: "/privacy" },
  { name: "Terms", href: "/terms" },
  { name: "Cookies", href: "/cookies" },
  { name: "Refunds", href: "/refund" },
  { name: "Compliance", href: "/compliance" },
];

/**
 * The closing frame on every public page: a dark rounded panel with the
 * call to action and the glass spheres, a row of social links along its
 * foot, the wordmark set huge in a grey gradient, and a slim bottom bar
 * with the copyright and the site's links.
 */
export default function Footer() {
  return (
    <footer className="pt-16 md:pt-24">
      <div className="wrap">
        <div className="relative overflow-hidden rounded-[28px] bg-[#0f0f0f] px-7 pb-8 pt-12 text-white md:px-16 md:pb-9 md:pt-16">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
            <div>
              <Eyebrow tone="dark">Goal → Growth</Eyebrow>
              <h2 className="mt-7 max-w-[560px] text-[40px] leading-[1.02] text-white sm:text-[52px] md:text-[64px]">
                Got a growth goal you want to bring to life?
              </h2>
              <Link href="/contact" className="mt-9 inline-block">
                <Button className="bg-white text-foreground shadow-[0_0_40px_rgba(255,255,255,0.18)] hover:bg-white/90">
                  Book a call
                </Button>
              </Link>
            </div>
            <div className="relative h-[260px] overflow-hidden rounded-[20px] md:h-[340px]">
              <GlassSpheres />
            </div>
          </div>

          <ul className="mt-14 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-white/10 pt-7 font-mono text-[11px] uppercase tracking-[0.08em] sm:grid-cols-3 md:flex md:justify-between">
            {socials.map(({ label, href, icon: Icon, external }) => (
              <li key={label}>
                <a
                  href={href}
                  target={external ? "_blank" : undefined}
                  rel={external ? "noopener noreferrer" : undefined}
                  className="inline-flex items-center gap-2 text-white/65 transition-colors hover:text-white"
                >
                  {/* The brand icons carry their own colours; flattened to the footer's grey. */}
                  <Icon className="h-3.5 w-3.5 [filter:grayscale(1)_brightness(1.9)]" />
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* wordmark */}
        <div aria-hidden="true" className="select-none overflow-hidden pt-6 md:pt-8">
          <div className="bg-gradient-to-r from-[#edebe6] via-[#d9d6cf] to-[#a6a49e] bg-clip-text text-center font-heading text-[30vw] leading-[0.82] tracking-[-0.05em] text-transparent md:text-[clamp(160px,22vw,330px)]">
            bitsol
          </div>
        </div>

        <div className="flex flex-col gap-5 border-t border-border py-7 text-[13px] text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} BITSOL Marketing PVT LTD · Lahore, Pakistan</p>
          <nav aria-label="Footer">
            <ul className="flex flex-wrap gap-x-5 gap-y-2">
              {links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="transition-colors hover:text-foreground">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
