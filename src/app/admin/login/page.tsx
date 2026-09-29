"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, AtSign, KeyRound, Loader2 } from "lucide-react";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(email.trim() ? { email: email.trim(), password } : { password }),
      });

      if (res.ok) {
        router.push("/admin");
        router.refresh();
        return;
      }
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Invalid password");
    } catch {
      setError("Could not reach the server. Try again.");
    }
    setLoading(false);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-cyan-50 blur-[140px]" />
      <div className="pointer-events-none absolute -bottom-40 right-0 h-[420px] w-[420px] rounded-full bg-violet-100 blur-[140px]" />

      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-sm rounded-3xl border border-slate-300 bg-white p-8 shadow-2xl shadow-slate-900/10 backdrop-blur-xl"
      >
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-brand-cyan to-brand-purple font-black text-brand-dark">
            B
          </div>
          <div>
            <p className="text-lg font-bold leading-tight">
              BITSOL<span className="text-cyan-700">.</span>
            </p>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Admin console</p>
          </div>
        </div>

        <h1 className="mb-1 text-xl font-semibold">Sign in</h1>
        <p className="mb-6 text-sm text-slate-500">
          Use your team account, or leave the email empty to sign in with the owner password.
        </p>

        {error && (
          <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <label htmlFor="admin-email" className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-500">
          Email <span className="font-normal normal-case tracking-normal text-slate-400">(optional)</span>
        </label>
        <div className="relative mb-5">
          <AtSign className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            id="admin-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@bitsolmarketing.com"
            className="w-full rounded-xl border border-slate-300 bg-slate-100 py-3 pl-11 pr-4 text-slate-900 placeholder:text-slate-400 transition-colors focus:border-brand-cyan focus:outline-none"
            autoComplete="username"
          />
        </div>

        <label htmlFor="admin-password" className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-500">
          Password
        </label>
        <div className="relative mb-5">
          <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            id="admin-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••"
            className="w-full rounded-xl border border-slate-300 bg-slate-100 py-3 pl-11 pr-4 text-slate-900 placeholder:text-slate-400 transition-colors focus:border-brand-cyan focus:outline-none"
            required
            autoFocus
            autoComplete="current-password"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-cyan py-3 font-bold text-brand-dark transition-colors hover:bg-brand-cyan/90 disabled:opacity-50"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "Signing in…" : "Sign in"}
        </button>

        <Link href="/" className="mt-6 inline-flex items-center gap-1.5 text-xs text-slate-500 transition-colors hover:text-cyan-700">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to bitsolmarketing.com
        </Link>
      </form>
    </div>
  );
}
