"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Bot,
  CalendarCheck,
  CheckCircle2,
  FileText,
  Globe,
  LifeBuoy,
  MessageCircle,
  Mic,
  MicOff,
  RotateCcw,
  Send,
  Square,
  TrendingUp,
  User2,
} from "lucide-react";
import { detectLanguage, speechTagFor, t, type Language } from "@/lib/i18n";
import { cn, generateConversationReference, isUrduScript, shortId } from "@/lib/utils";
import type { CapturedRecord, ChatMessage, ChatStreamEvent } from "@/types/chat";

/**
 * =============================================================================
 *  BITSOL Marketing — website chat
 * =============================================================================
 *
 *  The conversation surface shared by the floating widget and the /chat page.
 *  Owns the transcript and the streaming request to /api/chat. The transcript
 *  is persisted with its conversation reference, which is what gives the
 *  conversation memory across reloads — and what the server keys the
 *  customer's details to.
 * =============================================================================
 */

const STORAGE_KEY = "bitsol.chat.v3";
const WHATSAPP_NUMBER = "923120141581";

interface PersistedState {
  reference: string;
  messages: ChatMessage[];
}

const SUGGESTIONS: Array<{ title: string; titleUr: string; prompt: string; icon: typeof Bot }> = [
  { title: "Build an AI chatbot", titleUr: "اے آئی چیٹ بوٹ بنوائیں", prompt: "I want an AI chatbot for my business. How does it work and what does it cost?", icon: Bot },
  { title: "WhatsApp automation", titleUr: "واٹس ایپ آٹومیشن", prompt: "Tell me about WhatsApp automation for my business.", icon: MessageCircle },
  { title: "Get more customers", titleUr: "زیادہ کسٹمرز حاصل کریں", prompt: "I want more customers from digital marketing. Where should I start?", icon: TrendingUp },
  { title: "Build a website", titleUr: "ویب سائٹ بنوائیں", prompt: "I need a website for my business. What's the process and pricing?", icon: Globe },
  { title: "Request a quote", titleUr: "قیمت درکار ہے", prompt: "I'd like to request a quote for a project.", icon: FileText },
  { title: "Book a free consultation", titleUr: "مفت مشاورت بُک کریں", prompt: "I'd like to book a free consultation with your team.", icon: CalendarCheck },
];

const QUICK_REPLIES = ["Pricing", "Our services", "Request a quote", "Book a consultation", "اردو میں بتائیں"];

const RECEIPTS: Record<CapturedRecord["kind"], { label: string; icon: typeof CheckCircle2 }> = {
  LEAD: { label: "Your details are with our team", icon: CheckCircle2 },
  MEETING: { label: "Consultation requested — the team will confirm the time", icon: CalendarCheck },
  TICKET: { label: "Support ticket opened", icon: LifeBuoy },
};

/** The saved conversation, or a fresh one. Read once, on the client only. */
function restore(): PersistedState {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedState>;
      return {
        reference: typeof parsed.reference === "string" ? parsed.reference : generateConversationReference(),
        messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      };
    }
  } catch {
    // Corrupt or blocked storage — start fresh.
  }
  return { reference: generateConversationReference(), messages: [] };
}

/**
 * Rendered on the client only (the widget and /chat both load it without
 * server rendering), so the saved transcript can be read straight into state.
 */
