"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Search, Menu, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/Logo";
import { primaryNav } from "@/lib/navigation";
import { useOutsideClick } from "@/hooks/useOutsideClick";
import { MegaMenu } from "./MegaMenu";
import { MobileMenu } from "./MobileMenu";
import { SearchModal } from "./SearchModal";
import { LanguageSwitcher } from "./LanguageSwitcher";

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);
  const navRowRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();

  const clearCloseTimer = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const scheduleClose = useCallback(() => {
    clearCloseTimer();
    closeTimer.current = setTimeout(() => setOpenMenu(null), 200);
  }, []);

  useOutsideClick(navRowRef, () => setOpenMenu(null), openMenu !== null);

  // The dot under the current section's link.
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  // Close any open menu when the route changes. Adjusting state during render
  // (guarded by the comparison) is the React-recommended form of this.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    setOpenMenu(null);
    setMobileOpen(false);
  }

  useEffect(() => {
    const handler = () => setIsScrolled(window.scrollY > 80);
    handler();
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => {
    const updateHeight = () => {
      if (navRef.current) {
        document.documentElement.style.setProperty(
          "--nav-height",
          `${navRef.current.offsetHeight}px`
        );
      }
    };
    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, [isScrolled]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenu(null);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <div ref={navRef} className="fixed inset-x-0 top-0 z-50">
        <motion.nav
          initial={{ y: -24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 26 }}
          className={`nav-glass relative flex w-full items-center justify-between px-6 md:px-[72px] ${
            isScrolled ? "h-[72px] nav-glass--scrolled" : "h-[80px] lg:h-[96px]"
          }`}
        >
          {/* Logo */}
          <Link href="/" className="relative z-10 flex shrink-0 items-center gap-2.5">
            <span
              className={`relative flex items-center justify-center transition-all duration-300 ${
                isScrolled ? "h-9 w-9" : "h-10 w-10"
              }`}
            >
              <Logo className="h-full w-full" />
            </span>
            <span className="font-heading text-[22px] tracking-tight text-foreground">
              BITSOL<span className="text-[#0066ff]">.</span>
            </span>
          </Link>

          {/* Desktop center nav */}
          <div
            ref={navRowRef}
            onMouseEnter={clearCloseTimer}
            onMouseLeave={scheduleClose}
            className="hidden items-center lg:flex"
          >
            {primaryNav.map((item) =>
              item.columns ? (
                // The label is a real link to the hub page and the chevron
                // opens the menu. When the whole item was a button, the
                // header linked to /services, /ai-solutions and /courses only
                // from inside the mega menu, which isn't in the HTML until it
                // opens — so crawlers never saw those links.
                <div
                  key={item.name}
                  onMouseEnter={() => setOpenMenu(item.name)}
                  className={`nav-link-underline flex items-center gap-1 px-5 py-2 text-[15px] text-foreground transition-colors ${
                    isActive(item.href) ? "is-active" : ""
                  }`}
                >
                  <Link href={item.href}>{item.name}</Link>
                  <button
                    type="button"
                    aria-haspopup="true"
                    aria-expanded={openMenu === item.name ? "true" : "false"}
                    aria-label={`Show ${item.name} menu`}
                    onClick={() => setOpenMenu(item.name)}
                    className="flex items-center"
                  >
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform duration-300 ${
                        openMenu === item.name ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                </div>
              ) : (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`nav-link-underline px-5 py-2 text-[15px] text-foreground transition-colors ${
                    isActive(item.href) ? "is-active" : ""
                  }`}
                >
                  {item.name}
                </Link>
              )
            )}
          </div>

          <AnimatePresence>
            {openMenu && (
              <div
                onMouseEnter={clearCloseTimer}
                onMouseLeave={scheduleClose}
              >
                <MegaMenu
                  columns={primaryNav.find((i) => i.name === openMenu)?.columns ?? []}
                  hub={(() => {
                    const item = primaryNav.find((i) => i.name === openMenu);
                    return item ? { name: item.name, href: item.href } : undefined;
                  })()}
                  onNavigate={() => setOpenMenu(null)}
                />
              </div>
            )}
          </AnimatePresence>

          {/* Right section */}
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              aria-label="Search"
              onClick={() => setSearchOpen(true)}
              className="hidden h-10 w-10 items-center justify-center rounded-full text-foreground/70 transition-colors hover:bg-foreground/5 hover:text-foreground sm:flex"
            >
              <Search className="h-[18px] w-[18px]" strokeWidth={1.75} />
            </button>
            <div className="hidden lg:block">
              <LanguageSwitcher />
            </div>
            <Link href="/contact" className="ml-1 hidden md:block">
              <Button className="nav-cta-button gap-1.5 px-5 text-sm font-medium">
                Book a call
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover/button:translate-x-0.5" />
              </Button>
            </Link>

            <button
              type="button"
              aria-label="Open navigation menu"
              aria-expanded={mobileOpen ? "true" : "false"}
              onClick={() => setMobileOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full text-foreground lg:hidden"
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </motion.nav>
      </div>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
      <MobileMenu open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </>
  );
}
