"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import { ChevronDown, Search, Moon, Sun, Menu, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/Logo";
import { primaryNav } from "@/lib/navigation";
import { useOutsideClick } from "@/hooks/useOutsideClick";
import { MegaMenu } from "./MegaMenu";
import { MobileMenu } from "./MobileMenu";
import { SearchModal } from "./SearchModal";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useHasMounted } from "./NavPortal";

function ThemeIconButton() {
  const { theme, setTheme } = useTheme();
  const mounted = useHasMounted();

  return (
    <button
      type="button"
      aria-label="Toggle dark mode"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="flex h-10 w-10 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 hover:text-[#185FA5] dark:text-slate-300 dark:hover:bg-white/10"
    >
      {mounted && theme === "dark" ? (
        <Sun className="h-[18px] w-[18px]" strokeWidth={1.75} />
      ) : (
        <Moon className="h-[18px] w-[18px]" strokeWidth={1.75} />
      )}
    </button>
  );
}

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

  useEffect(() => {
    setOpenMenu(null);
    setMobileOpen(false);
  }, [pathname]);

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
      <div
        ref={navRef}
        className={`fixed inset-x-0 top-0 z-50 flex justify-center transition-[padding] duration-300 ${
          isScrolled ? "pt-3" : "pt-5"
        }`}
      >
        <motion.nav
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 26 }}
          className={`nav-glass relative flex w-[94%] max-w-[1500px] items-center justify-between rounded-[22px] px-5 transition-all duration-300 sm:px-7 ${
            isScrolled ? "h-[64px] nav-glass--scrolled" : "h-[80px]"
          }`}
        >
          {/* Logo */}
          <Link href="/" className="group/logo relative z-10 flex shrink-0 items-center gap-2.5">
            <motion.span
              whileHover={{ scale: 1.08, rotate: 6 }}
              transition={{ type: "spring", stiffness: 300, damping: 15 }}
              className={`relative flex items-center justify-center rounded-xl transition-all duration-300 ${
                isScrolled ? "h-9 w-9" : "h-11 w-11"
              }`}
            >
              <span className="absolute inset-0 rounded-xl bg-[#06B6D4]/0 blur-md transition-all duration-300 group-hover/logo:bg-[#06B6D4]/40" />
              <Logo className="relative h-full w-full" />
            </motion.span>
            <span
              className={`font-bold tracking-tight text-slate-900 transition-all duration-300 dark:text-white ${
                isScrolled ? "text-lg" : "text-xl"
              }`}
            >
              BITSOL<span className="text-[#06B6D4]">.</span>
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
                <div
                  key={item.name}
                  onMouseEnter={() => setOpenMenu(item.name)}
                >
                  <button
                    type="button"
                    aria-haspopup="true"
                    aria-expanded={openMenu === item.name ? "true" : "false"}
                    onClick={() => setOpenMenu(item.name)}
                    className="nav-link-underline flex items-center gap-1 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:text-[#185FA5] dark:text-slate-200 dark:hover:text-brand-cyan"
                  >
                    {item.name}
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
                  className="nav-link-underline px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:text-[#185FA5] dark:text-slate-200 dark:hover:text-brand-cyan"
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
              className="hidden h-10 w-10 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 hover:text-[#185FA5] sm:flex dark:text-slate-300 dark:hover:bg-white/10"
            >
              <Search className="h-[18px] w-[18px]" strokeWidth={1.75} />
            </button>
            <div className="hidden sm:block">
              <ThemeIconButton />
            </div>
            <div className="hidden lg:block">
              <LanguageSwitcher />
            </div>
            <Link href="/contact" className="hidden xl:block">
              <span className="ml-1 whitespace-nowrap px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-[#185FA5] dark:text-slate-300 dark:hover:text-brand-cyan">
                Book Consultation
              </span>
            </Link>
            <Link href="/pricing" className="ml-1 hidden md:block">
              <Button className="nav-cta-button gap-1.5 rounded-full px-5 py-5 text-sm font-bold">
                Get Started
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover/button:translate-x-0.5" />
              </Button>
            </Link>

            <button
              type="button"
              aria-label="Open navigation menu"
              aria-expanded={mobileOpen ? "true" : "false"}
              onClick={() => setMobileOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full text-slate-900 lg:hidden dark:text-white"
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
