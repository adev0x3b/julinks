import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { DemoAccount, deleteAccount, exportAccount, LastAdmin, pruneClosedAccounts } from "@/lib/data/accounts";
import {
  countContactMessages,
  deleteContactMessage,
  InboxFull,
  listContactMessages,
  MAX_MESSAGES_PER_DAY,
  MESSAGE_RETENTION_DAYS,
  pruneContactMessages,
  storeContactMessage,
} from "@/lib/data/contact";
import { createLink, setLinkThumbnail } from "@/lib/data/links";
import { reviewRequest } from "@/lib/data/requests";
import { getCopyableTheme, listGallery, ThemeNotFound } from "@/lib/data/themes";
import { setAvatar } from "@/lib/data/users";
import { imageKey, processImage } from "@/lib/images";
import { getObject, putObject } from "@/lib/storage";
import { DEFAULT_PRESET } from "@/lib/themes";
import { makeUser } from "./helpers";

const DAY = 24 * 60 * 60 * 1000;

async function storedImage(kind: "avatar" | "thumbnail", ownerId: string, colour: string) {
  const png = await sharp({ create: { width: 32, height: 32, channels: 3, background: colour } }).png().toBuffer();
  const image = await processImage(png, kind);
  const key = imageKey(kind, ownerId, image.data);
  await putObject(key, image.data, image.contentType);
  return key;
}

const message = { kind: "report" as const, page: "ada", message: "This page links to a scam.", email: null };

describe("contact messages", () => {
  it("stores, lists newest first, counts and deletes", async () => {
    await storeContactMessage(message);
    await storeContactMessage({ ...message, kind: "privacy", page: null, email: "me@example.com" });
    const listed = await listContactMessages();
    expect(listed.map((m) => m.kind)).toEqual(["privacy", "report"]);
    expect(await countContactMessages()).toBe(2);
    expect(await deleteContactMessage(listed[0].id)).toBe(true);
    expect(await deleteContactMessage(listed[0].id)).toBe(false);
    expect(await countContactMessages()).toBe(1);
  });

  it("refuses new messages once the day's limit is reached", async () => {
    await prisma.contactMessage.createMany({ data: Array.from({ length: MAX_MESSAGES_PER_DAY }, () => message) });
    await expect(storeContactMessage(message)).rejects.toBeInstanceOf(InboxFull);
    // A day later the window has moved on.
    await expect(storeContactMessage(message, new Date(Date.now() + DAY + 1000))).resolves.toBeUndefined();
  });

  it("prunes messages past the retention period only", async () => {
    await prisma.contactMessage.create({ data: { ...message, createdAt: new Date(Date.now() - (MESSAGE_RETENTION_DAYS + 1) * DAY) } });
    await storeContactMessage(message);
    expect(await pruneContactMessages()).toBe(1);
    expect(await countContactMessages()).toBe(1);
  });
});

describe("deleteAccount", () => {
  it("removes the account, everything it owns and its pictures, and leaves other accounts alone", async () => {
    const user = await makeUser({ username: "june" });
    const other = await makeUser();
    const avatar = await storedImage("avatar", user.id, "#ff0000");
    const thumb = await storedImage("thumbnail", user.id, "#00ff00");
    const otherAvatar = await storedImage("avatar", other.id, "#0000ff");
    await setAvatar(user.id, avatar);
    await setAvatar(other.id, otherAvatar);
    const link = await createLink(user.id, { title: "Blog", url: "https://blog.example" });
    await setLinkThumbnail(user.id, link.id, thumb);
    await prisma.click.create({ data: { linkId: link.id } });
    await prisma.theme.create({ data: { ownerId: user.id, name: "Mine", tokens: DEFAULT_PRESET.tokens, isPublic: true, publishedAt: new Date() } });

    expect(await deleteAccount(user.id)).toEqual({ username: "june", hadPublicTheme: true });

    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
    expect(await prisma.link.count({ where: { userId: user.id } })).toBe(0);
    expect(await prisma.click.count()).toBe(0);
    expect(await prisma.theme.count({ where: { ownerId: user.id } })).toBe(0);
    expect(await getObject(avatar)).toBeNull();
    expect(await getObject(thumb)).toBeNull();
    expect(await getObject(otherAvatar)).not.toBeNull();
    expect(await prisma.user.count({ where: { id: other.id } })).toBe(1);
  });

  it("refuses the only admin and demo profiles, but lets an admin go when another one exists", async () => {
    const admin = await makeUser({ username: "boss" }, { role: "admin" });
    const demo = await makeUser({ username: "ada" }, { isDemo: true });
    await expect(deleteAccount(admin.id)).rejects.toBeInstanceOf(LastAdmin);
    await expect(deleteAccount(demo.id)).rejects.toBeInstanceOf(DemoAccount);
    await makeUser({ username: "boss2" }, { role: "admin" });
    await expect(deleteAccount(admin.id)).resolves.toMatchObject({ username: "boss" });
  });
});