export function ChatPanel({ variant = "widget" }: { variant?: "widget" | "page" }) {
  const [initial] = useState(restore);
  const [messages, setMessages] = useState<ChatMessage[]>(initial.messages);
  const [language, setLanguage] = useState<Language>("en");
  const [streaming, setStreaming] = useState(false);
  const [quickReplies, setQuickReplies] = useState<string[] | null>(null);

  const conversationRef = useRef<string>(initial.reference);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ---------------------------------------------------------------- persist --
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ reference: conversationRef.current, messages } satisfies PersistedState));
    } catch {
      // Quota or private-mode failure — the conversation still works in memory.
    }
  }, [messages]);

  useEffect(() => {
    if (!messages.length) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  // ------------------------------------------------------------------- send --
  const send = useCallback(
    async (text: string) => {
      if (streaming || !text.trim()) return;
      setLanguage(detectLanguage(text));

      const userMsg: ChatMessage = { id: shortId(12), role: "user", content: text };
      const assistantId = shortId(12);
      const history = [...messages, userMsg];

      setMessages([...history, { id: assistantId, role: "assistant", content: "" }]);
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;
      const finish = () => {
        if (abortRef.current !== controller) return;
        abortRef.current = null;
        setStreaming(false);
      };

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationRef: conversationRef.current,
            messages: history.map((m) => ({ role: m.role, content: m.content })),
            pageUrl: typeof window !== "undefined" ? window.location.pathname : undefined,
          }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          throw new Error((await res.json().catch(() => null))?.error ?? "Request failed");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let full = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice(5).trim();
            if (!payload) continue;

            let event: ChatStreamEvent;
            try {
              event = JSON.parse(payload);
            } catch {
              continue;
            }

            if (event.type === "meta") {
              setLanguage(event.language);
            } else if (event.type === "chunk") {
              full += event.text;
              setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: full } : m)));
            } else if (event.type === "done") {
              setQuickReplies(event.suggestions ?? null);
              finish();
            } else if (event.type === "capture") {
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, records: [...(m.records ?? []), ...event.records] } : m))
              );
            } else if (event.type === "error") {
              full = event.message;
              setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: full } : m)));
              finish();
            }
          }
        }
      } catch (err: unknown) {
        if ((err as { name?: string })?.name !== "AbortError") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: m.content || "Sorry, I couldn't reach the assistant. Please check your connection and try again." }
                : m
            )
          );
        }
      } finally {
        finish();
      }
    },
    [messages, streaming]
  );

  function stop() {
    abortRef.current?.abort();
    setStreaming(false);
  }

  function reset() {
    stop();
    conversationRef.current = generateConversationReference();
    setMessages([]);
    setQuickReplies(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  const isEmpty = messages.length === 0;
  const chips = quickReplies ?? QUICK_REPLIES;
  const lastMessage = messages[messages.length - 1];
  const awaitingFirstToken = streaming && lastMessage?.role === "assistant" && !lastMessage.content;
  const compact = variant === "widget";

  return (
    <div className="flex h-full min-h-0 flex-col bg-white text-slate-900">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2 sm:px-4">
        <span className="inline-flex items-center gap-2 text-[12px] text-slate-500">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          {t("chat.online", language)}
        </span>
        <div className="flex items-center gap-1">
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
          </a>
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <RotateCcw className="h-3.5 w-3.5" /> {t("chat.newChat", language)}
          </button>
        </div>
      </div>

      {/* Transcript */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5">
        {isEmpty ? (
          <div className="flex min-h-full flex-col justify-center gap-6 py-2">
            <div className={cn("text-center", !compact && "mx-auto max-w-xl")}>
              <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-brand-accent text-white shadow-lg shadow-blue-500/20">
                <Bot className="h-6 w-6" />
              </span>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">BITSOL Marketing · AI assistant</p>
              <h2 className={cn("mt-2 font-semibold tracking-tight text-slate-900", compact ? "text-xl" : "text-3xl")}>{t("welcome.title", language)}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{t("welcome.subtitle", language)}</p>
            </div>
            <div>
              <p className="mb-2 text-center text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">{t("chat.tryAsking", language)}</p>
              <div className={cn("grid gap-2", compact ? "grid-cols-1" : "mx-auto max-w-2xl sm:grid-cols-2")}>
                {SUGGESTIONS.map((topic) => (
                  <button
                    key={topic.title}
                    type="button"
                    onClick={() => void send(topic.prompt)}
                    className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left transition hover:-translate-y-0.5 hover:border-brand-accent hover:bg-white"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-brand-accent ring-1 ring-inset ring-slate-200 transition group-hover:bg-brand-accent group-hover:text-white">
                      <topic.icon className="h-4 w-4" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-sm font-semibold text-slate-900">{topic.title}</span>
                      <span className="urdu truncate text-xs text-slate-500">{topic.titleUr}</span>
                    </span>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-brand-accent" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className={cn("flex flex-col gap-4", !compact && "mx-auto max-w-3xl")}>
            {messages.map((message) =>
              message.role === "assistant" && !message.content && awaitingFirstToken ? (
                <div key={message.id} className="flex gap-2.5">
                  <Avatar role="assistant" />
                  <TypingIndicator />
                </div>
              ) : (
                <MessageBubble key={message.id} message={message} />
              )
            )}
          </div>
        )}
      </div>

      {/* Quick replies + composer */}
      <div className="border-t border-slate-200 px-3 pb-3 pt-2.5 sm:px-4">
        <div className={cn("space-y-2", !compact && "mx-auto max-w-3xl")}>
          {!isEmpty && chips.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none]">
              {chips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  disabled={streaming}
                  onClick={() => void send(chip)}
                  className={cn(
                    "shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-brand-accent hover:text-brand-accent disabled:opacity-50",
                    isUrduScript(chip) && "urdu"
                  )}
                >
                  {chip}
                </button>
              ))}
            </div>
          )}
          <Composer onSend={(text) => void send(text)} disabled={streaming} streaming={streaming} onStop={stop} placeholder={t("chat.placeholder", language)} />
          <p className="text-center text-[11px] text-slate-400">{t("chat.disclaimer", language)}</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Composer --

function Composer({
  onSend,
  disabled,
  streaming,
  onStop,
  placeholder,
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
  streaming?: boolean;
  onStop?: () => void;
  placeholder: string;
}) {
  const [value, setValue] = useState("");
  const [listening, setListening] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [value]);

  function submit() {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
  }

  function toggleVoice() {
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) {
      alert("Voice input isn't supported in this browser.");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const rec = new SR();
    rec.lang = speechTagFor(value);
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join("");
      setValue(transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  }

  return (
    <div className="flex items-end gap-1 rounded-2xl border border-slate-300 bg-white p-1.5 transition focus-within:border-brand-accent focus-within:shadow-[0_0_0_4px_rgba(0,102,255,0.1)]">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        rows={1}
        placeholder={placeholder}
        className={cn("max-h-36 flex-1 resize-none bg-transparent px-2 py-2.5 text-[14px] text-slate-900 outline-none placeholder:text-slate-400", isUrduScript(value) && "urdu")}
        disabled={disabled}
        aria-label="Message"
      />
      <button
        type="button"
        onClick={toggleVoice}
        disabled={disabled}
        aria-label={listening ? "Stop voice input" : "Start voice input"}
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-xl transition",
          listening ? "bg-red-500 text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
          "disabled:opacity-50"
        )}
      >
        {listening ? <MicOff className="h-4.5 w-4.5" /> : <Mic className="h-4.5 w-4.5" />}
      </button>
      {streaming ? (
        <button type="button" onClick={onStop} aria-label="Stop generating" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-900 text-white">
          <Square className="h-4 w-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={submit}
          disabled={disabled || !value.trim()}
          aria-label="Send message"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-accent text-white transition hover:brightness-110 disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}

// ----------------------------------------------------------------- Bubbles --

function Avatar({ role }: { role: "user" | "assistant" }) {
  return role === "user" ? (
    <span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-200" aria-hidden>
      <User2 className="h-3.5 w-3.5" />
    </span>
  ) : (
    <span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-accent text-white" aria-hidden>
      <Bot className="h-4 w-4" />
    </span>
  );
}

function TypingIndicator() {
  return (
    <div className="flex w-fit items-center gap-1.5 rounded-2xl rounded-tl-md border border-slate-200 bg-slate-50 px-4 py-3.5">
      <span className="sr-only">Assistant is typing…</span>
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-accent" style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const rtl = isUrduScript(message.content);

  return (
    <div className={cn("flex w-full gap-2.5", isUser ? "flex-row-reverse" : "flex-row")}>
      <Avatar role={message.role} />
      <div className={cn("flex min-w-0 max-w-[88%] flex-col gap-2", isUser ? "items-end" : "items-start")}>
        <div
          className={cn(
            "rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed",
            isUser ? "rounded-tr-md bg-brand-accent text-white" : "rounded-tl-md border border-slate-200 bg-slate-50 text-slate-900"
          )}
        >
          <div className={cn(rtl && "urdu")}>{renderContent(message.content, isUser)}</div>
        </div>

        {message.records?.map((record) => {
          const receipt = RECEIPTS[record.kind];
          return (
            <p
              key={record.reference}
              className="inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-0.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[12px] text-emerald-800"
            >
              <receipt.icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>{receipt.label}</span>
              <span className="font-mono text-[11px] tracking-wide">{record.reference}</span>
            </p>
          );
        })}
      </div>
    </div>
  );
}

/** Tiny formatter: headings, bullets, numbered steps and **bold** — no HTML injection. */
function renderContent(text: string, inverted: boolean) {
  return text.split("\n").map((line, i) => {
    const trimmed = line.trimStart();
    if (!trimmed) return <span key={i} className="block h-2" />;

    const heading = /^\*\*(.+)\*\*:?$/.exec(trimmed);
    if (heading) {
      return (
        <p key={i} className={cn("font-semibold", i > 0 && "mt-3")}>
          {heading[1]}
        </p>
      );
    }

    const bullet = /^([-*•])\s+/.exec(trimmed);
    const numbered = /^(\d+)\.\s+/.exec(trimmed);
    const clean = trimmed.replace(/^([-*•]|\d+\.)\s+/, "");

    if (bullet || numbered) {
      return (
        <p key={i} className={cn("flex gap-2", i > 0 && "mt-1")}>
          <span className={cn("select-none font-semibold", inverted ? "text-white/80" : "text-brand-accent")}>{numbered ? `${numbered[1]}.` : "•"}</span>
          <span>{formatInline(clean)}</span>
        </p>
      );
    }

    return (
      <p key={i} className={cn(i > 0 && "mt-1.5")}>
        {formatInline(line)}
      </p>
    );
  });
}

function formatInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|_[^_]+_)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.length > 2 && part.startsWith("_") && part.endsWith("_")) {
      return (
        <em key={i} className="opacity-80">
          {part.slice(1, -1)}
        </em>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
