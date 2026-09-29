"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, X } from "lucide-react";

/**
 * BITSOL MARKETING — Master Chatbot widget.
 *
 * The chatbot itself is the standalone scripted app that lives in
 * `public/chatbot/`. We embed it in a same-origin <iframe> so its dark-glass
 * theme and imperative DOM logic stay fully isolated from the site's Tailwind
 * styles (X-Frame-Options: SAMEORIGIN allows this — see next.config.ts).
 *
 * The iframe is lazy-mounted on first open and kept alive afterwards, so the
 * conversation persists when the user minimises and reopens the panel, and no
 * chatbot assets load until someone actually wants to chat.
 */
export function ChatWidget() {
  const [open, setOpen] = useState(false);
  // Becomes true the first time the panel is opened; keeps the iframe mounted.
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (open) setLoaded(true);
  }, [open]);

  // Close on Escape for keyboard users.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* Chat panel — mounted once opened, then kept in the DOM (hidden, not
          unmounted) so the iframe stays alive and the conversation persists
          across minimise/reopen. */}
      {loaded && (
        <motion.div
          initial={false}
          animate={
            open
              ? { opacity: 1, y: 0, scale: 1, visibility: "visible" }
              : { opacity: 0, y: 24, scale: 0.96, transitionEnd: { visibility: "hidden" } }
          }
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
          style={{ pointerEvents: open ? "auto" : "none" }}
          className="fixed z-[255] overflow-hidden rounded-3xl border border-white/10 bg-[#060b1e] shadow-2xl shadow-black/50
                     bottom-4 right-4 left-4 top-4
                     sm:left-auto sm:top-auto sm:bottom-24 sm:right-6 sm:h-[min(640px,80vh)] sm:w-[390px] sm:max-w-[calc(100vw-3rem)]"
          role="dialog"
          aria-label="BITSOL Marketing AI Assistant"
          aria-hidden={!open}
        >
          {/* Close button overlaid on the chatbot's own header */}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close chat"
            tabIndex={open ? 0 : -1}
            className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white/80
                       backdrop-blur transition hover:bg-white/20 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>

          <iframe
            src="/chatbot/index.html"
            title="BITSOL Marketing AI Assistant"
            className="h-full w-full border-0"
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
          />
        </motion.div>
      )}

      {/* Floating action button */}
      <div className="fixed bottom-6 right-6 z-[254]">
        <motion.button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close chat assistant" : "Open chat assistant"}
          aria-expanded={open}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          className="relative grid h-14 w-14 place-items-center rounded-full text-white shadow-lg shadow-brand-purple/30
                     bg-gradient-to-br from-brand-cyan to-brand-purple focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/70"
        >
          {/* Pulsing ring — only while closed */}
          {!open && (
            <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-brand-cyan/40" />
          )}
          <AnimatePresence mode="wait" initial={false}>
            {open ? (
              <motion.span
                key="icon-close"
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <X className="h-6 w-6" />
              </motion.span>
            ) : (
              <motion.span
                key="icon-open"
                initial={{ rotate: 90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: -90, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <MessageSquare className="h-6 w-6" />
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
    </>
  );
}
