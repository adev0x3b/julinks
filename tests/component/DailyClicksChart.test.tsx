import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DailyClicksChart } from "@/components/DailyClicksChart";

describe("DailyClicksChart", () => {
  it("draws one bar per day with an accessible summary", () => {
    const data = Array.from({ length: 7 }, (_, i) => ({ day: `2026-10-1${i}`, count: i }));
    const { container } = render(<DailyClicksChart data={data} />);
    expect(container.querySelectorAll("rect")).toHaveLength(7);
    expect(screen.getByRole("img", { name: /7 days/ })).toBeInTheDocument();
    expect(container.querySelector("figcaption")?.textContent).toContain("2026-10-16: 6");
  });
});
