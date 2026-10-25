"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import SearchComponent from "@/components/ui/animated-glowing-search-bar";
import { Search, X } from "lucide-react";

export function FloatingSearch() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="fixed bottom-28 right-8 z-[150] flex flex-col items-end">
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            className="mb-4"
          >
            <div className="relative">
              <SearchComponent />
              <button 
                onClick={() => setIsExpanded(false)}
                className="absolute -top-2 -right-2 w-8 h-8 bg-brand-purple rounded-full flex items-center justify-center text-white border-2 border-white dark:border-brand-dark shadow-lg z-50 hover:scale-110 transition-transform"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-colors duration-500 border-4 border-white dark:border-[#141414] ${
          isExpanded 
          ? "bg-brand-purple text-white" 
          : "bg-white dark:bg-white/10 backdrop-blur-xl text-slate-900 dark:text-brand-cyan"
        }`}
      >
        {isExpanded ? <X className="w-6 h-6" /> : <Search className="w-6 h-6" />}
      </motion.button>
    </div>
  );
}
