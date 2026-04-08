import Link from "next/link";
import { Finding } from "@/lib/types";

const severityClass: Record<Finding["severity"], string> = {
  "High Risk": "text-red-300",
  "Critical Exposure": "text-amber-200",
  Major: "text-orange-200",
  Moderate: "text-sky-200",
  "Data Gap": "text-slate-200"
};

export function TopRisks({ findings }: { findings: Finding[] }) {
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">Top Risks</h3>
        <Link href="/findings" className="text-xs text-sky-200 underline">
          Open Register
        </Link>
      </div>
      <ul className="mt-3 space-y-2 text-sm">
        {findings.slice(0, 10).map((finding) => (
          <li key={finding.id} className="panel-alt rounded-lg p-3">
            <p className={`text-xs uppercase tracking-[0.14em] ${severityClass[finding.severity]}`}>
              {finding.severity} | SPI {finding.spiId}
            </p>
            <p className="mt-1 text-slate-100">{finding.title}</p>
            <p className="mt-1 text-xs text-slate-300/70">Asset: {finding.scope.assetId}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
