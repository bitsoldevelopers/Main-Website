import type { Metadata } from "next";
import { Public_Sans } from "next/font/google";
import { DEFAULT_PREFS, PREFS_SCRIPT, prefsAttributes } from "@/lib/admin/prefs";
import "./admin-theme.css";

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

// The admin's own text face, independent of the public site's editorial type.
const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
  display: "swap",
});

/**
 * Root of every admin screen, including the login page. The theme
 * (light/dark, primary colour, menu and width) is chosen per browser in the
 * customizer; the inline script applies the saved choice before first paint,
 * which is why the attributes may differ from the server render.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const attrs = prefsAttributes(DEFAULT_PREFS, false);
  return (
    <div
      data-admin-root=""
      data-theme={attrs.theme}
      data-primary={attrs.primary}
      data-menu={attrs.menu}
      data-semidark={attrs.semidark}
      data-content={attrs.content}
      className={`admin-ui ${publicSans.variable}`}
      suppressHydrationWarning
    >
      <script dangerouslySetInnerHTML={{ __html: PREFS_SCRIPT }} />
      {children}
    </div>
  );
}
