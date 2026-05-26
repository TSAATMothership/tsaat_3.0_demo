"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MouseEvent, ReactNode } from "react";
import { startRouteLoading } from "@/lib/route-loading";

export function DrillthroughBackLink({
  href,
  children,
  className,
  loadingLabel = "Returning to previous page..."
}: {
  href: string;
  children: ReactNode;
  className?: string;
  loadingLabel?: string;
}) {
  const router = useRouter();

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented) {
      return;
    }

    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    startRouteLoading({ href, message: loadingLabel });
    router.push(href);
  };

  return (
    <Link href={href} onClick={onClick} className={className}>
      {children}
    </Link>
  );
}
