import { describe, expect, it } from "vitest";
import { moveItem } from "@/lib/reorder";

describe("moveItem", () => {
  const items = ["a", "b", "c", "d"];

  it("moves an item down", () => {
    expect(moveItem(items, 0, 2)).toEqual(["b", "c", "a", "d"]);
  });

  it("moves an item up", () => {
    expect(moveItem(items, 3, 1)).toEqual(["a", "d", "b", "c"]);
  });

  it("returns a copy for out-of-range indexes", () => {
    const result = moveItem(items, 0, 9);
    expect(result).toEqual(items);
    expect(result).not.toBe(items);
  });
});
