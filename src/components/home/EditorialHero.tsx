import { ChevronDown, Check } from "lucide-react";
import HeroClock from "@/components/home/HeroClock";
import HeroCoins from "@/components/home/HeroCoins";
import HeroLayer from "@/components/home/HeroLayer";
import CopyEmail from "@/components/home/CopyEmail";
import { contactInfo } from "@/lib/navigation";

/**
 * Opening frame: a rounded panel the fixed navbar sits inside, the two-line
 * serif title with the second line on a highlight band, a toolbar-style chip
 * and the tagline under it, the glass discs on both sides (a band of them
 * under the text on phones), and the studio time and email along the bottom.
 *
 * Choreography on load, all CSS (globals.css, "Hero entrance"): the title
 * lines come into focus one after the other, the highlight band sweeps in
 * under the second line, then the chip, the tagline and the bottom bar rise
 * in, while the discs slide in from their edge of the frame and settle into
 * their slow drift. After that `HeroLayer` leans the discs away from the
 * cursor and parallaxes discs and copy as the page scrolls on. Everything
 * resolves to its finished state at once under reduced motion.
 */
export default function EditorialHero() {
  return (
    <section className="px-2 pt-2">
      <div className="relative overflow-hidden rounded-[28px] border border-black/[0.05] bg-[radial-gradient(120%_80%_at_50%_30%,#fdfcfb_0%,#f9f8f6_55%,#f4f2ee_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] md:rounded-[32px]">
        {/* soft colour behind the title, breathing slowly */}
        <div
          aria-hidden="true"
          className="hero-glow pointer-events-none absolute left-[calc(50%-450px)] top-[6%] h-[480px] w-[900px] rounded-full bg-[radial-gradient(closest-side,rgba(0,102,255,0.10),rgba(120,90,220,0.06)_50%,transparent)] blur-3xl"
        />

        <HeroLayer
          className="pointer-events-none absolute inset-0 hidden md:block"
          drift={22}
          scrollShift={150}
          range={720}
        >
          <HeroCoins />
        </HeroLayer>

        <div className="relative z-10 flex min-h-[calc(100svh-120px)] flex-col px-6 pb-7 pt-[calc(var(--nav-height)+40px)] md:min-h-[860px] md:px-[72px] md:pb-9 md:pt-[calc(var(--nav-height)+56px)]">
          <HeroLayer className="flex flex-col items-center text-center" scrollShift={-56} fade range={520}>
            <h1 className="text-[52px] leading-[0.98] sm:text-[64px] md:text-[72px] lg:text-[84px]">
              <span className="hero-rise-soft block [--rise-delay:0.05s]">We build</span>
              <span className="hero-rise-soft hero-band mt-2 inline-block rounded-[14px] px-3 pb-2 pt-1 [--band-delay:0.8s] [--rise-delay:0.2s] md:mt-3 md:rounded-[18px] md:px-5">
                Growth systems.
              </span>
            </h1>

            {/* Decorative "editor toolbar" chip, like the reference's. */}
            <div
              aria-hidden="true"
              className="hero-rise mt-5 inline-flex h-10 select-none items-center rounded-[10px] border border-black/[0.06] bg-white px-2 text-[13px] text-foreground shadow-[0_8px_24px_-12px_rgba(20,20,20,0.25)] [--rise-delay:0.5s]"
            >
              <span className="inline-flex items-center gap-1 whitespace-nowrap px-2 font-medium">
                Growth plan
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </span>
              <span className="mx-1 h-5 w-px bg-border" />
              <span className="flex items-center gap-3 px-2 font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                <span>SEO</span>
                <span>Ads</span>
                <span>Social</span>
                <span>Web</span>
              </span>
              <span className="mx-1 h-5 w-px bg-border" />
              <span className="inline-flex items-center gap-1 px-2">
                <Check className="h-3.5 w-3.5 text-[var(--brand-accent)]" strokeWidth={2.5} />
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </span>
            </div>

            <p className="hero-rise mt-7 max-w-[400px] text-[17px] leading-relaxed text-muted-foreground [--rise-delay:0.65s]">
              SEO, paid ads, social, web development and AI automation, connected into one growth system.
            </p>
          </HeroLayer>

          {/* phones: the discs run under the text */}
          <div className="relative mt-4 h-[280px] md:hidden">
            <HeroCoins variant="band" />
          </div>

          {/* The discs take the middle of the frame; this keeps the bar at the bottom. */}
          <div className="flex-1" />

          <div className="hero-rise flex items-end justify-between gap-4 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground [--rise-delay:1s]">
            <HeroClock />
            <CopyEmail email={contactInfo.email} />
          </div>
        </div>
      </div>
    </section>
  );
}
