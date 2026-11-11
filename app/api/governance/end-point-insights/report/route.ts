import type { NextRequest } from "next/server";
import { inventoryInsightsReport } from "@/lib/inventory-insights-report";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export function GET(request: NextRequest) { return inventoryInsightsReport(request, "endpoints"); }
