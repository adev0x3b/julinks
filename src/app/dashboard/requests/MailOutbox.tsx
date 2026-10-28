import { outboxSummary } from "@/lib/mail/outbox";

const timeFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

/** Admins only: what the mail outbox holds, against the daily budget, and what could not be sent. */
export async function MailOutbox() {
  const summary = await outboxSummary();
  return (
    <section className="card" data-testid="mail-outbox">
      <h2 className="text-base font-semibold">Mail</h2>
      {!summary.enabled ? (
        <p className="text-sm text-stone-500">Mail is off: set SMTP_HOST and the other mail settings in .env to notify admins and requesters.</p>
      ) : (
        <>
          <p className="mb-3 text-sm text-stone-500">
            Notices to admins and decisions to requesters. Whatever does not fit the budget waits here and goes out when it does.
          </p>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-stone-500">Waiting</dt>
              <dd className="text-lg font-semibold" data-testid="mail-queued">
                {summary.queued}
              </dd>
            </div>
            <div>
              <dt className="text-stone-500">Sent, last 24 hours</dt>
              <dd className="text-lg font-semibold" data-testid="mail-sent">
                {summary.sentToday} / {summary.limits.daily}
              </dd>
            </div>
            <div>
              <dt className="text-stone-500">Next due</dt>
              <dd className="text-lg font-semibold">{summary.nextAt ? `${timeFormat.format(summary.nextAt)} UTC` : "Nothing"}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-stone-400">
            At most {summary.limits.daily} addresses a day and {summary.limits.hourly} an hour (MAIL_DAILY_LIMIT, MAIL_HOURLY_LIMIT).
          </p>
        </>
      )}
      {summary.failed.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold">Could not be sent</h3>
          <ul className="divide-y divide-stone-100 text-sm" data-testid="mail-failed">
            {summary.failed.map((mail) => (
              <li key={mail.id} className="py-2">
                <div className="truncate">
                  {mail.subject || "Sign-up notice"} <span className="text-stone-500">to {mail.recipients.join(", ") || "the admins"}</span>
                </div>
                <div className="truncate text-xs text-rose-600">{mail.lastError}</div>
                <div className="text-xs text-stone-400">Queued {timeFormat.format(mail.createdAt)} UTC</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
