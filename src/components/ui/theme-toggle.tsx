"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { motion } from "framer-motion"
import { useHasMounted } from "@/components/navbar/NavPortal"

export function ThemeToggle() {
  const { setTheme, theme } = useTheme()
  // The theme is only known in the browser: render nothing until then.
  const mounted = useHasMounted()

  if (!mounted) return null

  return (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="fixed bottom-8 right-8 z-[100] w-14 h-14 rounded-full bg-brand-cyan dark:bg-brand-purple text-brand-dark dark:text-white shadow-2xl flex items-center justify-center border-4 border-white dark:border-[#141414] transition-colors duration-500"
    >
      {theme === "dark" ? (
        <Sun className="w-6 h-6 animate-[spin_3s_linear_infinite]" />
      ) : (
        <Moon className="w-6 h-6" />
      )}
      <span className="sr-only">Toggle theme</span>
    </motion.button>
  )
}
