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

  const input =
    "w-full rounded-md border border-slate-300 bg-transparent py-2 pl-10 pr-3.5 text-[0.9375rem] text-slate-900 placeholder:text-slate-400 outline-none transition-[border-color,box-shadow] focus:border-cyan-600 focus:shadow-[0_0.125rem_0.375rem_0_rgb(47_43_61/0.14)]";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      {/* Soft shapes behind the card, in the primary colour. */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[30rem] w-[30rem] -translate-x-1/2 -translate-y-1/2" aria-hidden>
        <div className="absolute -left-10 -top-10 h-36 w-36 rounded-3xl border-2 border-cyan-200" />
        <div className="absolute -bottom-8 -right-8 h-44 w-44 rounded-full bg-cyan-100" />
      </div>

      <form onSubmit={handleSubmit} className="adm-card relative w-full max-w-[28rem] p-8 sm:p-10">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <span className="adm-shadow-primary grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-brand-cyan to-brand-purple text-lg font-extrabold text-white">
            B
          </span>
          <span className="text-[1.625rem] font-semibold tracking-tight text-slate-900">bitsol</span>
        </div>

        <h1 className="mb-1.5 text-[1.375rem] text-slate-900">Welcome to BITSOL Admin 👋</h1>
        <p className="mb-6 text-[0.9375rem] text-slate-500">
          Sign in with your team account, or leave the email empty to use the owner password.
        </p>

        {error && (
          <p className="mb-4 rounded-md bg-red-100 px-3.5 py-2.5 text-[0.9375rem] text-red-700" role="alert">
            {error}
          </p>
        )}

        <label htmlFor="admin-email" className="mb-1.5 block text-[0.8125rem] font-medium text-slate-900">
          Email <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <div className="relative mb-5">
          <AtSign className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            id="admin-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@bitsolmarketing.com"
            className={input}
            autoComplete="username"
          />
        </div>

        <label htmlFor="admin-password" className="mb-1.5 block text-[0.8125rem] font-medium text-slate-900">
          Password
        </label>
        <div className="relative mb-6">
          <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            id="admin-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••"
            className={input}
            required
            autoFocus
            autoComplete="current-password"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="adm-shadow-primary flex w-full items-center justify-center gap-2 rounded-md bg-adm-primary py-2.5 text-[0.9375rem] font-medium text-white transition hover:brightness-95 disabled:opacity-60"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "Signing in…" : "Sign in"}
        </button>

        <p className="mt-6 text-center">
          <Link href="/" className="inline-flex items-center gap-1.5 text-[0.9375rem] text-cyan-700 transition-colors hover:text-cyan-800">
            <ArrowLeft className="h-4 w-4" /> Back to bitsolmarketing.com
          </Link>
        </p>
      </form>
    </div>
  );
}
