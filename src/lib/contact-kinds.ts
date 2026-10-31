/** What a contact form message is about. Shared by the form, the schema and the admins' inbox, so no server-only imports here. */
export const CONTACT_KINDS = ["report", "privacy", "other"] as const;
export type ContactKind = (typeof CONTACT_KINDS)[number];

export const CONTACT_KIND_LABELS: Record<ContactKind, string> = {
  report: "Report a page",
  privacy: "Privacy request",
  other: "Something else",
};

/** Name of the contact form field people never see; a bot that fills every input fills it too. */
export const HONEYPOT_FIELD = "website";
