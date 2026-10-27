import { afterEach, describe, expect, it } from "vitest";
import { demoLoginAllowed } from "@/lib/config";

afterEach(() => {
  delete process.env.ALLOW_DEMO_LOGIN;
});

describe("demoLoginAllowed", () => {
  it("is on unless the deployment switches it off", () => {
    expect(demoLoginAllowed()).toBe(true);
    process.env.ALLOW_DEMO_LOGIN = "1";
    expect(demoLoginAllowed()).toBe(true);
    process.env.ALLOW_DEMO_LOGIN = "0";
    expect(demoLoginAllowed()).toBe(false);
    process.env.ALLOW_DEMO_LOGIN = "false";
    expect(demoLoginAllowed()).toBe(false);
  });
});
