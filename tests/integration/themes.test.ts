import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  activateTheme,
  createTheme,
  deleteTheme,
  getActiveTheme,
  getCopyableTheme,
  listGallery,
  listOwnThemes,
  setThemeBackground,
  setThemePublic,
  ThemeNotFound,
  updateTheme,
} from "@/lib/data/themes";
import { DEFAULT_PRESET, getPreset } from "@/lib/themes";
import { makeUser } from "./helpers";

const sunrise = getPreset("sunrise")!;

describe("themes", () => {
  it("falls back to the default preset until a theme is created, which becomes active", async () => {
    const user = await makeUser();
    expect(await getActiveTheme(user.id)).toEqual({ id: null, name: DEFAULT_PRESET.name, tokens: DEFAULT_PRESET.tokens, backgroundKey: null });

    const theme = await createTheme(user.id, { name: "Mine", tokens: sunrise.tokens });
    expect((await getActiveTheme(user.id)).id).toBe(theme.id);
    expect(await listOwnThemes(user.id)).toHaveLength(1);
  });

  it("edits, switches and deletes only the owner's themes", async () => {
    const owner = await makeUser();
    const other = await makeUser();
    const first = await createTheme(owner.id, { name: "First", tokens: sunrise.tokens });
    const second = await createTheme(owner.id, { name: "Second", tokens: DEFAULT_PRESET.tokens });
    expect((await getActiveTheme(owner.id)).id).toBe(second.id);

    await expect(updateTheme(other.id, first.id, { name: "Hijacked", tokens: sunrise.tokens })).rejects.toBeInstanceOf(ThemeNotFound);
    await expect(activateTheme(other.id, first.id)).rejects.toBeInstanceOf(ThemeNotFound);
    await expect(deleteTheme(other.id, first.id)).rejects.toBeInstanceOf(ThemeNotFound);

    const renamed = await updateTheme(owner.id, first.id, { name: "Renamed", tokens: { ...sunrise.tokens, radius: "none" } });
    expect(renamed.tokens.radius).toBe("none");
    await activateTheme(owner.id, first.id);
    expect((await getActiveTheme(owner.id)).name).toBe("Renamed");

    // Deleting the active theme sends the page back to the default preset.
    expect(await deleteTheme(owner.id, first.id)).toEqual({ backgroundKey: null, wasPublic: false });
    expect((await getActiveTheme(owner.id)).id).toBeNull();
    expect((await prisma.user.findUniqueOrThrow({ where: { id: owner.id } })).themeId).toBeNull();
  });

  it("tracks the background key and hands back the previous one", async () => {
    const user = await makeUser();
    const theme = await createTheme(user.id, { name: "Pic", tokens: sunrise.tokens });
    expect(await setThemeBackground(user.id, theme.id, "backgrounds/u/aaa.webp")).toBeNull();
    expect(await setThemeBackground(user.id, theme.id, "backgrounds/u/bbb.webp")).toBe("backgrounds/u/aaa.webp");
    expect((await getActiveTheme(user.id)).backgroundKey).toBe("backgrounds/u/bbb.webp");
  });

  it("publishes to the gallery, newest first, and lets others read only public themes", async () => {
    const alice = await makeUser({ username: "alice" });
    const bob = await makeUser({ username: "bob" });
    const secret = await createTheme(alice.id, { name: "Secret", tokens: sunrise.tokens });
    const shared = await createTheme(alice.id, { name: "Shared", tokens: sunrise.tokens });
    const bobs = await createTheme(bob.id, { name: "Bob's", tokens: DEFAULT_PRESET.tokens });

    await setThemePublic(alice.id, shared.id, true);
    await setThemePublic(bob.id, bobs.id, true);
    // Shared went public a minute earlier, so the gallery's newest-first order is unambiguous.
    await prisma.theme.update({ where: { id: shared.id }, data: { publishedAt: new Date(Date.now() - 60_000) } });

    const gallery = await listGallery();
    expect(gallery.map((t) => t.name)).toEqual(["Bob's", "Shared"]);
    expect(gallery[1].owner).toEqual({ username: "alice", displayName: alice.displayName });

    expect((await getCopyableTheme(bob.id, shared.id)).ownerId).toBe(alice.id);
    await expect(getCopyableTheme(bob.id, secret.id)).rejects.toBeInstanceOf(ThemeNotFound);
    expect((await getCopyableTheme(alice.id, secret.id)).id).toBe(secret.id);

    await setThemePublic(alice.id, shared.id, false);
    expect((await listGallery()).map((t) => t.name)).toEqual(["Bob's"]);
  });
});
