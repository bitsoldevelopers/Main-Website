import "@/components/navbar/navbar.css";
import SmoothScroll from "@/components/SmoothScroll";
import Navbar from "@/components/navbar/Navbar";
import Footer from "@/components/Footer";
import { Entropy, ContactPopup, FloatingDock, ChatWidget } from "@/components/ClientDynamics";

/**
 * Chrome shared by every public page: navbar, footer, smooth scrolling, the
 * particle background and the floating contact/chat widgets. The admin panel
 * lives outside this route group so it gets none of it.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen">
      <Entropy className="opacity-40" />
      <SmoothScroll>
        <div className="relative z-10 flex min-h-screen flex-col">
          <Navbar />
          <main className="flex-grow">{children}</main>
          <Footer />
        </div>
      </SmoothScroll>
      <ContactPopup />
      <FloatingDock />
      <ChatWidget />
    </div>
  );
}
