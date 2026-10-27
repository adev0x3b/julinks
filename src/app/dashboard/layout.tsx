import { Suspense } from "react";
import Link from "next/link";
import { logout } from "@/actions/auth";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { countPendingRequests } from "@/lib/data/requests";
import { canReview } from "@/lib/roles";
import { getCurrentUser, requireUser } from "@/lib/session";

// The layout itself stays static; only the header's user-specific part reads the session.
export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-6">
            <Logo href="/dashboard" />
            <nav className="flex items-center gap-1 text-sm">
              <Link href="/dashboard" className="btn-ghost">
                Links
              </Link>
              <Link href="/dashboard/appearance" className="btn-ghost">
                Appearance
              </Link>
              <Link href="/dashboard/stats" className="btn-ghost">
                Stats
              </Link>
              <Suspense>
                <ReviewerNav />
              </Suspense>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Suspense fallback={<div className="h-9 w-40 animate-pulse rounded-lg bg-stone-100" />}>
              <UserMenu />
            </Suspense>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}

/** The Requests link, with the number waiting, only for admins and moderators. */
async function ReviewerNav() {
  const user = await getCurrentUser();
  if (!user || !canReview(user.role)) return null;
  const waiting = await countPendingRequests();
  return (
    <Link href="/dashboard/requests" className="btn-ghost flex items-center gap-1.5" data-testid="requests-nav">
      Requests
      {waiting > 0 && (
        <span className="rounded-full bg-amber-500 px-1.5 text-xs font-semibold text-white text-on-brand" data-testid="requests-count">
          {waiting}
        </span>
      )}
    </Link>
  );
}

async function UserMenu() {
  const user = await requireUser();
  return (
    <div className="flex items-center gap-2 text-sm">
      <a href={`/${user.username}`} target="_blank" rel="noreferrer" className="btn-secondary" data-testid="view-page">
        julinks/{user.username} ↗
      </a>
      <form action={logout}>
        <button type="submit" className="btn-ghost">
          Log out
        </button>
      </form>
    </div>
  );
}
