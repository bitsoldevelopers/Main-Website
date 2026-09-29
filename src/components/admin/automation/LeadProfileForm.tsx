"use client";

import { useActionState } from "react";
import Link from "next/link";
import { saveLeadProfile } from "@/app/admin/actions-leads";
import type { FormState } from "@/app/admin/actions";
import { LEAD_PRIORITIES, LEAD_PRIORITY_META, LEAD_STATUSES, LEAD_STATUS_META, SERVICE_LABELS } from "@/lib/admin/leads";
import { Field, FormError, btn, inputClass, selectClass } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";

export interface LeadProfileValues {
  id?: string;
  kind: "inquiry" | "application" | "prospect";
  firstName: string;
  lastName: string;
  jobTitle: string;
  company: string;
  website: string;
  linkedinUrl: string;
  contactLocation: string;
  city: string;
  country: string;
  companyDescription: string;
  emails: { PRIMARY: string; SECONDARY: string; PERSONAL: string };
  phones: { PRIMARY: string; SECONDARY: string; TERTIARY: string; COMPANY: string };
  subject: string;
  message: string;
  status: string;
  priority: string;
}

export const EMPTY_LEAD: LeadProfileValues = {
  kind: "inquiry",
  firstName: "",
  lastName: "",
  jobTitle: "",
  company: "",
  website: "",
  linkedinUrl: "",
  contactLocation: "",
  city: "",
  country: "",
  companyDescription: "",
  emails: { PRIMARY: "", SECONDARY: "", PERSONAL: "" },
  phones: { PRIMARY: "", SECONDARY: "", TERTIARY: "", COMPANY: "" },
  subject: "",
  message: "",
  status: "NEW",
  priority: "NORMAL",
};

const EMAILS = [
  { type: "PRIMARY", label: "Email 1", hint: "Work address. First choice for outreach." },
  { type: "SECONDARY", label: "Email 2", hint: "Used when Email 1 cannot be." },
  { type: "PERSONAL", label: "Personal Email", hint: "Last choice." },
] as const;

const PHONES = [
  { type: "PRIMARY", label: "Contact Phone 1" },
  { type: "SECONDARY", label: "Contact Phone 2" },
  { type: "TERTIARY", label: "Contact Phone 3" },
  { type: "COMPANY", label: "Company Phone 1" },
] as const;

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-5 border-t border-slate-100 pt-6 first:border-0 first:pt-0 lg:grid-cols-[220px_minmax(0,1fr)]">
      <div>
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        {description && <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p>}
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

/**
 * One form for every lead: the contact, the three emails and four phones
 * (each its own field, as in the source sheet), the company, and for
 * inquiries what they asked about.
 */
