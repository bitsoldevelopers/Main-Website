"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, MessageSquare, X } from "lucide-react";
import { ChatPanel } from "@/components/chat/ChatPanel";

/**
 * BITSOL MARKETING — AI assistant widget.
 *
 * A floating button on every public page that opens the website chat. The
 * conversation runs through /api/chat, which answers from the knowledge base
 * and Chatbot Studio settings in the admin panel and files leads, consultation
 * requests and support tickets into the CRM.
 *
 * The panel is mounted on first open and kept alive afterwards, so the
 * conversation persists when the visitor minimises and reopens it, and no chat
 * code runs until someone actually wants to chat.
 */
export function ChatWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Becomes true the first time the panel is opened; keeps the panel mounted.
  // Adjusted during render (the React-recommended pattern) rather than in an effect.
  const [loaded, setLoaded] = useState(false);
  if (open && !loaded) setLoaded(true);

  // Close on Escape for keyboard users.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // /chat is the same assistant full-page; a second copy would share its transcript.
  if (pathname === "/chat") return null;

  return (
    <>
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
          className="fixed z-[255] flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20
                     bottom-4 right-4 left-4 top-4
                     sm:left-auto sm:top-auto sm:bottom-24 sm:right-6 sm:h-[min(660px,82vh)] sm:w-[400px] sm:max-w-[calc(100vw-3rem)]"
          role="dialog"
          aria-label="BITSOL Marketing AI assistant"
          aria-hidden={!open}
        >
          <header className="flex items-center gap-3 border-b border-slate-200 bg-slate-900 px-4 py-3 text-white">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-accent">
              <Bot className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="text-sm font-bold">BITSOL Marketing</p>
              <p className="text-[11px] text-white/70">AI assistant · replies in seconds, 24/7</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              tabIndex={open ? 0 : -1}
              className="grid h-8 w-8 place-items-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </header>
          <div className="min-h-0 flex-1">
            <ChatPanel variant="widget" />
          </div>
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
          className="relative grid h-14 w-14 place-items-center rounded-full bg-brand-accent text-white shadow-lg shadow-blue-500/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
        >
          {!open && <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-brand-accent/40" />}
          <AnimatePresence mode="wait" initial={false}>
            {open ? (
              <motion.span key="icon-close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
                <X className="h-6 w-6" />
              </motion.span>
            ) : (
              <motion.span key="icon-open" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
                <MessageSquare className="h-6 w-6" />
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
    </>
  );
}
