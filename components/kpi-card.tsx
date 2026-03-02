export function KpiCard({
  title,
  value,
  subtitle,
  tone = "default"
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  tone?: "default" | "danger" | "warning" | "success";
}) {
  const toneClass =
    tone === "danger"
      ? "text-red-200"
      : tone === "warning"
        ? "text-amber-100"
        : tone === "success"
          ? "text-emerald-200"
          : "text-slate-100";

  return (
    <div className="panel p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-slate-300/80">{title}</p>
      <p className={`mt-2 text-3xl font-bold ${toneClass}`}>{value}</p>
      {subtitle ? <p className="mt-1 text-xs text-slate-300/70">{subtitle}</p> : null}
    </div>
  );
}
