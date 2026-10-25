import { Eyebrow } from "@/components/home/editorial";
import { TESTIMONIAL_DEFAULTS, type TestimonialItem } from "@/lib/cms-defaults";
import { cn } from "@/lib/utils";

const TILT = ["lg:-rotate-[5deg] lg:translate-y-8", "", "lg:rotate-[5deg] lg:translate-y-8"];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * "Client voices": a centred heading, then three dark cards fanned out
 * (the outer two tilted), each with a round monogram where the reference
 * puts a portrait, the quote in the serif, a hairline and the name. Groups
 * of thin accent lines sit behind the cards at both edges.
 */
export default function Testimonials({ items }: { items?: TestimonialItem[] }) {
  const testimonials = (items && items.length > 0 ? items : TESTIMONIAL_DEFAULTS).slice(0, 3);

  return (
    <section className="overflow-hidden py-24 md:py-32">
      <div className="wrap">
        <div className="mx-auto max-w-[760px] text-center">
          <Eyebrow className="mb-7">Client voices</Eyebrow>
          <h2 className="text-[38px] leading-[1.04] sm:text-5xl md:text-[56px]">
            Where ambitious businesses build what&apos;s next
          </h2>
        </div>

        <div className="relative mt-16 md:mt-24">
          {/* accent line groups */}
          {["left-0", "right-0"].map((side) => (
            <div
              key={side}
              aria-hidden="true"
              className={cn("pointer-events-none absolute top-[12%] hidden w-[16%] flex-col gap-[7px] lg:flex", side)}
            >
              {Array.from({ length: 13 }, (_, i) => (
                <span
                  key={i}
                  className="block h-px w-full bg-[var(--brand-accent)]"
                  style={{ opacity: 0.08 + (i % 4) * 0.05 }}
                />
              ))}
            </div>
          ))}

          <div className="relative mx-auto grid max-w-[1120px] gap-6 md:grid-cols-3 md:gap-5 lg:gap-8">
            {testimonials.map((item, i) => (
              <figure
                key={item.id}
                className={cn(
                  "flex flex-col items-center rounded-[28px] border-[6px] border-white bg-[radial-gradient(120%_100%_at_50%_0%,#3a3a3a_0%,#1b1b1b_55%,#0f0f0f_100%)] px-7 pb-10 pt-8 text-center text-white shadow-[0_40px_80px_-40px_rgba(20,20,20,0.5)]",
                  TILT[i]
                )}
              >
                <div
                  aria-hidden="true"
                  className="flex h-36 w-36 items-center justify-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#6a6a6a_0%,#2e2e2e_60%,#1a1a1a_100%)] font-heading text-5xl text-white/90 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                >
                  {initials(item.title)}
                </div>
                <blockquote className="mt-8 font-heading text-[24px] leading-[1.2] text-white md:text-[26px]">
                  “{item.description}”
                </blockquote>
                <span aria-hidden="true" className="mt-7 block h-px w-10 bg-white/15" />
                <figcaption className="mt-5">
                  <span className="block text-[15px] font-medium text-white">{item.title}</span>
                  <span className="mt-1 block text-[13px] text-white/60">Client</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
