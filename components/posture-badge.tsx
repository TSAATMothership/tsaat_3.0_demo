import clsx from "clsx";
import { ComplianceStatus } from "@/lib/types";

const classes: Record<ComplianceStatus, string> = {
  Compliant: "bg-emerald-500/15 text-emerald-200 border-emerald-400/40",
  "Non-compliant": "bg-red-500/15 text-red-200 border-red-400/40",
  Unknown: "bg-amber-500/15 text-amber-100 border-amber-300/40"
};

export function PostureBadge({ status }: { status: ComplianceStatus }) {
  return (
    <span className={clsx("whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold", classes[status])}>
      {status}
    </span>
  );
}
