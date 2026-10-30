"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { SettingsPopup } from "@/components/settings-popup";
import { type SettingsTabId } from "@/components/settings-tabs";
import { workspaceHref } from "@/lib/workspace-navigation";

/** Legacy /settings URLs also display a popup, never workspace content. */
export function SettingsRoutePopup({ initialTab }: { initialTab: SettingsTabId }) {
  const router = useRouter();
  const params = useSearchParams();
  return <SettingsPopup initialTab={initialTab} onClose={() => router.replace(workspaceHref("/", new URLSearchParams(params?.toString())))} />;
}
