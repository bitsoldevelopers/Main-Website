import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Eyebrow, Tag } from "@/components/home/editorial";
import ParallaxImage from "@/components/home/ParallaxImage";
import { projects } from "@/lib/portfolio";
import { cn } from "@/lib/utils";

type Project = (typeof projects)[number];

/**
 * "Featured work": the heading block top-left, then six portrait cards in
 * two columns that step down the page, each a white frame around the image
 * with the name, a line and the tags beneath. The right column starts level
 * with the heading, the left one below it, and the widths and offsets vary
 * from card to card as they do in the reference.
 */

const LAYOUT: Record<number, string> = {
  0: "lg:mt-0",
  1: "lg:mt-28",
  2: "lg:mt-36 lg:w-[82%]",
  3: "lg:mt-32 lg:ml-auto lg:w-[90%]",
  4: "lg:mt-40 lg:ml-auto",
  5: "lg:mt-28 lg:w-[80%]",
};

function WorkCard({ project, index }: { project: Project; index: number }) {
  const tags = [project.category, ...project.tech.slice(0, 2)];
  return (
    <article className={cn("w-full", LAYOUT[index])}>
      <Link href={`/portfolio/${project.slug}`} className="group block">
        <div className="rounded-[28px] border border-black/[0.06] bg-white p-1.5 shadow-[0_1px_2px_rgba(20,20,20,0.04)] transition-shadow duration-500 group-hover:shadow-[0_30px_60px_-30px_rgba(20,20,20,0.35)]">
          <ParallaxImage
            src={project.image}
            alt={project.title}
            sizes="(min-width: 1024px) 40vw, 100vw"
            // Unsplash URLs already ask its CDN for a sized, compressed
            // image; the local screenshots go through the optimizer.
            unoptimized={project.image.startsWith("http")}
            className="aspect-[4/5] rounded-[22px] bg-secondary"
          />
        </div>
        <div className="px-2.5 pt-7">
          <h3 className="text-[30px] leading-tight md:text-[34px]">{project.title}</h3>
          <p className="mt-2.5 max-w-md text-[16px] leading-relaxed text-muted-foreground">{project.desc}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </div>
        </div>
      </Link>
    </article>
  );
}

export default function PortfolioPreview() {
  const preview = projects.slice(0, 6);
  const right = preview.filter((_, i) => i % 2 === 0); // 0, 2, 4
  const left = preview.filter((_, i) => i % 2 === 1); // 1, 3, 5

  return (
    <section className="py-24 md:py-32">
      <div className="wrap">
        <div className="grid gap-16 lg:grid-cols-2 lg:gap-x-20">
          <div className="flex flex-col gap-16 lg:gap-24">
            <div className="max-w-[560px]">
              <Eyebrow className="mb-7">Featured work</Eyebrow>
              <h2 className="text-[38px] leading-[1.04] sm:text-5xl md:text-[56px]">
                Selected projects built with ambitious businesses and bold teams
              </h2>
              <Link href="/contact" className="mt-9 inline-block">
                <Button>Book an intro call</Button>
              </Link>
            </div>
            {left.map((project) => (
              <WorkCard key={project.slug} project={project} index={preview.indexOf(project)} />
            ))}
          </div>
          <div className="flex flex-col gap-16 lg:gap-24 lg:pt-8">
            {right.map((project) => (
              <WorkCard key={project.slug} project={project} index={preview.indexOf(project)} />
            ))}
          </div>
        </div>

        <div className="mt-16 flex justify-center lg:hidden">
          <Link href="/portfolio">
            <Button variant="outline">View all projects</Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
