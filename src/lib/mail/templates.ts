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

/** The "forgot password" mail: a one-use link that works for `minutes`. */
export function resetMail(appUrl: URL, username: string, token: string, minutes: number): Content {
  const resetUrl = new URL(`/reset-password/${token}`, appUrl).toString();
  const intro = "someone, hopefully you, asked to reset the password of your JuLinks account.";
  const validity = `The link works once, for the next ${minutes} minutes.`;
  const ignore = "If it was not you, ignore this mail: your password stays as it is.";
  const text = [`Hi ${username},`, "", intro, "Choose a new one here:", resetUrl, "", validity, ignore].join("\n");
  const html = page(
    `<p>Hi ${escape(username)},</p><p>${escape(intro)}</p><p><a href="${escape(resetUrl)}">Choose a new password</a></p>` +
      `<p>${escape(validity)} ${escape(ignore)}</p>`,
  );
  return { subject: "Reset your JuLinks password", text, html };
}

/** The sign-up confirmation: a one-use link that turns the sign-up into a request for the admins. */
export function confirmSignupMail(appUrl: URL, username: string, token: string, hours: number): Content {
  const confirmUrl = new URL(`/signup/confirm/${token}`, appUrl).toString();
  const intro = `someone, hopefully you, asked for the JuLinks page /${username} with this address.`;
  const next = `The link works for ${hours} hours. Once you confirm, an admin reviews the request and you get a mail with the decision.`;
  const ignore = "If it was not you, ignore this mail: nothing is created.";
  const text = ["Hi,", "", intro, "Confirm your email here:", confirmUrl, "", next, ignore].join("\n");
  const html = page(
    `<p>Hi,</p><p>${escape(intro)}</p><p><a href="${escape(confirmUrl)}">Confirm your email</a></p><p>${escape(next)}</p><p>${escape(ignore)}</p>`,
  );
  return { subject: "Confirm your email for JuLinks", text, html };
}

/** Someone signed up with an address that already has an account: tell its owner, never the form. */
export function accountExistsMail(appUrl: URL, username: string, status: "pending" | "approved" | "denied"): Content {
  const loginUrl = new URL("/login", appUrl).toString();
  const forgotUrl = new URL("/forgot-password", appUrl).toString();
  const intro = `someone, hopefully you, tried to sign up to JuLinks with this address, but it already belongs to /${username}.`;
  const lines =
    status === "approved"
      ? [`Log in at ${loginUrl}`, `Forgot the password? Choose a new one at ${forgotUrl}`]
      : status === "pending"
        ? ["Your request is still waiting for an admin. You will get a mail when it is decided."]
        : ["The request made with this address was declined, so it cannot be used to sign up again."];
  const ignore = "If it was not you, ignore this mail: nothing has changed.";
  const text = ["Hi,", "", intro, "", ...lines, "", ignore].join("\n");
  const htmlLines =
    status === "approved"
      ? `<p><a href="${escape(loginUrl)}">Log in</a>. Forgot the password? <a href="${escape(forgotUrl)}">Choose a new one</a>.</p>`
      : `<p>${escape(lines[0])}</p>`;
  const html = page(`<p>Hi,</p><p>${escape(intro)}</p>${htmlLines}<p>${escape(ignore)}</p>`);
  return { subject: "Your JuLinks account", text, html };
}

function page(body: string): string {
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#1c1917">${body}</body></html>`;
}

function escape(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
