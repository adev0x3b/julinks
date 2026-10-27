import { prisma } from "@/lib/db";
import { DEFAULT_PRESET, type ThemeTokens } from "@/lib/themes";
import type { Prisma } from "@/generated/prisma/client";

export class ThemeNotFound extends Error {
  constructor() {
    super("Theme not found");
  }
}

export const MAX_THEMES_PER_USER = 50;

const themeSelect = {
  id: true,
  ownerId: true,
  name: true,
  tokens: true,
  backgroundKey: true,
  isPublic: true,
  publishedAt: true,
  forkedFromId: true,
  updatedAt: true,
} satisfies Prisma.ThemeSelect;

export type ThemeRecord = {
  id: string;
  ownerId: string;
  name: string;
  tokens: ThemeTokens;
  backgroundKey: string | null;
  isPublic: boolean;
  publishedAt: Date | null;
  forkedFromId: string | null;
  updatedAt: Date;
};

/** Rows store tokens as JSON; they were validated on the way in, so the cast is the only place that trusts them. */
function toRecord<T extends { tokens: unknown }>(row: T): Omit<T, "tokens"> & { tokens: ThemeTokens } {
  return { ...row, tokens: row.tokens as ThemeTokens };
}

export async function listOwnThemes(userId: string): Promise<ThemeRecord[]> {
  const rows = await prisma.theme.findMany({ where: { ownerId: userId }, orderBy: { updatedAt: "desc" }, select: themeSelect });
  return rows.map(toRecord);
}

export async function getOwnTheme(userId: string, themeId: string): Promise<ThemeRecord> {
  const row = await prisma.theme.findFirst({ where: { id: themeId, ownerId: userId }, select: themeSelect });
  if (!row) throw new ThemeNotFound();
  return toRecord(row);
}

/** The user's own copy of another user's theme, if they already took one. */
export async function findOwnCopy(userId: string, sourceId: string): Promise<ThemeRecord | null> {
  const row = await prisma.theme.findFirst({ where: { ownerId: userId, forkedFromId: sourceId }, orderBy: { createdAt: "asc" }, select: themeSelect });
  return row ? toRecord(row) : null;
}

/** The theme on the user's public page, or the default preset when none is set. */
export async function getActiveTheme(userId: string): Promise<{ id: string | null; name: string; tokens: ThemeTokens; backgroundKey: string | null }> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { theme: { select: themeSelect } } });
  if (!user?.theme) return { id: null, name: DEFAULT_PRESET.name, tokens: DEFAULT_PRESET.tokens, backgroundKey: null };
  const theme = toRecord(user.theme);
  return { id: theme.id, name: theme.name, tokens: theme.tokens, backgroundKey: theme.backgroundKey };
}

export type NewTheme = { name: string; tokens: ThemeTokens; backgroundKey?: string | null; forkedFromId?: string | null };

/** Creates a theme and makes it the user's active one. */
export async function createTheme(userId: string, input: NewTheme): Promise<ThemeRecord> {
  return prisma.$transaction(async (tx) => {
    const count = await tx.theme.count({ where: { ownerId: userId } });
    if (count >= MAX_THEMES_PER_USER) throw new Error(`You can have at most ${MAX_THEMES_PER_USER} themes`);
    const theme = await tx.theme.create({
      data: {
        ownerId: userId,
        name: input.name,
        tokens: input.tokens,
        backgroundKey: input.backgroundKey ?? null,
        forkedFromId: input.forkedFromId ?? null,
      },
      select: themeSelect,
    });
    await tx.user.update({ where: { id: userId }, data: { themeId: theme.id } });
    return toRecord(theme);
  });
}

export async function updateTheme(userId: string, themeId: string, input: { name: string; tokens: ThemeTokens }): Promise<ThemeRecord> {
  const result = await prisma.theme.updateMany({ where: { id: themeId, ownerId: userId }, data: { name: input.name, tokens: input.tokens } });
  if (result.count === 0) throw new ThemeNotFound();
  return getOwnTheme(userId, themeId);
}

/** Sets or clears the background image; returns the previous key so the caller can delete the old object. */
export async function setThemeBackground(userId: string, themeId: string, backgroundKey: string | null): Promise<string | null> {
  return prisma.$transaction(async (tx) => {
    const current = await tx.theme.findFirst({ where: { id: themeId, ownerId: userId }, select: { backgroundKey: true } });
    if (!current) throw new ThemeNotFound();
    await tx.theme.update({ where: { id: themeId }, data: { backgroundKey } });
    return current.backgroundKey;
  });
}

export async function activateTheme(userId: string, themeId: string): Promise<void> {
  const owned = await prisma.theme.findFirst({ where: { id: themeId, ownerId: userId }, select: { id: true } });
  if (!owned) throw new ThemeNotFound();
  await prisma.user.update({ where: { id: userId }, data: { themeId } });
}

export async function setThemePublic(userId: string, themeId: string, isPublic: boolean): Promise<ThemeRecord> {
  const result = await prisma.theme.updateMany({
    where: { id: themeId, ownerId: userId },
    data: isPublic ? { isPublic: true, publishedAt: new Date() } : { isPublic: false, publishedAt: null },
  });
  if (result.count === 0) throw new ThemeNotFound();
  return getOwnTheme(userId, themeId);
}

/** Deletes the theme; the owner's page falls back to the default preset (FK is ON DELETE SET NULL). Returns the background key. */
export async function deleteTheme(userId: string, themeId: string): Promise<{ backgroundKey: string | null; wasPublic: boolean }> {
  const theme = await prisma.theme.findFirst({ where: { id: themeId, ownerId: userId }, select: { backgroundKey: true, isPublic: true } });
  if (!theme) throw new ThemeNotFound();
  await prisma.theme.delete({ where: { id: themeId } });
  return { backgroundKey: theme.backgroundKey, wasPublic: theme.isPublic };
}

/** A theme another user may copy: public, or the caller's own. */
export async function getCopyableTheme(userId: string, themeId: string): Promise<ThemeRecord & { owner: { username: string } }> {
  const row = await prisma.theme.findFirst({
    where: { id: themeId, OR: [{ isPublic: true }, { ownerId: userId }] },
    select: { ...themeSelect, owner: { select: { username: true } } },
  });
  if (!row) throw new ThemeNotFound();
  return toRecord(row);
}

export type GalleryTheme = {
  id: string;
  name: string;
  tokens: ThemeTokens;
  backgroundKey: string | null;
  publishedAt: Date;
  owner: { username: string; displayName: string };
};

export async function listGallery(limit = 60): Promise<GalleryTheme[]> {
  const rows = await prisma.theme.findMany({
    where: { isPublic: true },
    orderBy: { publishedAt: "desc" },
    take: limit,
    select: {
      id: true,
      name: true,
      tokens: true,
      backgroundKey: true,
      publishedAt: true,
      owner: { select: { username: true, displayName: true } },
    },
  });
  return rows.map((r) => ({ ...toRecord(r), publishedAt: r.publishedAt ?? new Date(0) }));
}
