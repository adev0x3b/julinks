"use client";

import Link from "next/link";
import { useActionState } from "react";
import { sendContactMessage, type ContactFormState } from "@/actions/contact";
import { Field } from "@/components/Field";
import { CONTACT_KINDS, CONTACT_KIND_LABELS, HONEYPOT_FIELD, type ContactKind } from "@/lib/contact-kinds";

const initial: ContactFormState = {};

/** Reports and privacy requests reach the admins here instead of through anyone's mailbox. */
export function ContactForm({ kind, page }: { kind?: ContactKind; page?: string }) {
  const [state, action, pending] = useActionState(sendContactMessage, initial);
  const v = state.values ?? { kind, page };
  const e = state.errors ?? {};
  if (state.sent) {
    return (
      <div className="flex flex-col gap-4" data-testid="contact-sent">
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900" role="status">
          Thanks, the admins have your message.
        </p>
        <Link href="/" className="btn-secondary text-center">
          Back to JuLinks
        </Link>
      </div>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Field label="What is it about?" name="kind" error={e.kind}>
        <select id="kind" name="kind" className="input" defaultValue={v.kind ?? "report"}>
          {CONTACT_KINDS.map((k) => (
            <option key={k} value={k}>
              {CONTACT_KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Page (optional)" name="page" error={e.page} hint="The username or link of the page, if it is about one">
        <input id="page" name="page" className="input" defaultValue={v.page} maxLength={200} />
      </Field>
      <Field label="Message" name="message" error={e.message}>
        <textarea id="message" name="message" className="input min-h-32" defaultValue={v.message} required minLength={10} maxLength={2000} />
      </Field>
      <Field label="Your email (optional)" name="email" error={e.email} hint="Only if you want an answer">
        <input id="email" name="email" type="email" className="input" defaultValue={v.email} autoComplete="email" maxLength={254} />
      </Field>
      {/* Off screen and out of the tab order: people never fill it, form-filling bots do. */}
      <div className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor={HONEYPOT_FIELD}>Leave this empty</label>
        <input id={HONEYPOT_FIELD} name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>
      {e.form && (
        <p className="error" role="alert">
          {e.form}
        </p>
      )}
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Sending…" : "Send"}
      </button>
      <p className="text-xs text-stone-500">
        Only the site&apos;s admins read messages. They are deleted once handled, and after 180 days at the latest. See the{" "}
        <Link href="/privacy" className="underline">
          privacy notice
        </Link>
        .
      </p>
    </form>
  );
}
