/**
 * Renders JSON-LD as a plain <script> in the server HTML, so crawlers that
 * don't execute JavaScript still see the structured data. (next/script only
 * injects it after hydration.) `<` is escaped so values can't close the tag.
 */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\u003c"),
      }}
    />
  );
}
