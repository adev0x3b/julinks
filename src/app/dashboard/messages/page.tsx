import Link from "next/link";
import { notFound } from "next/navigation";
import { CONTACT_KIND_LABELS } from "@/lib/contact-kinds";
import { listContactMessages, MESSAGE_RETENTION_DAYS } from "@/lib/data/contact";
import { requireUser } from "@/lib/session";
import { usernameSchema } from "@/lib/validation";
import { DeleteMessageButton } from "./DeleteMessageButton";

export const metadata = { title: "Messages" };

const timeFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

/** Admins only: what arrived through the contact form. Anyone else gets a 404, like the Requests page. */
export default async function MessagesPage() {
  const user = await requireUser();
  if (user.role !== "admin") notFound();
  const messages = await listContactMessages();
  return (
    <section className="card max-w-3xl">
      <h2 className="text-base font-semibold">Messages</h2>
      <p className="mb-4 text-sm text-stone-500">
        Reports and privacy requests from the contact form. Delete each one once it is dealt with; anything left is deleted after{" "}
        {MESSAGE_RETENTION_DAYS} days.
      </p>
      {messages.length === 0 ? (
        <p className="text-sm text-stone-500" data-testid="no-messages">
          No messages.
        </p>
      ) : (
        <ul className="divide-y divide-stone-100" data-testid="messages">
          {messages.map((m) => {
            // Only a valid username becomes a link, and only to a page on this site: the field is free text from anyone.
            const username = m.page ? usernameSchema.safeParse(m.page.replace(/^\//, "")) : null;
            return (
              <li key={m.id} className="flex items-start justify-between gap-4 py-4">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-700">{CONTACT_KIND_LABELS[m.kind]}</span>
                    <span className="text-stone-500">{timeFormat.format(m.createdAt)} UTC</span>
                  </p>
                  {m.page && (
                    <p className="mt-2 break-all text-sm">
                      <span className="text-stone-500">Page: </span>
                      {username?.success ? (
                        <Link href={`/${username.data}`} target="_blank" className="font-medium text-brand-600 hover:underline">
                          /{username.data}
                        </Link>
                      ) : (
                        <span className="font-medium">{m.page}</span>
                      )}
                    </p>
                  )}
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm">{m.message}</p>
                  <p className="mt-2 break-all text-sm text-stone-500">{m.email ? `Reply to: ${m.email}` : "No reply address"}</p>
                </div>
                <DeleteMessageButton id={m.id} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
