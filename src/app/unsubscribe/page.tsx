import type { Metadata } from "next";
import { readUnsubscribeToken } from "@/lib/automation/crypto";
import { UnsubscribeForm } from "./UnsubscribeForm";

export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
};

/**
 * Where the unsubscribe link in an outreach email lands. Opening the page
 * changes nothing (mail scanners open links); the reader confirms with one
 * button. Outside the (site) group on purpose: no navbar, pop-ups or chat.
 */
export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = (await searchParams).token;
  const token = Array.isArray(raw) ? raw[0] : raw;
  const subject = readUnsubscribeToken(token);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-16 text-slate-900" style={{ colorScheme: "light" }}>
      <main className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-900/5">
        <p className="mb-6 text-lg font-bold">
          BITSOL<span className="text-cyan-700">.</span>
        </p>
        {subject && token ? (
          <UnsubscribeForm token={token} email={subject.email} />
        ) : (
          <>
            <h1 className="text-xl font-semibold">This link is not valid</h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              The unsubscribe link is incomplete or was changed. Use the link at the bottom of the email you received, or
              write to{" "}
              <a href="mailto:info@bitsolmarketing.com?subject=Unsubscribe" className="font-semibold text-cyan-700 underline">
                info@bitsolmarketing.com
              </a>{" "}
              and we will remove you by hand.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
