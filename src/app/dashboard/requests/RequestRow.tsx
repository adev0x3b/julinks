"use client";

import { useState, useTransition } from "react";
import { reviewSignup } from "@/actions/requests";
import type { AccountRequest } from "@/lib/data/requests";
import { canManage, ROLE_LABELS, type Role } from "@/lib/roles";

const STATUS = {
  pending: { label: "Pending", className: "bg-amber-100 text-amber-800" },
  approved: { label: "Approved", className: "bg-emerald-100 text-emerald-800" },
  denied: { label: "Denied", className: "bg-rose-100 text-rose-800" },
} as const;

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

export function RequestRow({
  request,
  reviewerId,
  reviewerRole,
  roles,
}: {
  request: AccountRequest;
  reviewerId: string;
  reviewerRole: Role;
  /** The roles this reviewer may give. */
  roles: readonly Role[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<Role>(roles.includes(request.role) ? request.role : roles[0]);
  const status = STATUS[request.status];
  const editable = request.id !== reviewerId && canManage(reviewerRole, request.role);

  function decide(decision: { status: "approved"; role: Role } | { status: "denied" }) {
    setError(null);
    startTransition(async () => {
      const result = await reviewSignup(request.id, decision);
      if (result.error) setError(result.error);
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-3 py-3" data-testid="request-row" data-status={request.status} data-role={request.role}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium">/{request.username}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}>{status.label}</span>
          {request.status === "approved" && (
            <span className="rounded-full bg-stone-200 px-2 py-0.5 text-xs font-medium text-stone-700">{ROLE_LABELS[request.role]}</span>
          )}
          {request.id === reviewerId && <span className="text-xs text-stone-400">(you)</span>}
        </div>
        <div className="truncate text-sm text-stone-500">{request.email}</div>
        <div className="text-xs text-stone-400">
          Asked {dateFormat.format(request.createdAt)}
          {request.reviewedAt && ` · decided ${dateFormat.format(request.reviewedAt)}`}
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </div>
      {editable && (
        <div className="flex items-center gap-2">
          <select
            className="shrink-0 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-xs focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            value={role}
            onChange={(event) => setRole(event.target.value as Role)}
            disabled={pending}
            aria-label={`Role for ${request.username}`}
          >
            {roles.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-primary whitespace-nowrap"
            disabled={pending || (request.status === "approved" && role === request.role)}
            onClick={() => decide({ status: "approved", role })}
            aria-label={`${request.status === "approved" ? "Change role of" : "Approve"} ${request.username}`}
          >
            {request.status === "approved" ? "Change role" : "Approve"}
          </button>
          {request.status !== "denied" && (
            <button type="button" className="btn-secondary" disabled={pending} onClick={() => decide({ status: "denied" })} aria-label={`Deny ${request.username}`}>
              Deny
            </button>
          )}
        </div>
      )}
    </li>
  );
}
