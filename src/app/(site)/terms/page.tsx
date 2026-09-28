import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Read BITSOL Marketing's Terms of Service governing use of our digital marketing, AI automation, and web development services.",
  alternates: { canonical: "https://bitsolmarketing.com/terms" },
  robots: { index: false, follow: false },
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" lastUpdated="May 2026" icon="terms">
      <h2>1. Acceptance of Terms</h2>
      <p>
        By accessing or using the BITSOL Marketing platform and services, you agree to be bound by these Terms of Service. If you do not agree to all of these terms, do not use our services.
      </p>

      <h2>2. Description of Service</h2>
      <p>
        BITSOL provides advanced digital marketing, AI automation, web development, and algorithmic trading solutions. Our services are subject to change or termination at our discretion without prior notice.
      </p>

      <h2>3. Intellectual Property</h2>
      <p>
        All content, including but not limited to code, designs, algorithms (such as the Nexus AI Engine), and trademarks, are the exclusive property of BITSOL Marketing Pvt Ltd. Unauthorized use, reproduction, or distribution is strictly prohibited.
      </p>

      <h2>4. User Obligations</h2>
      <ul>
        <li>You must provide accurate information when engaging with our platforms.</li>
        <li>You are responsible for maintaining the security of any credentials provided.</li>
        <li>You agree not to reverse engineer or attempt to extract source code from our proprietary engines.</li>
      </ul>

      <h2>5. Limitation of Liability</h2>
      <p>
        BITSOL shall not be liable for any indirect, incidental, or consequential damages resulting from the use or inability to use our services, including but not limited to financial losses in trading environments.
      </p>

      <h2>6. Governing Law</h2>
      <p>
        These terms are governed by the laws of Pakistan. Any disputes shall be resolved exclusively in the courts of Karachi.
      </p>
    </LegalPage>
  );
}
