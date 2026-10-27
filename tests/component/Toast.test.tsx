import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Toast } from "@/components/Toast";

describe("Toast", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("announces a denial as an alert and goes away on its own", () => {
    render(<Toast tone="danger" message="Your registration request has been denied." />);
    expect(screen.getByRole("alert")).toHaveTextContent("denied");
    act(() => vi.advanceTimersByTime(8000));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("can be dismissed by hand", () => {
    render(<Toast tone="info" message="Still waiting." />);
    expect(screen.getByRole("status")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("status")).toBeNull();
  });
});
