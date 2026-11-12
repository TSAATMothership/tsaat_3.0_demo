import { retiredFeatureResponse } from "@/lib/retired-feature";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET() { return retiredFeatureResponse(); }
export async function PUT() { return retiredFeatureResponse(); }
