import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description:
    "How BITSOL Marketing uses essential, performance and analytics cookies on this website, and how you can manage them.",
  alternates: { canonical: "https://bitsolmarketing.com/cookies" },
  robots: { index: false, follow: false },
};

export default function CookiesPage() {
  return (
    <LegalPage title="Cookie Policy" lastUpdated="May 2026" icon="cookies">
      <h2>1. What are Cookies?</h2>
      <p>
        Cookies are small text files stored on your device that help our website function efficiently and provide us with analytical insights.
      </p>

      <h2>2. How We Use Cookies</h2>
      <p>
        BITSOL uses cookies for several purposes:
      </p>
      <ul>
        <li><strong>Essential:</strong> Necessary for the site to function, such as maintaining your theme preferences.</li>
        <li><strong>Performance:</strong> Helps us understand how you interact with our 3D hero sections and dynamic routes.</li>
        <li><strong>Analytics:</strong> Used to track project interest and optimize our funnel performance.</li>
      </ul>

      <h2>3. Third-Party Cookies</h2>
      <p>
        We may use third-party services like Google Analytics or LinkedIn Insight Tags to measure the effectiveness of our marketing campaigns.
      </p>

      <h2>4. Managing Cookies</h2>
      <p>
        You can control and/or delete cookies as you wish through your browser settings. However, disabling cookies may affect the functionality of our interactive components, such as the MacOS Dock.
      </p>
    </LegalPage>
  );
}
