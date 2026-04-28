"use client";

import { FormEvent, useState } from "react";

interface PasswordSaveResponse {
  success?: boolean;
  requiresReauthentication?: boolean;
  error?: string;
}

export function PasswordSettingsPanel() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusMessage("");
    setErrorMessage("");

    if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      setErrorMessage("All fields are required.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("New password and confirm password must match.");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/settings/password", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword
        })
      });

      const payload = (await response.json()) as PasswordSaveResponse;
      if (!response.ok) {
        setErrorMessage(payload.error ?? "Failed to update password.");
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      if (payload.requiresReauthentication) {
        window.location.href = "/login?notice=password-changed";
        return;
      }

      setStatusMessage("Password updated successfully.");
    } catch {
      setErrorMessage("Unable to reach the password settings endpoint.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="panel p-4">
      <h2 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">Password Settings</h2>
      <p className="mt-2 text-sm text-slate-300/85">
        Update your application login password. Saving this change invalidates existing sessions and requires sign-in
        again.
      </p>

      <form onSubmit={onSubmit} className="mt-5 max-w-xl space-y-4">
        <label className="block">
          <span className="text-xs uppercase tracking-[0.12em] text-slate-300">Current Password</span>
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
            className="mt-1 w-full rounded-md border border-sky-300/35 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-200/80"
          />
        </label>

        <label className="block">
          <span className="text-xs uppercase tracking-[0.12em] text-slate-300">New Password</span>
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="new-password"
            className="mt-1 w-full rounded-md border border-sky-300/35 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-200/80"
          />
        </label>

        <label className="block">
          <span className="text-xs uppercase tracking-[0.12em] text-slate-300">Confirm New Password</span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            className="mt-1 w-full rounded-md border border-sky-300/35 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-200/80"
          />
        </label>

        {errorMessage ? <p className="text-sm text-rose-300">{errorMessage}</p> : null}
        {statusMessage ? <p className="text-sm text-emerald-300">{statusMessage}</p> : null}

        <button
          type="submit"
          disabled={isSaving}
          className="rounded-md border border-cyan-300/60 bg-cyan-500/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-100 transition hover:border-cyan-200/85 hover:bg-cyan-500/30 disabled:cursor-wait disabled:opacity-70"
        >
          {isSaving ? "Saving..." : "Save Password"}
        </button>
      </form>
    </section>
  );
}
