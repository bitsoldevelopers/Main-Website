import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Refund Policy",
  description:
    "BITSOL Marketing's Refund Policy — eligibility and terms for digital marketing, web development, and AI solutions.",
  alternates: { canonical: "https://bitsolmarketing.com/refund" },
  robots: { index: false, follow: false },
};

export default function RefundPage() {
  return (
    <LegalPage title="Refund Policy" lastUpdated="June 2026" icon="refund">
      <h2>1. Overview and Scope</h2>
      <p>
        At BITSOL Marketing, we design, architect, and deploy high-performance digital marketing campaigns, custom web applications, AI automation workflows (including Nexus AI Engine), and trading solutions. Because of the digital and custom-tailored nature of these services, refunds are subject to specific criteria to ensure mutual fairness.
      </p>

      <h2>2. Custom Development Projects</h2>
      <p>
        For client projects involving web development, software engineering, and AI solutions, payment schedules are typically structured around project milestones.
      </p>
      <ul>
        <li><strong>Deposits:</strong> Project initiation deposits or setup fees are fully refundable if requested in writing within 5 business days of signing the agreement, provided that no engineering work or project discovery has commenced.</li>
        <li><strong>Milestone Payments:</strong> Once work on a specific milestone has commenced and deliverables have been presented, the corresponding payment is non-refundable.</li>
        <li><strong>Project Cancellation:</strong> In the event of early project termination by the client, BITSOL retains the right to be compensated for all completed milestones and hours worked up to the date of formal cancellation.</li>
      </ul>

      <h2>3. Digital Marketing and Retainer Services</h2>
      <p>
        Digital marketing, search engine optimization (SEO), and social media management services are structured as recurring monthly subscription retainers.
      </p>
      <ul>
        <li><strong>No Retrospective Refunds:</strong> Refunds are not provided for months of service that have already been completed or are currently in progress.</li>
        <li><strong>Subscription Cancellation:</strong> Clients may cancel their monthly retainer at any time. To avoid billing for the subsequent cycle, written notice of cancellation must be submitted at least 15 days prior to the next billing date.</li>
      </ul>

      <h2>4. Non-Refundable Expenses</h2>
      <p>
        Certain third-party fees and operational costs incurred during the provision of our services are strictly non-refundable. These include, but are not limited to:
      </p>
      <ul>
        <li>Direct ad spend paid to platforms (Google Ads, Meta Ads, LinkedIn Ads, etc.).</li>
        <li>Third-party software, cloud infrastructure hosting, API keys, or domain name licensing purchased on behalf of the client.</li>
        <li>Set-up, onboarding, and platform configuration fees.</li>
      </ul>

      <h2>5. Refund Request Procedure</h2>
      <p>
        To request a refund on eligible components of your service, please submit a formal request:
      </p>
      <ul>
        <li><strong>Via Email:</strong> Send a detailed written request to <a href="mailto:billing@bitsolmarketing.com" className="text-brand-cyan font-bold hover:underline">billing@bitsolmarketing.com</a>.</li>
        <li><strong>Required Information:</strong> Include your company name, project name, the specific invoice number, and the detailed grounds for your refund request.</li>
      </ul>

      <h2>6. Processing and Timelines</h2>
      <p>
        Upon receipt, our billing department will review your request against your signed service agreement and project milestones. Approved refunds will be processed within 7 to 10 business days and will be returned to the client via the original payment method, unless otherwise agreed.
      </p>
    </LegalPage>
  );
}
