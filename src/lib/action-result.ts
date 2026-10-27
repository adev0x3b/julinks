/** What a server action answers when the form only needs to know whether it worked, and why not. */
export type ActionResult = { ok: true } | { ok: false; error: string };
