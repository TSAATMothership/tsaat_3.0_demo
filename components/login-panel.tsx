"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import { LoadingOverlay, nextLoadingProgressValue } from "@/components/loading-overlay";

function resolveNextPath(rawValue: string | null): string {
  if (!rawValue) {
    return "/cyber-cop";
  }

  const trimmed = rawValue.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return "/cyber-cop";
  }

  if (trimmed.startsWith("/login")) {
    return "/cyber-cop";
  }

  return trimmed;
}

export function LoginPanel() {
  const searchParams = useSearchParams();
  const nextPath = useMemo(() => resolveNextPath(searchParams?.get("next") ?? null), [searchParams]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [progress, setProgress] = useState(0);

  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isTransitioning) {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      return;
    }

    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    progressIntervalRef.current = setInterval(() => {
      setProgress((current) => Math.min(96, nextLoadingProgressValue(current)));
    }, 85);

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, [isTransitioning]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    if (isSubmitting || isTransitioning) {
      return;
    }

    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          username,
          password
        })
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setErrorMessage(payload.error ?? "Login failed.");
        return;
      }

      setIsTransitioning(true);
      setProgress(12);
      redirectTimeoutRef.current = setTimeout(() => {
        setProgress(100);
        window.location.assign(nextPath);
      }, 260);
    } catch {
      setErrorMessage("Unable to reach login service.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="mx-auto mt-12 w-full max-w-md rounded-2xl border border-sky-300/30 bg-slate-950/80 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.6)]">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.16em] text-slate-300/75">Application Access</p>
        <h1 className="mt-1 text-3xl font-semibold text-slate-100">Sign In</h1>
        <p className="mt-2 text-sm text-slate-300/85">
          Enter your application credentials to access TSAAT.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="text-xs uppercase tracking-[0.12em] text-slate-300">Username</span>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            className="mt-1 w-full rounded-md border border-sky-300/35 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-200/80"
          />
        </label>

        <label className="block">
          <span className="text-xs uppercase tracking-[0.12em] text-slate-300">Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            className="mt-1 w-full rounded-md border border-sky-300/35 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-200/80"
          />
        </label>

        {errorMessage ? <p className="text-sm text-rose-300">{errorMessage}</p> : null}

        <button
          type="submit"
          disabled={isSubmitting || isTransitioning}
          className="w-full rounded-md border border-cyan-300/60 bg-cyan-500/20 px-3 py-2 text-sm font-semibold uppercase tracking-[0.12em] text-cyan-100 transition hover:border-cyan-200/85 hover:bg-cyan-500/30 disabled:cursor-wait disabled:opacity-70"
        >
          {isSubmitting ? "Signing in..." : "Sign In"}
        </button>
      </form>

      {isMounted && isTransitioning
        ? createPortal(
            <LoadingOverlay progress={progress} message="Credentials confirmed. Loading TSAAT..." />,
            document.body
          )
        : null}
    </section>
  );
}
