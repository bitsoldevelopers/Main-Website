import type { Metadata } from "next";
import ChatClient from "./ChatClient";

const TITLE = "Chat with our AI assistant";
const DESCRIPTION =
  "Ask the BITSOL Marketing AI assistant about AI chatbots, WhatsApp automation, websites and digital marketing. Get pricing, a quote or a free consultation in English or Urdu.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/chat" },
  openGraph: { url: "/chat", title: TITLE, description: DESCRIPTION },
};

/** The same assistant as the floating widget, on a page of its own. */
export default function ChatPage() {
  return (
    // Clears the fixed navbar at the top (the same offset the contact and blog
    // pages use) and the floating dock at the bottom.
    <section className="mx-auto w-full max-w-5xl px-4 pb-28 pt-28 sm:px-6 sm:pt-32">
      <h1 className="sr-only">BITSOL Marketing AI assistant: services, pricing, quotes and consultations</h1>
      <div className="flex h-[calc(100dvh-15.5rem)] max-h-[860px] min-h-[440px] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5">
        <ChatClient />
      </div>
    </section>
  );
}
