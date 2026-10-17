import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PublicProfile } from "@/components/PublicProfile";

const profile = {
  username: "ada",
  displayName: "Ada Lovelace",
  bio: "Poetical science",
  theme: "sunrise",
  links: [
    { id: "l1", title: "Notes", url: "https://example.com/notes" },
    { id: "l2", title: "Letters", url: "https://example.com/letters" },
  ],
};

describe("PublicProfile", () => {
  it("renders name, handle, bio and links pointing at the click endpoint", () => {
    render(<PublicProfile profile={profile} />);
    expect(screen.getByRole("heading", { name: "Ada Lovelace" })).toBeInTheDocument();
    expect(screen.getByText("@ada")).toBeInTheDocument();
    expect(screen.getByText("Poetical science")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Notes" })).toHaveAttribute("href", "/l/l1");
    expect(screen.getByRole("link", { name: "Letters" })).toHaveAttribute("href", "/l/l2");
  });

  it("does not navigate in preview mode", () => {
    render(<PublicProfile profile={profile} preview />);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("applies the selected theme and shows an empty state", () => {
    const { container } = render(<PublicProfile profile={{ ...profile, links: [] }} />);
    expect(container.firstElementChild).toHaveAttribute("data-theme", "sunrise");
    expect(screen.getByText("No links yet.")).toBeInTheDocument();
  });
});
