import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "BITSOL Marketing's Privacy Policy — how we collect, use, and protect your personal data.",
  alternates: { canonical: "https://bitsolmarketing.com/privacy" },
  robots: { index: false, follow: false },
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated="May 2026" icon="privacy">
      <h2>1. Information Collection</h2>
      <p>
        We collect information to provide better services to our clients. This includes information you provide (like your email through our contact forms) and information we collect automatically (like your device type and interaction with our 3D scenes).
      </p>

      <h2>2. Use of Information</h2>
      <p>
        Your data is used to:
      </p>
      <ul>
        <li>Deliver and optimize our digital services.</li>
        <li>Personalize your experience on our platform.</li>
        <li>Communicate project updates and marketing insights.</li>
        <li>Enhance the security of our AI and Trading engines.</li>
      </ul>

      <h2>3. Data Protection</h2>
      <p>
        We implement institutional-grade security measures, including end-to-end encryption and secure data lakes, to protect your personal information from unauthorized access or disclosure.
      </p>

      <h2>4. Third-Party Sharing</h2>
      <p>
        We do not sell your personal data. We only share information with trusted partners necessary to provide our services (e.g., cloud infrastructure providers) or when required by law.
      </p>

      <h2>5. Your Rights</h2>
      <p>
        You have the right to request access to, correction of, or deletion of your personal data held by BITSOL. Contact our data protection officer for such requests.
      </p>
    </LegalPage>
  );
}
