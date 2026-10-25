import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/home/editorial";
import { contactInfo } from "@/lib/navigation";

const whatsapp =
  `https://wa.me/${contactInfo.whatsapp}?text=` +
  encodeURIComponent("Hello BITSOL Marketing! I'd like to discuss my growth goals.");

export default function ClosingCta() {
  return (
    <section className="py-24 md:py-32">
      <div className="container mx-auto px-6">
        <div className="rounded-[28px] bg-foreground px-8 py-20 text-center text-white md:px-16 md:py-28">
          <Eyebrow tone="dark">Next step</Eyebrow>
          <h2 className="mx-auto mt-8 max-w-3xl text-4xl text-white sm:text-5xl md:text-[64px] md:leading-[1.05]">
            Got a growth goal in mind? <span className="italic text-white/60">Let&apos;s talk.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-white/70">
            Tell us where growth is getting stuck. We reply by the next working morning with honest next steps.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link href="/contact">
              <Button size="lg" className="bg-white text-foreground hover:bg-white/90">
                Book a call
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a href={whatsapp} target="_blank" rel="noopener noreferrer">
              <Button size="lg" variant="outline" className="border-white/25 text-white hover:border-white hover:bg-white/10">
                Chat on WhatsApp
              </Button>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
