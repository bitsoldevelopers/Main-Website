import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Compliance",
  description:
    "BITSOL Marketing's approach to regulatory standards, fintech and trading compliance, AI ethics, data sovereignty and audits.",
  alternates: { canonical: "https://bitsolmarketing.com/compliance" },
  robots: { index: false, follow: false },
};

export default function CompliancePage() {
  return (
    <LegalPage title="Compliance" lastUpdated="May 2026" icon="compliance">
      <h2>1. Regulatory Standards</h2>
      <p>
        BITSOL Marketing operates in full compliance with local and international digital standards. Our technical architectures are built to adhere to global best practices for data integrity and algorithmic transparency.
      </p>

      <h2>2. FinTech & Trading Compliance</h2>
      <p>
        Our trading solutions, including AlphaTrade Pro, are designed to follow the regulatory frameworks set by the Securities and Exchange Commission of Pakistan (SECP) and relevant international exchange standards. We prioritize market integrity and risk management.
      </p>

      <h2>3. AI Ethics & Transparency</h2>
      <p>
        We are committed to ethical AI development. Our Nexus AI Engine is designed with transparency layers to ensure automated decisions are explainable and free from algorithmic bias.
      </p>

      <h2>4. Data Sovereignty</h2>
      <p>
        We respect data sovereignty and implement localized data storage solutions where required by law, ensuring that client data is managed within appropriate jurisdictional boundaries.
      </p>

      <h2>5. Audits and Certifications</h2>
      <p>
        BITSOL undergoes regular internal audits to ensure our security protocols and development workflows meet the highest industry standards.
      </p>
    </LegalPage>
  );
}
