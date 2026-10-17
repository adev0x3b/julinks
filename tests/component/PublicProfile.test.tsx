import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PublicProfile, type PublicProfileData } from "@/components/PublicProfile";
import { getPreset } from "@/lib/themes";

const sunrise = getPreset("sunrise")!;

const profile: PublicProfileData = {
  username: "ada",
  displayName: "Ada Lovelace",
  bio: "Poetical science",
  avatarUrl: null,
  theme: { name: sunrise.name, tokens: sunrise.tokens, backgroundUrl: null },
  links: [
    { id: "l1", title: "Notes", url: "https://example.com/notes", thumbnailUrl: null },
    { id: "l2", title: "Letters", url: "https://example.com/letters", thumbnailUrl: "/img/thumbnails/u/000000000000000000000000.webp" },
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

  it("applies the theme as custom properties and shows an empty state", () => {
    const { container } = render(<PublicProfile profile={{ ...profile, links: [] }} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute("data-theme", "Sunrise");
    expect(root.style.getPropertyValue("--jl-text")).toBe(sunrise.tokens.text);
    expect(root.style.getPropertyValue("--jl-bg")).toContain("linear-gradient");
    expect(screen.getByText("No links yet.")).toBeInTheDocument();
  });

  it("shows initials without an avatar and the picture with one", () => {
    const { container, rerender } = render(<PublicProfile profile={profile} />);
    expect(container.querySelector(".jl-avatar")).toHaveTextContent("AL");
    rerender(<PublicProfile profile={{ ...profile, avatarUrl: "/img/avatars/u/000000000000000000000000.webp" }} />);
    expect(container.querySelector("img.jl-avatar")).toHaveAttribute("src", "/img/avatars/u/000000000000000000000000.webp");
  });

  it("puts a link's picture inside its button", () => {
    render(<PublicProfile profile={profile} />);
    const letters = screen.getByRole("link", { name: "Letters" });
    expect(letters.querySelector("img")).toHaveAttribute("src", profile.links[1].thumbnailUrl);
    expect(screen.getByRole("link", { name: "Notes" }).querySelector("img")).toBeNull();
  });
});
