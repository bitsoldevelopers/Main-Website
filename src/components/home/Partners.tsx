import type { ReactNode } from "react";
import { Eyebrow } from "@/components/home/editorial";

/**
 * "Our partners": the heading on the left, three bands of grey wordmarks on
 * the right that drift sideways in alternating directions. Row one carries
 * the owner's four partner claims; the other two name the platforms the
 * services run on.
 */

type Mark = { name: string; note: string; glyph: ReactNode };

const MetaGlyph = (
  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.8 7c-1.5 0-2.8.7-3.8 2-1-1.3-2.3-2-3.8-2C6.9 7 4 9.7 4 13s2.9 6 6.2 6c1.5 0 2.8-.7 3.8-2 1 1.3 2.3 2 3.8 2 3.3 0 6.2-2.7 6.2-6S21.1 7 17.8 7zm-7.6 9.6c-1.9 0-3.6-1.5-3.6-3.6s1.7-3.6 3.6-3.6c.9 0 1.8.4 2.4 1-1.1 1.4-1.7 3.1-1.7 4.9.1.5.6 1.3 1.3 1.3zm7.6 0c-.7 0-1.2-.8-1.3-1.3 0-1.8-.6-3.5-1.7-4.9.6-.6 1.5-1 2.4-1 1.9 0 3.6 1.5 3.6 3.6s-1.7 3.6-3.6 3.6z" />
  </svg>
);

const RingsGlyph = (
  <svg viewBox="0 0 120 40" className="h-4 w-12 fill-none stroke-current" strokeWidth="4" xmlns="http://www.w3.org/2000/svg">
    <circle cx="20" cy="20" r="14" />
    <circle cx="44" cy="20" r="14" />
    <circle cx="68" cy="20" r="14" />
    <circle cx="92" cy="20" r="14" />
  </svg>
);

const StarGlyph = (
  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.6" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10.5" />
    <path d="M12 1.5 L12 12 M12 12 L3 17.5 M12 12 L21 17.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SquaresGlyph = (
  <svg viewBox="0 0 23 23" className="h-[18px] w-[18px] fill-current" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="10.5" height="10.5" />
    <rect x="11.5" y="0" width="10.5" height="10.5" />
    <rect x="0" y="11.5" width="10.5" height="10.5" />
    <rect x="11.5" y="11.5" width="10.5" height="10.5" />
  </svg>
);

const TriangleGlyph = (
  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 3 L21.5 20 H2.5 Z" strokeLinejoin="round" />
  </svg>
);

const PinGlyph = (
  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" strokeLinejoin="round" />
    <circle cx="12" cy="9.5" r="2.5" />
  </svg>
);

const NoteGlyph = (
  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 3v12.5" strokeLinecap="round" />
    <circle cx="10" cy="16.5" r="3.5" />
    <path d="M14 3c0 3 2.5 5.5 5.5 5.5" strokeLinecap="round" />
  </svg>
);

const BubbleGlyph = (
  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 20l1.4-4.2A8 8 0 1 1 8.2 18.6z" strokeLinejoin="round" />
  </svg>
);

const InGlyph = (
  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" xmlns="http://www.w3.org/2000/svg">
    <path d="M6.5 9.5h3v10h-3zM8 4.5a1.75 1.75 0 1 1 0 3.5 1.75 1.75 0 0 1 0-3.5zM11.5 9.5h2.9v1.4c.5-.9 1.6-1.6 3.2-1.6 3.2 0 3.9 2 3.9 4.8v5.4h-3v-4.8c0-1.2 0-2.6-1.6-2.6s-1.9 1.2-1.9 2.5v4.9h-3z" />
  </svg>
);

const partners: Mark[] = [
  { name: "Meta", note: "Authorized partner", glyph: MetaGlyph },
  { name: "Microsoft", note: "Cloud solutions partner", glyph: SquaresGlyph },
  { name: "AUDI Pakistan", note: "Official collab", glyph: RingsGlyph },
  { name: "Shahnawaz Motors", note: "Mercedes-Benz partner", glyph: StarGlyph },
];

const platformsA: Mark[] = [
  { name: "Google Ads", note: "Paid search", glyph: TriangleGlyph },
  { name: "Meta Ads", note: "Paid social", glyph: MetaGlyph },
  { name: "WhatsApp Business", note: "Automation", glyph: BubbleGlyph },
  { name: "Google Business Profile", note: "Local SEO", glyph: PinGlyph },
];

const platformsB: Mark[] = [
  { name: "LinkedIn", note: "B2B social", glyph: InGlyph },
  { name: "TikTok", note: "Short video", glyph: NoteGlyph },
  { name: "Next.js", note: "Web platform", glyph: TriangleGlyph },
  { name: "Microsoft 365", note: "Cloud", glyph: SquaresGlyph },
];

function Band({ marks, reverse }: { marks: Mark[]; reverse?: boolean }) {
  const track = [...marks, ...marks];
  return (
    <div className="group relative w-full min-w-0 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
      <ul
        className={`flex w-max items-center gap-16 pr-16 [animation-play-state:running] group-hover:[animation-play-state:paused] ${
          reverse ? "animate-marquee-reverse" : "animate-marquee"
        }`}
      >
        {track.map((mark, i) => (
          <li
            key={`${mark.name}-${i}`}
            aria-hidden={i >= marks.length ? "true" : undefined}
            className="flex shrink-0 items-center gap-3 text-[#b6b4ae] transition-colors duration-300 hover:text-foreground"
          >
            <span className="flex h-6 w-6 items-center justify-center">{mark.glyph}</span>
            <span className="flex flex-col leading-none">
              <span className="whitespace-nowrap text-[22px] font-semibold tracking-tight">{mark.name}</span>
              <span className="mt-1.5 whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.1em] text-[#c9c7c1]">
                {mark.note}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Partners() {
  return (
    <section className="py-24 md:py-32">
      {/* minmax(0, …) tracks: the marquee's max-content width must not size the grid. */}
      <div className="wrap grid grid-cols-[minmax(0,1fr)] items-center gap-14 lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)] lg:gap-24">
        <div className="min-w-0">
          <Eyebrow className="mb-7">Our partners</Eyebrow>
          <h2 className="text-[38px] leading-[1.04] sm:text-5xl md:text-[56px]">
            Partners and platforms we work with
          </h2>
        </div>

        <div className="flex min-w-0 flex-col gap-12 py-2">
          <Band marks={partners} />
          <Band marks={platformsA} reverse />
          <Band marks={platformsB} />
        </div>
      </div>
    </section>
  );
}
