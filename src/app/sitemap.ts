import { MetadataRoute } from 'next';
import { projects } from '@/lib/portfolio';
import { services } from '@/lib/services';
import { prisma } from '@/lib/prisma';

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    return await buildSitemap();
  } catch {
    return [{ url: 'https://bitsolmarketing.com', lastModified: new Date(), priority: 1.0 }];
  }
}

async function buildSitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://bitsolmarketing.com';

  let blogPages: MetadataRoute.Sitemap = [];
  let latestPostUpdate: Date | undefined;
  try {
    const posts = await prisma.blog.findMany({
      where: { published: true },
      select: { slug: true, updatedAt: true },
      orderBy: { createdAt: 'desc' },
    });
    blogPages = posts.map((post) => ({
      url: `${baseUrl}/blog/${post.slug}`,
      lastModified: post.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));
    latestPostUpdate = posts.reduce<Date | undefined>(
      (latest, post) => (!latest || post.updatedAt > latest ? post.updatedAt : latest),
      undefined
    );
  } catch {
    // DB unavailable at build time — skip blog entries
  }

  // Only indexable URLs belong in the sitemap. /terms, /privacy, /refund,
  // /cookies and /compliance are noindex, so they are left out.
  //
  // lastModified is only set where a real date exists. Stamping every URL
  // with the request time made the dates meaningless, and Google ignores
  // lastmod values it can't trust. The homepage and blog index change when
  // a post is published, so they use the newest post date.
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${baseUrl}`,                                    priority: 1.0,  changeFrequency: 'weekly',  lastModified: latestPostUpdate },
    { url: `${baseUrl}/about`,                              priority: 0.9,  changeFrequency: 'monthly' },
    { url: `${baseUrl}/services`,                           priority: 0.95, changeFrequency: 'weekly' },
    { url: `${baseUrl}/pricing`,                            priority: 0.9,  changeFrequency: 'weekly' },
    { url: `${baseUrl}/blog`,                               priority: 0.9,  changeFrequency: 'daily',   lastModified: latestPostUpdate },
    { url: `${baseUrl}/contact`,                            priority: 0.9,  changeFrequency: 'monthly' },
    { url: `${baseUrl}/careers`,                            priority: 0.85, changeFrequency: 'monthly' },
    { url: `${baseUrl}/portfolio`,                          priority: 0.75, changeFrequency: 'weekly' },
    { url: `${baseUrl}/ai-solutions`,                       priority: 0.8,  changeFrequency: 'weekly' },
    { url: `${baseUrl}/trading`,                            priority: 0.75, changeFrequency: 'monthly' },
    { url: `${baseUrl}/courses`,                            priority: 0.7,  changeFrequency: 'monthly' },
    // City-specific pages — high local SEO priority
    { url: `${baseUrl}/digital-marketing-agency-karachi`,   priority: 0.9,  changeFrequency: 'weekly' },
    { url: `${baseUrl}/digital-marketing-agency-lahore`,    priority: 0.9,  changeFrequency: 'weekly' },
    { url: `${baseUrl}/digital-marketing-agency-islamabad`, priority: 0.9,  changeFrequency: 'weekly' },
  ];

  const servicePages = services.map((service) => ({
    url: `${baseUrl}/services/${service.slug}`,
    changeFrequency: 'weekly' as const,
    priority: 0.9,
  }));

  const portfolioPages = projects.map((project) => ({
    url: `${baseUrl}/portfolio/${project.slug}`,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  return [...staticPages, ...servicePages, ...portfolioPages, ...blogPages];
}
