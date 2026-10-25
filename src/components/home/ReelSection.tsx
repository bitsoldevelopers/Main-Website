import { existsSync } from "node:fs";
import path from "node:path";
import ReelMedia from "@/components/home/ReelMedia";

const REEL_PATH = "/videos/reel.mp4";
const POSTER_PATH = "/videos/reel-poster.jpg";

/**
 * "Watch our reel": a giant serif band sliding behind a centred video panel
 * with a mirrored reflection beneath it. Drop the showreel at
 * public/videos/reel.mp4 (and optionally reel-poster.jpg) and it plays;
 * until then the panel shows the glass spheres and the band reads
 * "Strategy · Creative · Growth" instead.
 */
export default function ReelSection() {
  const publicDir = path.join(process.cwd(), "public");
  const hasReel = existsSync(path.join(publicDir, REEL_PATH));
  const hasPoster = existsSync(path.join(publicDir, POSTER_PATH));
  const phrase = hasReel ? "Watch our reel" : "Strategy · Creative · Growth";
  const band = Array.from({ length: 6 }, () => phrase);

  return (
    <section className="relative overflow-hidden py-16 md:py-24">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-[18%] w-full select-none md:top-[14%]"
      >
        <div className="animate-marquee flex w-max items-center whitespace-nowrap font-heading text-[72px] leading-none tracking-[-0.03em] text-[#d8d6d0] md:text-[128px]">
          {[...band, ...band].map((text, i) => (
            <span key={i} className="pr-8 md:pr-12">
              {text} <span className="px-2 md:px-4">·</span>
            </span>
          ))}
        </div>
      </div>

      <div className="wrap relative">
        <ReelMedia src={hasReel ? REEL_PATH : null} poster={hasPoster ? POSTER_PATH : undefined} />
      </div>
    </section>
  );
}
