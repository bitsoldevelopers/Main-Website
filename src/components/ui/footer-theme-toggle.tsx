"use client";

import { DIcons } from "@/components/ui/dicons";
import { useTheme } from "next-themes";

function handleScrollTop() {
  window.scroll({
    top: 0,
    behavior: "smooth",
  });
}

const FooterThemeToggle = () => {
  const { setTheme } = useTheme();

  return (
    <div className="flex items-center justify-center">
      <div className="flex items-center rounded-full border border-dotted border-slate-300 dark:border-white/20 p-1">
        <button
          onClick={() => setTheme("light")}
          className="bg-black mr-3 rounded-full p-2 text-white dark:bg-slate-800 dark:text-white hover:scale-110 transition-transform"
        >
          <DIcons.Sun className="h-5 w-5" strokeWidth={1} />
          <span className="sr-only">Light Mode</span>
        </button>

        <button type="button" onClick={handleScrollTop} className="hover:scale-110 transition-transform">
          <DIcons.ArrowUp className="h-4 w-4 text-brand-cyan" />
          <span className="sr-only">Top</span>
        </button>

        <button
          onClick={() => setTheme("dark")}
          className="bg-slate-200 dark:bg-black ml-3 rounded-full p-2 text-black dark:text-white hover:scale-110 transition-transform"
        >
          <DIcons.Moon className="h-5 w-5" strokeWidth={1} />
          <span className="sr-only">Dark Mode</span>
        </button>
      </div>
    </div>
  );
};

export default FooterThemeToggle;