describe("pruneClosedAccounts", () => {
  it("deletes denied and closed accounts once their decision is older than the retention period", async () => {
    const admin = await makeUser({ username: "boss" }, { role: "admin" });
    const old = await makeUser({ username: "old" }, { status: "pending" });
    const recent = await makeUser({ username: "recent" }, { status: "pending" });
    await makeUser({ username: "kept" });
    await reviewRequest({ id: admin.id, role: "admin" }, old.id, { status: "denied" });
    await reviewRequest({ id: admin.id, role: "admin" }, recent.id, { status: "denied" });
    await prisma.user.update({ where: { id: old.id }, data: { reviewedAt: new Date(Date.now() - 31 * DAY) } });

    expect((await pruneClosedAccounts()).map((a) => a.username)).toEqual(["old"]);
    const left = await prisma.user.findMany({ orderBy: { username: "asc" }, select: { username: true } });
    expect(left.map((u) => u.username)).toEqual(["boss", "kept", "recent"]);
  });
});

describe("gallery", () => {
  it("leaves out the public themes of accounts that are no longer approved", async () => {
    const admin = await makeUser({ username: "boss" }, { role: "admin" });
    const owner = await makeUser({ username: "maker" });
    await prisma.theme.create({ data: { ownerId: owner.id, name: "Shared", tokens: DEFAULT_PRESET.tokens, isPublic: true, publishedAt: new Date() } });
    expect((await listGallery()).map((t) => t.name)).toEqual(["Shared"]);
    await reviewRequest({ id: admin.id, role: "admin" }, owner.id, { status: "denied" });
    expect(await listGallery()).toEqual([]);
  });

  it("does not let anyone copy those themes by id either", async () => {
    const admin = await makeUser({ username: "chief" }, { role: "admin" });
    const owner = await makeUser({ username: "crafter" });
    const theme = await prisma.theme.create({ data: { ownerId: owner.id, name: "Gone", tokens: DEFAULT_PRESET.tokens, isPublic: true, publishedAt: new Date() } });
    expect((await getCopyableTheme(admin.id, theme.id)).name).toBe("Gone");
    await reviewRequest({ id: admin.id, role: "admin" }, owner.id, { status: "denied" });
    await expect(getCopyableTheme(admin.id, theme.id)).rejects.toBeInstanceOf(ThemeNotFound);
  });
});

describe("exportAccount", () => {
  it("returns what the owner put in, with absolute picture links and click totals, and no password hash", async () => {
    const user = await makeUser({ username: "june", email: "june@example.com" });
    const folder = await prisma.folder.create({ data: { userId: user.id, title: "Writing", position: 0 } });
    const link = await createLink(user.id, { title: "Blog", url: "https://blog.example" });
    await prisma.link.update({ where: { id: link.id }, data: { folderId: folder.id, thumbnailKey: "thumbnails/x/abc.webp" } });
    await prisma.click.createMany({ data: [{ linkId: link.id }, { linkId: link.id, referrer: "instagram.com" }] });

    const data = await exportAccount(user.id, (key) => `https://links.example.com/img/${key}`);
    expect(data.account).toMatchObject({ username: "june", email: "june@example.com", avatar: null });
    expect(data.folders).toEqual([{ title: "Writing", collapsed: false }]);
    expect(data.links).toEqual([
      expect.objectContaining({ title: "Blog", folder: "Writing", picture: "https://links.example.com/img/thumbnails/x/abc.webp", clicks: 2 }),
    ]);
    expect(JSON.stringify(data)).not.toContain("passwordHash");
    expect(JSON.stringify(data)).not.toContain("$2b$");
  });
});
