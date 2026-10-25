"use client";

import dynamic from "next/dynamic";

/**
 * The chat surface reads the saved transcript from the browser as it mounts,
 * so it is loaded without server rendering, like the floating widget.
 */
const ChatPanel = dynamic(() => import("@/components/chat/ChatPanel").then((m) => m.ChatPanel), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-slate-500" aria-busy="true">
      Loading the assistant…
    </div>
  ),
});

export default function ChatClient() {
  return <ChatPanel variant="page" />;
}
