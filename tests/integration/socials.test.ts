import { describe, expect, it } from "vitest";
import { listSocials, replaceSocials } from "@/lib/data/socials";
import { getPublicProfile } from "@/lib/data/users";
import { makeUser } from "./helpers";

describe("socials", () => {
  it("are saved as a whole, in order, and show on the public page", async () => {
    const user = await makeUser({ username: "ada" });
    await replaceSocials(user.id, [
      { platform: "instagram", value: "@ada", url: "https://instagram.com/ada" },
      { platform: "email", value: "ada@example.com", url: "mailto:ada@example.com" },
    ]);
    expect((await listSocials(user.id)).map((s) => s.platform)).toEqual(["instagram", "email"]);

    await replaceSocials(user.id, [{ platform: "email", value: "ada@example.com", url: "mailto:ada@example.com" }]);
    expect((await getPublicProfile("ada"))?.socials).toEqual([{ platform: "email", url: "mailto:ada@example.com" }]);

    await replaceSocials(user.id, []);
    expect(await listSocials(user.id)).toEqual([]);
  });
});
