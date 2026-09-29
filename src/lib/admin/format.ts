const TIME_ZONE = "Asia/Karachi";

export function formatDate(value: Date | string, opts: { time?: boolean } = {}): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    ...(opts.time ? { timeStyle: "short" } : {}),
    timeZone: TIME_ZONE,
  }).format(new Date(value));
}

export function timeAgo(value: Date | string): string {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} mo ago`;
  return `${Math.round(months / 12)} y ago`;
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function wordCount(html: string): number {
  const text = stripHtml(html);
  return text ? text.split(" ").length : 0;
}

export function readTime(html: string): string {
  return `${Math.max(1, Math.round(wordCount(html) / 200))} min read`;
}

export function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}
