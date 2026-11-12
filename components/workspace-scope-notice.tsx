"use client";

import { useEffect, useRef } from "react";

function ScopeIllustration() {
  return <svg viewBox="0 0 320 240" fill="none" aria-hidden="true" focusable="false">
    <circle cx="160" cy="120" r="106" stroke="#30546a" strokeDasharray="3 9" />
    <circle cx="160" cy="120" r="76" fill="#102c3f" fillOpacity=".6" stroke="#284b61" />
    <path d="M74 68h38l48 52 48-52h38M74 174h38l48-54 48 54h38" stroke="#53859a" strokeWidth="2" strokeDasharray="5 5" />
    <rect x="18" y="40" width="80" height="56" rx="12" fill="#122d40" stroke="#4e94aa" />
    <path d="M43 67h30M58 58v9M43 67v10m15-10v10m15-10v10" stroke="#8ad9e9" strokeWidth="2" strokeLinecap="round" />
    <rect x="50" y="51" width="16" height="10" rx="3" fill="#8ad9e9" />
    <rect x="36" y="76" width="14" height="7" rx="2" fill="#62abbf" /><rect x="51" y="76" width="14" height="7" rx="2" fill="#62abbf" /><rect x="66" y="76" width="14" height="7" rx="2" fill="#62abbf" />
    <rect x="222" y="146" width="80" height="56" rx="12" fill="#122d40" stroke="#4e94aa" />
    <rect x="240" y="158" width="44" height="13" rx="3" stroke="#8ad9e9" strokeWidth="2" /><rect x="240" y="177" width="44" height="13" rx="3" stroke="#8ad9e9" strokeWidth="2" />
    <path d="M248 164h2m5 0h2m-9 20h2m5 0h2" stroke="#8ad9e9" strokeWidth="2" strokeLinecap="round" />
    <circle cx="58" cy="174" r="19" fill="#10283b" stroke="#426e84" /><circle cx="58" cy="174" r="5" fill="#75aabe" />
    <circle cx="262" cy="68" r="19" fill="#10283b" stroke="#426e84" /><circle cx="262" cy="68" r="5" fill="#75aabe" />
    <circle cx="160" cy="120" r="34" fill="#152b37" stroke="#ddbd78" strokeWidth="1.5" />
    <path d="M160 104v19" stroke="#f2d294" strokeWidth="3" strokeLinecap="round" /><circle cx="160" cy="133" r="2" fill="#f2d294" />
  </svg>;
}

export function WorkspaceScopeNotice({ viewLabel }: { viewLabel: string }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [viewLabel]);
  const openScope = (id: "managed-network-options" | "ict-system-options") => {
    const trigger = document.querySelector<HTMLButtonElement>(`.workspace-header button[aria-controls="${id}"]`);
    if (!trigger) return;
    trigger.focus();
    if (trigger.getAttribute("aria-expanded") !== "true") trigger.click();
  };

  return <section className="workspace-scope-notice" aria-labelledby="workspace-scope-title">
    <div className="workspace-scope-art"><ScopeIllustration /><span>Connect your view to a scope</span></div>
    <div className="workspace-scope-copy">
      <p className="workspace-scope-context">{viewLabel}</p>
      <div role="status" aria-live="polite">
        <span className="workspace-scope-required"><span aria-hidden="true" /> Selection required</span>
        <h1 id="workspace-scope-title" ref={heading} tabIndex={-1}>Select a network or ICT system</h1>
        <p>Choose at least one <strong>Managed Network</strong> or <strong>ICT System</strong> in the header, then select <strong>Update</strong> to load this view.</p>
      </div>
      <div className="workspace-scope-actions">
        <button type="button" onClick={() => openScope("managed-network-options")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="8" y="2" width="8" height="6" rx="1.5" /><path d="M12 8v5M5 17v-4h14v4" /><rect x="2" y="17" width="6" height="5" rx="1" /><rect x="16" y="17" width="6" height="5" rx="1" /></svg>
          Select managed networks
        </button>
        <button type="button" onClick={() => openScope("ict-system-options")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="3" y="3" width="18" height="7" rx="2" /><rect x="3" y="14" width="18" height="7" rx="2" /><path d="M7 6.5h2m-2 11h2" /></svg>
          Select ICT systems
        </button>
      </div>
      <p className="workspace-scope-note">Your selected date and security domains will be kept.</p>
    </div>
  </section>;
}
