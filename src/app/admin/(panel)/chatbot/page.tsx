import { redirect } from "next/navigation";

/** The Chatbot module opens on its conversations; the other screens are in the sidebar. */
export default function ChatbotIndexPage() {
  redirect("/admin/chatbot/conversations");
}
