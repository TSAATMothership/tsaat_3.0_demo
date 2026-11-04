import { redirect } from "next/navigation";
import { legacyLoginDestination } from "@/lib/auth-redirect";

export const dynamic = "force-dynamic";

export default function LoginPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  redirect(legacyLoginDestination(searchParams.next));
}
