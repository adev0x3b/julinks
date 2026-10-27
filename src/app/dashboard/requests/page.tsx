import { listRequests } from "@/lib/data/requests";
import { assignableRoles } from "@/lib/roles";
import { requireReviewer } from "@/lib/session";
import { RequestRow } from "./RequestRow";

export const metadata = { title: "Requests" };

/** Admins and moderators: approve sign-up requests with a role, deny them, and revisit earlier decisions. */
export default async function RequestsPage() {
  const reviewer = await requireReviewer();
  const { pending, decided } = await listRequests();
  const rowProps = { reviewerId: reviewer.id, reviewerRole: reviewer.role, roles: assignableRoles(reviewer.role) };
  return (
    <div className="flex flex-col gap-6">
      <section className="card">
        <h2 className="text-base font-semibold">Waiting for a decision</h2>
        <p className="mb-4 text-sm text-stone-500">
          People who asked for a page. Pick a role and approve to let them log in; deny and the login page tells them so.
        </p>
        {pending.length === 0 ? (
          <p className="text-sm text-stone-500" data-testid="no-pending">
            No open requests.
          </p>
        ) : (
          <ul className="divide-y divide-stone-100" data-testid="pending-requests">
            {pending.map((request) => (
              <RequestRow key={request.id} request={request} {...rowProps} />
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2 className="text-base font-semibold">Decided</h2>
        <p className="mb-4 text-sm text-stone-500">
          Approved accounts and denied requests. A decision can be changed, and so can a role.
        </p>
        {decided.length === 0 ? (
          <p className="text-sm text-stone-500">Nothing decided yet.</p>
        ) : (
          <ul className="divide-y divide-stone-100" data-testid="decided-requests">
            {decided.map((request) => (
              <RequestRow key={request.id} request={request} {...rowProps} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
