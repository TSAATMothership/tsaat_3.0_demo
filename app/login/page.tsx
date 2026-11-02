import { LoginPanel } from "@/components/login-panel";

export const dynamic = "force-dynamic";

export default function LoginPage({
  searchParams
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const noticeValue = Array.isArray(searchParams.notice) ? searchParams.notice[0] : searchParams.notice;
  const showPasswordChangedNotice = noticeValue === "password-changed";

  return (
    <div className="relative left-1/2 w-[min(2100px,calc(100vw-2rem))] -translate-x-1/2 space-y-3 md:w-[min(2100px,calc(100vw-3rem))]">
      {showPasswordChangedNotice ? (
        <section className="mx-auto mt-8 w-full max-w-md rounded-xl border border-emerald-300/35 bg-emerald-950/35 px-4 py-3 text-sm text-emerald-100">
          Password changed successfully. Sign in with your new password.
        </section>
      ) : null}
      <LoginPanel />
    </div>
  );
}
