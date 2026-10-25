import "@/components/navbar/navbar.css";
import SmoothScroll from "@/components/SmoothScroll";
import Navbar from "@/components/navbar/Navbar";
import Footer from "@/components/Footer";
import { ContactPopup, FloatingDock, ChatWidget } from "@/components/ClientDynamics";

/**
 * Chrome shared by every public page: navbar, footer, smooth scrolling and
 * the floating contact/chat widgets. The admin panel lives outside this route
 * group so it gets none of it. `site-editorial` scopes the serif display type
 * in globals.css to the public site.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="site-editorial relative min-h-screen">
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
