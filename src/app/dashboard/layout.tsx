import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { logout } from "@/actions/auth";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { countPendingRequests } from "@/lib/data/requests";
import { isSetupPending } from "@/lib/data/setup";
import { canReview } from "@/lib/roles";
import { getCurrentUser, requireUser } from "@/lib/session";

// The layout itself stays static; only the header's user-specific part reads the session.
export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
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
              <Link href="/dashboard/account" className="btn-ghost">
                Account
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
  // A session from before the database was reset, or a demo login, must not open a site that has no admin yet.
  if (await isSetupPending()) redirect("/setup");
  return (
    <div className="flex items-center gap-2 text-sm">
      <a href={`/${user.username}`} target="_blank" rel="noreferrer" className="btn-secondary" data-testid="view-page">
        <span>
          <span className="hidden sm:inline">julinks/</span>
          {user.username}
        </span>
        ↗
      </a>
      <form action={logout}>
        <button type="submit" className="btn-ghost">
          Log out
        </button>
      </form>
    </div>
  );
}
