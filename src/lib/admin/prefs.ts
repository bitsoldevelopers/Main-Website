/**
 * Per-browser look-and-feel preferences for the admin panel (theme, primary
 * colour, menu, content width). They live in localStorage only: a
 * convenience, not account data, so a private window simply shows defaults.
 *
 * Server-safe on purpose: the admin layout imports PREFS_SCRIPT from here.
 * The React hook that reads and writes them is in
 * components/admin/shell/usePrefs.ts.
 */

export type ThemeMode = "light" | "dark" | "system";
export type PrimaryKey = "purple" | "blue" | "teal" | "rose";

export interface AdminPrefs {
  theme: ThemeMode;
  primary: PrimaryKey;
  menu: "expanded" | "collapsed";
  semiDark: boolean;
  content: "compact" | "wide";
}

export const DEFAULT_PREFS: AdminPrefs = {
  theme: "light",
  primary: "purple",
  menu: "expanded",
  semiDark: false,
  content: "compact",
};

/** Hex values mirror admin-theme.css; used for the customizer swatches. */
export const PRIMARY_OPTIONS: { key: PrimaryKey; label: string; hex: string }[] = [
  { key: "purple", label: "Purple", hex: "#7367f0" },
  { key: "blue", label: "BITSOL blue", hex: "#0066ff" },
  { key: "teal", label: "Teal", hex: "#0d9394" },
  { key: "rose", label: "Rose", hex: "#eb3d63" },
];

export const PREFS_KEY = "bitsol-admin-prefs";

export function parsePrefs(raw: string | null): AdminPrefs {
  if (!raw) return DEFAULT_PREFS;
  try {
    const value = JSON.parse(raw) as Partial<AdminPrefs>;
    return {
      theme: value.theme === "dark" || value.theme === "system" ? value.theme : "light",
      primary: PRIMARY_OPTIONS.some((o) => o.key === value.primary) ? (value.primary as PrimaryKey) : "purple",
      menu: value.menu === "collapsed" ? "collapsed" : "expanded",
      semiDark: value.semiDark === true,
      content: value.content === "wide" ? "wide" : "compact",
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

/** The data-* attributes on the admin root for a set of preferences. */
export function prefsAttributes(prefs: AdminPrefs, systemDark: boolean): Record<string, string> {
  const dark = prefs.theme === "dark" || (prefs.theme === "system" && systemDark);
  return {
    theme: dark ? "dark" : "light",
    primary: prefs.primary,
    menu: prefs.menu,
    semidark: prefs.semiDark ? "1" : "0",
    content: prefs.content,
  };
}

/**
 * Runs inline as the first child of the admin root, before anything paints,
 * so a dark-mode user never sees a light flash. Mirrors parsePrefs and
 * prefsAttributes in plain ES5.
 */
export const PREFS_SCRIPT = `(function(){try{var r=document.currentScript&&document.currentScript.parentElement;if(!r)return;var p={};try{p=JSON.parse(localStorage.getItem(${JSON.stringify(
  PREFS_KEY
)})||"{}")||{}}catch(e){}var t=p.theme==="dark"||(p.theme==="system"&&window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches);r.setAttribute("data-theme",t?"dark":"light");if(["blue","teal","rose"].indexOf(p.primary)>-1)r.setAttribute("data-primary",p.primary);if(p.menu==="collapsed")r.setAttribute("data-menu","collapsed");if(p.semiDark===true)r.setAttribute("data-semidark","1");if(p.content==="wide")r.setAttribute("data-content","wide")}catch(e){}})();`;
