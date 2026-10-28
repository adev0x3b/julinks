import type { Mail } from "@/lib/mail/send";

/**
 * The messages JuLinks sends: plain text first, a simple HTML twin with the same words.
 * Links are absolute, built from APP_URL. Usernames and addresses are validated on the way
 * in, and are escaped here anyway.
 */
type Content = Omit<Mail, "to">;

export type RequestSummary = { username: string; email: string };

export function signupRequestsMail(appUrl: URL, pending: number, latest: RequestSummary[]): Content {
  const reviewUrl = new URL("/dashboard/requests", appUrl).toString();
  const subject = pending === 1 ? "JuLinks: a new sign-up request" : `JuLinks: ${pending} sign-up requests waiting`;
  const intro = pending === 1 ? "Someone asked for a JuLinks page:" : `${pending} sign-up requests are waiting for a decision. The latest:`;
  const lines = latest.map((r) => `${r.username} <${r.email}>`);
  const more = pending > latest.length ? `and ${pending - latest.length} more` : null;
  const text = [intro, "", ...lines.map((l) => `- ${l}`), ...(more ? [`- ${more}`] : []), "", `Approve or deny them at ${reviewUrl}`].join("\n");
  const html = page(
    `<p>${escape(intro)}</p><ul>${lines.map((l) => `<li>${escape(l)}</li>`).join("")}${more ? `<li>${escape(more)}</li>` : ""}</ul>` +
      `<p><a href="${escape(reviewUrl)}">Approve or deny them</a></p>`,
  );
  return { subject, text, html };
}

export type DecisionKind = "approved" | "denied" | "revoked";

export function decisionMail(appUrl: URL, username: string, kind: DecisionKind): Content {
  const pageUrl = new URL(`/${username}`, appUrl).toString();
  const loginUrl = new URL("/login", appUrl).toString();
  if (kind === "approved") {
    const text = [
      `Hi ${username},`,
      "",
      "your JuLinks sign-up request has been approved. Log in to build your page:",
      loginUrl,
      "",
      `Once it has links, it lives at ${pageUrl}`,
    ].join("\n");
    const html = page(
      `<p>Hi ${escape(username)},</p><p>your JuLinks sign-up request has been approved. <a href="${escape(loginUrl)}">Log in</a> to build your page.</p>` +
        `<p>Once it has links, it lives at <a href="${escape(pageUrl)}">${escape(pageUrl)}</a></p>`,
    );
    return { subject: "Your JuLinks page is ready", text, html };
  }
  const body =
    kind === "denied" ? "your JuLinks sign-up request has been declined." : "your JuLinks account has been closed and your page is no longer public.";
  const text = [`Hi ${username},`, "", body, "", "No need to reply to this message."].join("\n");
  const html = page(`<p>Hi ${escape(username)},</p><p>${escape(body)}</p>`);
  return { subject: kind === "denied" ? "Your JuLinks sign-up request" : "Your JuLinks account", text, html };
}

function page(body: string): string {
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#1c1917">${body}</body></html>`;
}

function escape(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
