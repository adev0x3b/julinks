import type { ContactKind } from "@/lib/contact-kinds";
import { prisma } from "@/lib/db";

/** Messages nobody deleted are gone after this many days; the privacy page says so. */
export const MESSAGE_RETENTION_DAYS = 180;
/** New messages a day, from every address together: a botnet cannot flood the admins' inbox. */
export const MAX_MESSAGES_PER_DAY = 50;
/** The inbox stops taking messages at this size until admins work through it. */
export const MAX_STORED_MESSAGES = 500;

const DAY = 24 * 60 * 60 * 1000;

export class InboxFull extends Error {
  constructor() {
    super("The inbox is full right now, try again tomorrow");
  }
}

export type NewContactMessage = { kind: ContactKind; page: string | null; message: string; email: string | null };

export type ContactMessage = NewContactMessage & { id: string; createdAt: Date };

/** Stores a message from the contact form, unless today's or the inbox's limit is reached. */
export async function storeContactMessage(input: NewContactMessage, now = new Date()): Promise<void> {
  const [today, stored] = await Promise.all([
    prisma.contactMessage.count({ where: { createdAt: { gte: new Date(now.getTime() - DAY) } } }),
    prisma.contactMessage.count(),
  ]);
  // Two messages racing past the check go over by one: harmless, the limits only cap a flood.
  if (today >= MAX_MESSAGES_PER_DAY || stored >= MAX_STORED_MESSAGES) throw new InboxFull();
  await prisma.contactMessage.create({ data: input });
}

/** The admins' inbox, newest first. */
export async function listContactMessages(): Promise<ContactMessage[]> {
  return prisma.contactMessage.findMany({ orderBy: { createdAt: "desc" } });
}

export async function countContactMessages(): Promise<number> {
  return prisma.contactMessage.count();
}

/** True when the message existed. */
export async function deleteContactMessage(id: string): Promise<boolean> {
  return (await prisma.contactMessage.deleteMany({ where: { id } })).count > 0;
}

/** Drops messages older than MESSAGE_RETENTION_DAYS. */
export async function pruneContactMessages(now = new Date()): Promise<number> {
  return (await prisma.contactMessage.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - MESSAGE_RETENTION_DAYS * DAY) } } })).count;
}
