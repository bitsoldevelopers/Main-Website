import { NextResponse } from "next/server";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/admin/activity";
import { materializeContacts } from "@/lib/automation/lead-contacts";
import { recordActivity } from "@/lib/automation/timeline";
import { clientIp, rateLimit, sweepExpired } from "@/lib/rate-limit";

const resend = new Resend(process.env.RESEND_API_KEY || "re_dummy");

const MAX = { name: 120, email: 191, phone: 40, company: 120, service: 60, message: 5000, url: 500, utm: 191 };

function field(body: Record<string, unknown>, key: string, max: number): string {
  const value = body[key];
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Public contact form intake. The database row is the primary record; email
 * is a best-effort notification on top. Bots are handled by a honeypot field
 * and a per-IP rate limit rather than a captcha.
 */
export async function POST(req: Request) {
  try {
    sweepExpired();
    const ip = clientIp(req);
    if (!rateLimit(`contact:${ip}`, 5, 60_000)) {
      return NextResponse.json({ error: "Too many requests. Please try again in a minute." }, { status: 429 });
    }

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Honeypot: real visitors never see this field. Pretend success.
    if (field(body, "website", 200)) {
      return NextResponse.json({ success: true, leadId: "ok" }, { status: 200 });
    }

    const name = field(body, "name", MAX.name);
    const email = field(body, "email", MAX.email);
    const message = field(body, "message", MAX.message);
    const service = field(body, "service", MAX.service);
    const phone = field(body, "phone", MAX.phone);
    const company = field(body, "company", MAX.company);
    const pageUrl = field(body, "pageUrl", MAX.url);
    const utmSource = field(body, "utmSource", MAX.utm);
    const utmMedium = field(body, "utmMedium", MAX.utm);
    const utmCampaign = field(body, "utmCampaign", MAX.utm);

    if (!name || !email || !message) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
    }

    // Save lead to database — the primary record. Email failing must not lose it.
    let leadId: string | null = null;
    try {
      const lead = await prisma.lead.create({
        data: {
          name,
          email,
          subject: service || "General Inquiry",
          message,
          status: "NEW",
          phone: phone || null,
          company: company || null,
          source: "website",
          pageUrl: pageUrl || null,
          utmSource: utmSource || null,
          utmMedium: utmMedium || null,
          utmCampaign: utmCampaign || null,
        },
      });
      leadId = lead.id;
      // Contact rows and the timeline are extras on top of the lead itself,
      // so they are written afterwards and can never cost us the inquiry.
      void materializeContacts(lead.id)
        .then(() =>
          recordActivity({
            leadId: lead.id,
            type: "LEAD_CREATED",
            title: "Inquiry received from the website",
            detail: pageUrl || null,
            actor: "Website visitor",
          })
        )
        .catch(() => {});
      void logActivity({
        actor: "Website visitor",
        action: "lead.created",
        entity: "lead",
        entityId: lead.id,
        detail: `${name} <${email}> — ${service || "General Inquiry"}${utmCampaign ? ` (campaign: ${utmCampaign})` : ""}`,
      });
    } catch (dbError) {
      console.error("Failed to save lead to database, proceeding with email fallback:", dbError);
    }

    // Best-effort notification email.
    if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== "re_dummy") {
      try {
        await resend.emails.send({
          from: "BITSOL Leads <leads@bitsolmarketing.com>",
          to: "adnan.bashir7895@gmail.com",
          subject: `New Lead: ${name}${service ? ` - ${service}` : ""}`,
          html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
              <h2 style="color: #00D9FF;">New Inquiry from BITSOL Website</h2>
              <p><strong>Name:</strong> ${escapeHtml(name)}</p>
              <p><strong>Email:</strong> ${escapeHtml(email)}</p>
              ${phone ? `<p><strong>Phone / WhatsApp:</strong> ${escapeHtml(phone)}</p>` : ""}
              ${company ? `<p><strong>Company:</strong> ${escapeHtml(company)}</p>` : ""}
              <p><strong>Interested Service:</strong> ${escapeHtml(service || "General Inquiry")}</p>
              ${pageUrl ? `<p><strong>Submitted from:</strong> ${escapeHtml(pageUrl)}</p>` : ""}
              ${utmCampaign ? `<p><strong>Campaign:</strong> ${escapeHtml(utmCampaign)} (${escapeHtml(utmSource)}/${escapeHtml(utmMedium)})</p>` : ""}
              <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
              <p><strong>Message:</strong></p>
              <p style="background: #f9f9f9; padding: 15px; border-radius: 8px;">${escapeHtml(message)}</p>
              ${leadId ? `<p><a href="https://bitsolmarketing.com/admin/leads/${leadId}">Open in the admin panel</a></p>` : "<p><em>Warning: the database write failed; this email is the only record.</em></p>"}
            </div>
          `,
        });
      } catch (emailError) {
        console.error("Failed to send email via Resend:", emailError);
      }
    }

    if (!leadId) {
      // Both stores failing is worth surfacing to the visitor.
      if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === "re_dummy") {
        return NextResponse.json({ error: "Failed to process inquiry" }, { status: 500 });
      }
      leadId = "email-only";
    }

    return NextResponse.json({ success: true, leadId }, { status: 200 });
  } catch (error) {
    console.error("Lead submission error:", error);
    return NextResponse.json({ error: "Failed to process inquiry" }, { status: 500 });
  }
}
