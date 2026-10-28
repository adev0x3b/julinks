import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LinkMenu, PageShareButton } from "@/components/ShareButtons";

const writeText = vi.fn(() => Promise.resolve());

afterEach(() => {
  vi.unstubAllGlobals();
  writeText.mockClear();
});

describe("sharing on the public page", () => {
  it("copies the page address where there is no share sheet, and says so", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    render(<PageShareButton username="ada" displayName="Ada" preview={false} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Share this page" })));
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/ada`);
    expect(screen.getByRole("status")).toHaveTextContent("Link copied");
  });

  it("uses the system share sheet when there is one", async () => {
    const share = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { share, clipboard: { writeText } });
    render(<PageShareButton username="ada" displayName="Ada" preview={false} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Share this page" })));
    expect(share).toHaveBeenCalledWith({ title: "Ada", url: `${window.location.origin}/ada` });
    expect(writeText).not.toHaveBeenCalled();
  });

  it("copies a link's own address from its menu, and closes the menu on Escape", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    render(<LinkMenu title="Notes" url="https://example.com/notes" preview={false} />);
    fireEvent.click(screen.getByRole("button", { name: "More options for Notes" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "More options for Notes" }));
    await act(async () => fireEvent.click(screen.getByRole("menuitem", { name: "Copy link" })));
    expect(writeText).toHaveBeenCalledWith("https://example.com/notes");
    expect(screen.getByRole("status")).toHaveTextContent("Link copied");
  });
});
