"use client";

import dynamic from "next/dynamic";

export const Entropy = dynamic(
  () => import("@/components/ui/entropy").then((m) => m.Entropy),
  { ssr: false }
);

export const ContactPopup = dynamic(
  () => import("@/components/ContactPopup").then((m) => m.ContactPopup),
  { ssr: false }
);

export const FloatingDock = dynamic(
  () => import("@/components/FloatingDock").then((m) => m.FloatingDock),
  { ssr: false }
);

export const ChatWidget = dynamic(
  () => import("@/components/ChatWidget").then((m) => m.ChatWidget),
  { ssr: false }
);
