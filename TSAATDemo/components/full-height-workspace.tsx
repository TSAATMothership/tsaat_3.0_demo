import type { ComponentPropsWithoutRef } from "react";

type FullHeightWorkspaceProps = Omit<ComponentPropsWithoutRef<"div">, "className">;

export function FullHeightWorkspace({ children, ...props }: FullHeightWorkspaceProps) {
  return (
    <div
      {...props}
      data-full-height-workspace="true"
      className="relative left-1/2 -my-5 flex h-[calc(100vh-11rem+100px)] w-[min(2100px,calc(100vw-2rem))] -translate-x-1/2 flex-col overflow-hidden md:-my-8 md:h-[calc(100vh-12rem+100px)] md:w-[min(2100px,calc(100vw-3rem))]"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">{children}</div>
      <footer
        data-workspace-footer="true"
        className="shrink-0 border-t border-sky-300/15 bg-slate-950/30"
      >
        <div className="px-4 py-3 text-center text-xs text-slate-300/70">
          TSAAT | Cyber Operations Compliance Reporting.
        </div>
      </footer>
      <div aria-hidden="true" className="h-12 shrink-0" />
    </div>
  );
}
