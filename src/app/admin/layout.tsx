import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Admin",
    template: "%s | BITSOL Admin",
  },
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

/**
 * The admin is always light, regardless of the visitor's theme choice on the
 * public site; color-scheme makes native controls (selects, checkboxes,
 * date pickers) match.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900" style={{ colorScheme: "light" }}>
      {children}
    </div>
  );
}
