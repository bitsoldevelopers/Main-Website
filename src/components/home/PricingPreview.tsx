import Link from "next/link";
import { Sparkles, Globe, LayoutGrid, Search, MessageCircle, BarChart3, Mail, Bot, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/home/editorial";
import { plans } from "@/lib/pricing";
import { cn } from "@/lib/utils";

// Line icons for the benefit rows, in rotation.
const BENEFIT_ICONS: LucideIcon[] = [Sparkles, Globe, LayoutGrid, Search, MessageCircle, BarChart3, Mail, Bot];

/**
 * "Pricing": the three plans from lib/pricing as cards. Plan icon and name,
 * a line of copy, a dotted rule, five benefits with line icons, another
 * rule, then the price and a full-width "Inquire" button. The popular plan
 * is inverted. The full detail stays on /pricing.
 */
export default function PricingPreview() {
  return (
    <section className="py-24 md:py-32">
      <div className="wrap">
        <div className="max-w-[560px]">
          <Eyebrow className="mb-7">Pricing</Eyebrow>
          <h2 className="text-[38px] leading-[1.04] sm:text-5xl md:text-[56px]">Choose a plan that fits your stage</h2>
        </div>

        <div className="mt-16 grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => {
            const featured = plan.popular;
            const PlanIcon = plan.icon;
            const slug = plan.name.toLowerCase();
            return (
              <article
                key={plan.name}
                className={cn(
                  "relative flex flex-col overflow-hidden rounded-[28px] p-8 md:p-10",
                  featured
                    ? "bg-[#141414] text-white shadow-[0_40px_80px_-40px_rgba(20,20,20,0.6)]"
                    : "border border-black/[0.06] bg-white shadow-[0_1px_2px_rgba(20,20,20,0.04)]"
                )}
              >
                {featured && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/[0.06] blur-3xl"
                  />
                )}

                <div className="flex items-center gap-4">
                  <PlanIcon
                    className={cn("h-9 w-9", featured ? "text-[var(--brand-accent)]" : "text-foreground")}
                    strokeWidth={1.6}
                  />
                  <h3 className="text-[26px] leading-none">{plan.name} plan</h3>
                </div>
                <p className={cn("mt-5 text-[15px] leading-relaxed", featured ? "text-white/65" : "text-muted-foreground")}>
                  {plan.desc}
                </p>

                <div className={cn("my-8", featured ? "rule-dotted-dark" : "rule-dotted")} />

                <ul className="flex flex-col gap-4">
                  {plan.features.slice(0, 5).map((feature, i) => {
                    const Icon = BENEFIT_ICONS[i % BENEFIT_ICONS.length];
                    return (
                      <li key={feature} className="flex items-start gap-3.5 text-[15px] leading-snug">
                        <Icon
                          className={cn("mt-0.5 h-[18px] w-[18px] shrink-0", featured ? "text-white/70" : "text-muted-foreground")}
                          strokeWidth={1.6}
                        />
                        <span className={featured ? "text-white" : "text-foreground"}>{feature}</span>
                      </li>
                    );
                  })}
                </ul>

                <div className={cn("my-8", featured ? "rule-dotted-dark" : "rule-dotted")} />

                <div className="mt-auto">
                  <div className="flex items-baseline gap-2">
                    <span className="font-heading text-[36px] leading-none">{plan.price}</span>
                    {plan.period && (
                      <span className={cn("text-[15px]", featured ? "text-white/60" : "text-muted-foreground")}>
                        {plan.period.replace("/", "/ ")}
                      </span>
                    )}
                  </div>
                  <Link href={`/contact?plan=${slug}`} className="mt-6 block">
                    <Button
                      className={cn(
                        "h-12 w-full text-[15px]",
                        featured && "bg-white text-foreground hover:bg-white/90 shadow-[0_0_30px_rgba(255,255,255,0.18)]"
                      )}
                    >
                      Inquire for {plan.name} plan
                    </Button>
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
