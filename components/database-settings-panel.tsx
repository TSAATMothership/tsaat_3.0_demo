"use client";

import { useMemo, useState } from "react";

interface DatabaseSettingsForm {
  server: string;
  database: string;
  authMode: "trusted" | "sql";
  userId: string;
  password: string;
}

interface DatabaseValidationResult {
  success: boolean;
  summary: string;
  diagnostics: string;
}

interface ValidationResponse {
  result?: DatabaseValidationResult;
  connectionResult?: DatabaseValidationResult;
  error?: string;
}

interface SaveResponse {
  settings: DatabaseSettingsForm;
  connectionResult: DatabaseValidationResult;
  schemaResult: DatabaseValidationResult;
  error?: string;
}

function settingsEqual(left: DatabaseSettingsForm, right: DatabaseSettingsForm): boolean {
  return (
    left.server === right.server &&
    left.database === right.database &&
    left.authMode === right.authMode &&
    left.userId === right.userId &&
    left.password === right.password
  );
}

function appendLog(existing: string, heading: string, body: string): string {
  const timestamp = new Date().toLocaleString();
  const entry = `[${timestamp}] ${heading}\n${body}`;
  return existing ? `${existing}\n\n${entry}` : entry;
}

function statusStyle(result: DatabaseValidationResult | null): string {
  if (!result) {
    return "border-slate-500/35 bg-slate-800/50 text-slate-300";
  }

  return result.success
    ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-100"
    : "border-red-400/50 bg-red-500/15 text-red-100";
}

function statusIcon(result: DatabaseValidationResult | null): string {
  if (!result) {
    return "-";
  }
  return result.success ? "\u2713" : "\u2715";
}

function statusLabel(result: DatabaseValidationResult | null, idleLabel: string): string {
  if (!result) {
    return idleLabel;
  }
  return result.summary;
}

