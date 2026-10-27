import { prisma } from "@/lib/db";
import type { SocialPlatformId } from "@/lib/socials";
import type { SocialEntry } from "@/lib/validation";

export type Social = { id: string; platform: SocialPlatformId; value: string; url: string };

const select = { id: true, platform: true, value: true, url: true } as const;

export async function listSocials(userId: string): Promise<Social[]> {
  const rows = await prisma.socialLink.findMany({ where: { userId }, orderBy: { position: "asc" }, select });
  return rows as Social[];
}

/** The icon row is small and edited as a whole: the saved list replaces the old one, in the given order. */
export async function replaceSocials(userId: string, entries: SocialEntry[]): Promise<Social[]> {
  await prisma.$transaction([
    prisma.socialLink.deleteMany({ where: { userId } }),
    prisma.socialLink.createMany({
      data: entries.map((entry, position) => ({ userId, platform: entry.platform, value: entry.value, url: entry.url, position })),
    }),
  ]);
  return listSocials(userId);
}