export function LeadProfileForm({ initial = EMPTY_LEAD }: { initial?: LeadProfileValues }) {
  const [state, formAction] = useActionState<FormState, FormData>(saveLeadProfile, null);
  const errors = state?.fieldErrors ?? {};
  const backHref = initial.id ? `/admin/leads/${initial.id}` : "/admin/leads";

  return (
    <form action={formAction} className="space-y-6">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <FormError message={state?.error} />

      <Section title="Contact">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="First name" htmlFor="lead-first" error={errors.firstName}>
            <input id="lead-first" name="firstName" defaultValue={initial.firstName} placeholder="John" className={inputClass} />
          </Field>
          <Field label="Last name" htmlFor="lead-last">
            <input id="lead-last" name="lastName" defaultValue={initial.lastName} placeholder="Smith" className={inputClass} />
          </Field>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Title" htmlFor="lead-title">
            <input id="lead-title" name="jobTitle" defaultValue={initial.jobTitle} placeholder="Marketing Director" className={inputClass} />
          </Field>
          <Field label="Location" htmlFor="lead-location">
            <input id="lead-location" name="contactLocation" defaultValue={initial.contactLocation} placeholder="Dubai, UAE" className={inputClass} />
          </Field>
        </div>
        {(initial.city || initial.country || initial.kind !== "prospect") && (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="City" htmlFor="lead-city">
              <input id="lead-city" name="city" defaultValue={initial.city} placeholder="Lahore" className={inputClass} />
            </Field>
            <Field label="Country" htmlFor="lead-country">
              <input id="lead-country" name="country" defaultValue={initial.country} placeholder="Pakistan" className={inputClass} />
            </Field>
          </div>
        )}
      </Section>

      <Section title="Emails" description="Kept separate. Automations send to one of them; which one is chosen on the lead's profile.">
        {EMAILS.map((email) => (
          <Field key={email.type} label={email.label} htmlFor={`lead-email-${email.type}`} error={errors[`email_${email.type}`]} hint={email.hint}>
            <input
              id={`lead-email-${email.type}`}
              name={`email_${email.type}`}
              type="text"
              inputMode="email"
              autoComplete="off"
              defaultValue={initial.emails[email.type]}
              placeholder={email.type === "PERSONAL" ? "johnsmith@gmail.com" : "john@company.com"}
              className={inputClass}
            />
          </Field>
        ))}
      </Section>

      <Section title="Phones">
        <div className="grid gap-5 sm:grid-cols-2">
          {PHONES.map((phone) => (
            <Field key={phone.type} label={phone.label} htmlFor={`lead-phone-${phone.type}`} error={errors[`phone_${phone.type}`]}>
              <input
                id={`lead-phone-${phone.type}`}
                name={`phone_${phone.type}`}
                type="tel"
                autoComplete="off"
                defaultValue={initial.phones[phone.type]}
                placeholder="+92 300 1234567"
                className={inputClass}
              />
            </Field>
          ))}
        </div>
      </Section>

      <Section title="Online">
        <Field label="LinkedIn profile" htmlFor="lead-linkedin" error={errors.linkedinUrl}>
          <input id="lead-linkedin" name="linkedinUrl" defaultValue={initial.linkedinUrl} placeholder="https://www.linkedin.com/in/john-smith" className={inputClass} />
        </Field>
        <Field label="Website" htmlFor="lead-website" error={errors.website}>
          <input id="lead-website" name="website" defaultValue={initial.website} placeholder="company.com" className={inputClass} />
        </Field>
      </Section>

      <Section title="Company" description="Contacts with the same company name share one company record.">
        <Field label="Company name" htmlFor="lead-company">
          <input id="lead-company" name="company" defaultValue={initial.company} placeholder="ABC Technologies" className={inputClass} />
        </Field>
        <Field label="Company description" htmlFor="lead-description" hint="Stored in full. It is what a personalised line is written from.">
          <textarea id="lead-description" name="companyDescription" rows={5} defaultValue={initial.companyDescription} className={inputClass} />
        </Field>
      </Section>

      {initial.kind !== "prospect" && (
        <Section title={initial.kind === "application" ? "Application" : "Inquiry"} description="What they asked for, in their words.">
          <Field label="Service / topic" htmlFor="lead-subject" hint="Free text; the service codes used by the contact form are suggested for consistency.">
            <input id="lead-subject" name="subject" defaultValue={initial.subject} placeholder={`e.g. ${Object.values(SERVICE_LABELS).slice(0, 3).join(", ")}…`} className={inputClass} list="lead-subject-options" />
            <datalist id="lead-subject-options">
              {Object.entries(SERVICE_LABELS).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </datalist>
          </Field>
          <Field label="Message / context" htmlFor="lead-message">
            <textarea id="lead-message" name="message" rows={4} defaultValue={initial.message} placeholder="Where this lead came from and what they need." className={inputClass} />
          </Field>
        </Section>
      )}

      <Section title="Pipeline">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Status" htmlFor="lead-status" error={errors.status} hint="Won, lost, replied or not interested end any automation for this lead.">
            <select id="lead-status" name="status" defaultValue={initial.status} className={selectClass}>
              {LEAD_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {LEAD_STATUS_META[status].label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Priority" htmlFor="lead-priority" error={errors.priority}>
            <select id="lead-priority" name="priority" defaultValue={initial.priority} className={selectClass}>
              {LEAD_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {LEAD_PRIORITY_META[priority].label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Section>

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-6">
        <SubmitButton pendingText="Saving…">{initial.id ? "Save lead" : "Add lead"}</SubmitButton>
        <Link href={backHref} className={btn.secondary}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