export function DatabaseSettingsPanel({ initialSettings }: { initialSettings: DatabaseSettingsForm }) {
  const [savedSettings, setSavedSettings] = useState<DatabaseSettingsForm>(initialSettings);
  const [draftSettings, setDraftSettings] = useState<DatabaseSettingsForm>(initialSettings);
  const [connectionResult, setConnectionResult] = useState<DatabaseValidationResult | null>(null);
  const [schemaResult, setSchemaResult] = useState<DatabaseValidationResult | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isTestingSchema, setIsTestingSchema] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [logText, setLogText] = useState<string>("");
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const isDirty = useMemo(() => !settingsEqual(draftSettings, savedSettings), [draftSettings, savedSettings]);
  const hasAuthInput =
    draftSettings.authMode === "trusted" || (draftSettings.userId.trim() !== "" && draftSettings.password.trim() !== "");
  const canRunSchemaTest = Boolean(connectionResult?.success) && !isTestingSchema && !isTestingConnection;
  const canSave =
    Boolean(connectionResult?.success) &&
    Boolean(schemaResult?.success) &&
    !isSaving &&
    !isTestingConnection &&
    !isTestingSchema;

  const setField = (key: keyof DatabaseSettingsForm, value: string) => {
    setDraftSettings((current) => ({
      ...current,
      [key]: value
    }));

    setConnectionResult(null);
    setSchemaResult(null);
    setSaveError(null);
    setSaveSuccess(null);
    setCopyStatus(null);
  };

  const onAuthModeChange = (authMode: "trusted" | "sql") => {
    setDraftSettings((current) => ({
      ...current,
      authMode
    }));
    setConnectionResult(null);
    setSchemaResult(null);
    setSaveError(null);
    setSaveSuccess(null);
    setCopyStatus(null);
  };

  const onReset = () => {
    setDraftSettings(savedSettings);
    setConnectionResult(null);
    setSchemaResult(null);
    setSaveError(null);
    setSaveSuccess(null);
    setCopyStatus(null);
  };

  const onTestConnection = async () => {
    setIsTestingConnection(true);
    setSaveError(null);
    setSaveSuccess(null);
    setCopyStatus(null);

    try {
      const response = await fetch("/api/settings/database/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftSettings)
      });

      const payload = (await response.json()) as ValidationResponse;
      const result = payload.result ?? {
        success: false,
        summary: "Database connection failed.",
        diagnostics: payload.error ?? "No diagnostics were returned by the connection test endpoint."
      };

      setConnectionResult(result);
      setSchemaResult(null);
      setLogText((current) => appendLog(current, "Connection Test", result.diagnostics));

      if (!result.success) {
        setSaveError("Connection test failed. Resolve the issue before schema test and save.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Connection test failed.";
      const fallbackResult: DatabaseValidationResult = {
        success: false,
        summary: "Database connection failed.",
        diagnostics: message
      };

      setConnectionResult(fallbackResult);
      setSchemaResult(null);
      setSaveError(message);
      setLogText((current) => appendLog(current, "Connection Test", message));
    } finally {
      setIsTestingConnection(false);
    }
  };

  const onTestSchema = async () => {
    if (!connectionResult?.success) {
      setSaveError("Run a successful connection test before schema validation.");
      return;
    }

    setIsTestingSchema(true);
    setSaveError(null);
    setSaveSuccess(null);
    setCopyStatus(null);

    try {
      const response = await fetch("/api/settings/database/test-schema", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftSettings)
      });

      const payload = (await response.json()) as ValidationResponse;
      const result = payload.result ?? {
        success: false,
        summary: "Schema validation failed.",
        diagnostics: payload.error ?? "No diagnostics were returned by the schema test endpoint."
      };

      setSchemaResult(result);
      setLogText((current) => appendLog(current, "Schema Test", result.diagnostics));

      if (!result.success) {
        setSaveError("Schema validation failed. Resolve the schema issues before saving.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Schema validation failed.";
      const fallbackResult: DatabaseValidationResult = {
        success: false,
        summary: "Schema validation failed.",
        diagnostics: message
      };

      setSchemaResult(fallbackResult);
      setSaveError(message);
      setLogText((current) => appendLog(current, "Schema Test", message));
    } finally {
      setIsTestingSchema(false);
    }
  };

  const onSave = async () => {
    if (!canSave) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(null);
    setCopyStatus(null);

    try {
      const response = await fetch("/api/settings/database", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftSettings)
      });

      const payload = (await response.json()) as SaveResponse;
      if (!response.ok) {
        const message = payload.error || "Failed to save database settings.";
        setSaveError(message);

        if (payload.connectionResult) {
          setConnectionResult(payload.connectionResult);
          setLogText((current) => appendLog(current, "Save Validation - Connection", payload.connectionResult.diagnostics));
        }
        if (payload.schemaResult) {
          setSchemaResult(payload.schemaResult);
          setLogText((current) => appendLog(current, "Save Validation - Schema", payload.schemaResult.diagnostics));
        }

        return;
      }

      setSavedSettings(payload.settings);
      setDraftSettings(payload.settings);
      setConnectionResult(payload.connectionResult);
      setSchemaResult(payload.schemaResult);
      setSaveSuccess("Database settings saved to DB_config.");
      setLogText((current) => appendLog(current, "Save", "Database settings were validated and written to DB_config."));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save database settings.";
      setSaveError(message);
      setLogText((current) => appendLog(current, "Save", message));
    } finally {
      setIsSaving(false);
    }
  };

  const onCopyDiagnostics = async () => {
    if (!logText.trim()) {
      setCopyStatus("Nothing to copy.");
      return;
    }

    try {
      await navigator.clipboard.writeText(logText);
      setCopyStatus("Diagnostics copied to clipboard.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to copy diagnostics.";
      setCopyStatus(message);
    }
  };

  return (
    <section className="panel flex h-full min-h-0 flex-col p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">Database Settings</h2>
          <p className="mt-1 text-xs text-slate-300/80">
            Choose Trusted Authentication or SQL User/Password, then test connection and schema. Save is enabled only
            after both tests succeed.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isDirty ? (
            <button
              type="button"
              onClick={onReset}
              className="rounded-md border border-slate-500/40 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800/70"
              disabled={isSaving || isTestingConnection || isTestingSchema}
            >
              Reset
            </button>
          ) : null}
          <button
            type="button"
            onClick={onSave}
            className="rounded-md border border-sky-300/40 bg-sky-500/15 px-3 py-2 text-xs font-semibold text-sky-100 hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!canSave}
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {saveError ? (
        <p className="mt-3 rounded-md border border-red-400/35 bg-red-500/10 px-3 py-2 text-sm text-red-100">{saveError}</p>
      ) : null}
      {saveSuccess ? (
        <p className="mt-3 rounded-md border border-emerald-400/35 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
          {saveSuccess}
        </p>
      ) : null}

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <fieldset className="md:col-span-2 rounded-md border border-sky-400/20 bg-slate-950/55 px-3 py-2">
          <legend className="px-1 text-xs uppercase tracking-[0.11em] text-slate-300/85">Authentication Mode</legend>
          <div className="mt-1 flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 text-sm text-slate-100">
              <input
                type="radio"
                name="db-auth-mode"
                value="trusted"
                checked={draftSettings.authMode === "trusted"}
                onChange={() => onAuthModeChange("trusted")}
              />
              <span>Trusted Authentication</span>
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-100">
              <input
                type="radio"
                name="db-auth-mode"
                value="sql"
                checked={draftSettings.authMode === "sql"}
                onChange={() => onAuthModeChange("sql")}
              />
              <span>SQL User/Password</span>
            </label>
          </div>
        </fieldset>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.11em] text-slate-300/85">
          Server
          <input
            value={draftSettings.server}
            onChange={(event) => setField("server", event.target.value)}
            placeholder="localhost\\SQLEXPRESS"
            className="rounded-md border border-sky-400/20 bg-slate-950/70 px-2 py-2 text-sm normal-case tracking-normal text-slate-100"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.11em] text-slate-300/85">
          Database
          <input
            value={draftSettings.database}
            onChange={(event) => setField("database", event.target.value)}
            placeholder="TSAAT"
            className="rounded-md border border-sky-400/20 bg-slate-950/70 px-2 py-2 text-sm normal-case tracking-normal text-slate-100"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.11em] text-slate-300/85">
          User Id
          <input
            value={draftSettings.userId}
            onChange={(event) => setField("userId", event.target.value)}
            placeholder="shuffydog"
            className="rounded-md border border-sky-400/20 bg-slate-950/70 px-2 py-2 text-sm normal-case tracking-normal text-slate-100"
            disabled={draftSettings.authMode === "trusted"}
          />
        </label>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.11em] text-slate-300/85">
          Password
          <input
            type="password"
            value={draftSettings.password}
            onChange={(event) => setField("password", event.target.value)}
            placeholder="********"
            className="rounded-md border border-sky-400/20 bg-slate-950/70 px-2 py-2 text-sm normal-case tracking-normal text-slate-100"
            disabled={draftSettings.authMode === "trusted"}
          />
        </label>
      </div>

      {draftSettings.authMode === "sql" && !hasAuthInput ? (
        <p className="mt-2 text-xs text-amber-200/90">
          Enter both User Id and Password to run SQL authentication tests.
        </p>
      ) : null}

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <article className="rounded-lg border border-sky-400/20 bg-slate-900/55 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full border text-sm ${statusStyle(connectionResult)}`}>
                {statusIcon(connectionResult)}
              </span>
              <p className="text-xs uppercase tracking-[0.12em] text-slate-200">Connection Test</p>
            </div>
            <button
              type="button"
              onClick={onTestConnection}
              className="rounded-md border border-cyan-300/45 bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isTestingConnection || isTestingSchema || isSaving || !hasAuthInput}
            >
              {isTestingConnection ? "Testing..." : "Test Connection"}
            </button>
          </div>
          <p className="mt-2 text-sm text-slate-200/90">{statusLabel(connectionResult, "Not tested")}</p>
        </article>

        <article className="rounded-lg border border-sky-400/20 bg-slate-900/55 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full border text-sm ${statusStyle(schemaResult)}`}>
                {statusIcon(schemaResult)}
              </span>
              <p className="text-xs uppercase tracking-[0.12em] text-slate-200">Schema Test</p>
            </div>
            <button
              type="button"
              onClick={onTestSchema}
              className="rounded-md border border-cyan-300/45 bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!canRunSchemaTest || isSaving}
            >
              {isTestingSchema ? "Testing..." : "Test Schema"}
            </button>
          </div>
          <p className="mt-2 text-sm text-slate-200/90">{statusLabel(schemaResult, "Not tested")}</p>
        </article>
      </div>

      <div className="mt-3 min-h-0 flex-1 rounded-lg border border-sky-400/20 bg-slate-900/55 p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-200">Diagnostics</p>
          <button
            type="button"
            onClick={onCopyDiagnostics}
            className="rounded-md border border-slate-500/40 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800/70"
          >
            Copy Text
          </button>
        </div>

        {copyStatus ? <p className="mt-2 text-xs text-slate-300/85">{copyStatus}</p> : null}

        <pre className="mt-2 h-[260px] overflow-y-auto whitespace-pre-wrap rounded-md border border-sky-400/15 bg-slate-950/70 p-3 text-xs leading-relaxed text-slate-200/90">
          {logText || "No diagnostics yet. Run connection and schema tests to populate this log."}
        </pre>
      </div>
    </section>
  );
}
