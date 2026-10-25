import { Eyebrow } from "@/components/home/editorial";

// The same three moves every service page documents: audit, plan, run.
const steps = [
  {
    title: "Discovery",
    body: "We audit your current channels, workflows and numbers, and agree on the outcomes that matter before anything is built.",
    glyph: (
      <svg viewBox="0 0 40 40" className="h-9 w-9" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="step-a" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ff8a3d" />
            <stop offset="1" stopColor="#ffd23f" />
          </linearGradient>
        </defs>
        <path d="M6 8l12 12L6 32V8z" fill="url(#step-a)" />
        <path d="M20 8l12 12-12 12V8z" fill="url(#step-a)" opacity="0.7" />
      </svg>
    ),
  },
  {
    title: "Strategy",
    body: "A written plan with channel mix, budget split and 90-day targets, so every rupee and every hour has a job.",
    glyph: (
      <svg viewBox="0 0 40 40" className="h-9 w-9" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="step-b" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#2f6bff" />
            <stop offset="1" stopColor="#ff5ea8" />
          </linearGradient>
        </defs>
        <rect x="6" y="6" width="18" height="18" rx="4" fill="url(#step-b)" opacity="0.85" />
        <circle cx="26" cy="26" r="9" fill="url(#step-b)" />
      </svg>
    ),
  },
  {
    title: "Build & run",
    body: "We launch, optimise daily and report monthly. What works gets more budget; what doesn't gets cut.",
    glyph: (
      <svg viewBox="0 0 40 40" className="h-9 w-9" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="step-c" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#7b4dff" />
            <stop offset="1" stopColor="#38b6ff" />
          </linearGradient>
        </defs>
        <circle cx="13" cy="13" r="7" fill="url(#step-c)" />
        <circle cx="27" cy="13" r="7" fill="url(#step-c)" opacity="0.8" />
        <circle cx="13" cy="27" r="7" fill="url(#step-c)" opacity="0.8" />
        <circle cx="27" cy="27" r="7" fill="url(#step-c)" opacity="0.6" />
      </svg>
    ),
  },
];

/** "How we work": heading left, three columns with a round icon chip, a serif title and a line of copy. */
export default function ProcessSteps() {
  return (
    <section className="py-24 md:py-32">
      <div className="wrap">
        <div className="max-w-[560px]">
          <Eyebrow className="mb-7">How we work</Eyebrow>
          <h2 className="text-[38px] leading-[1.04] sm:text-5xl md:text-[56px]">
            From first call to launch in three steps
          </h2>
        </div>

        <ol className="mt-16 grid gap-12 md:grid-cols-3 md:gap-10 lg:gap-16">
          {steps.map((step) => (
            <li key={step.title}>
              <span className="flex h-24 w-24 items-center justify-center rounded-full bg-white shadow-[0_18px_40px_-20px_rgba(20,20,20,0.3),0_1px_2px_rgba(20,20,20,0.05)]">
                {step.glyph}
              </span>
              <h3 className="mt-8 text-[34px] leading-tight md:text-[40px]">{step.title}</h3>
              <p className="mt-4 max-w-sm text-[17px] leading-relaxed text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
