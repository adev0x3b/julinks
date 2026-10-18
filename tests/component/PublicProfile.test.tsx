import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CENTRE, PublicProfile, type PublicProfileData } from "@/components/PublicProfile";
import { getPreset } from "@/lib/themes";

const sunrise = getPreset("sunrise")!;

const profile: PublicProfileData = {
  username: "ada",
  displayName: "Ada Lovelace",
  bio: "Poetical science",
  avatarUrl: null,
  avatarFocus: CENTRE,
  theme: { name: sunrise.name, tokens: sunrise.tokens, backgroundUrl: null },
  links: [
    { id: "l1", title: "Notes", url: "https://example.com/notes", thumbnailUrl: null, imageLayout: "thumbnail", imageFocus: CENTRE },
    {
      id: "l2",
      title: "Letters",
      url: "https://example.com/letters",
      thumbnailUrl: "/img/thumbnails/u/000000000000000000000000.webp",
      imageLayout: "thumbnail",
      imageFocus: { x: 20, y: 80 },
    },
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

  it("puts a link's picture inside its button, centred on the focal point", () => {
    render(<PublicProfile profile={profile} />);
    const letters = screen.getByRole("link", { name: "Letters" });
    expect(letters).toHaveAttribute("data-layout", "thumbnail");
    const img = letters.querySelector("img")!;
    expect(img).toHaveAttribute("src", profile.links[1].thumbnailUrl);
    expect(img.style.objectPosition).toBe("20% 80%");
    expect(screen.getByRole("link", { name: "Notes" }).querySelector("img")).toBeNull();
  });

  it("shows a featured picture big, above the title", () => {
    const links = [{ ...profile.links[1], imageLayout: "featured" as const }];
    render(<PublicProfile profile={{ ...profile, links }} />);
    const letters = screen.getByRole("link", { name: "Letters" });
    expect(letters).toHaveAttribute("data-layout", "featured");
    const img = letters.querySelector("img")!;
    expect(img.className).toContain("w-full");
    expect(img.style.objectPosition).toBe("20% 80%");
    expect(img.nextElementSibling).toHaveTextContent("Letters");
  });

  it("centres the avatar on its focal point", () => {
    const { container } = render(
      <PublicProfile profile={{ ...profile, avatarUrl: "/img/avatars/u/000000000000000000000000.webp", avatarFocus: { x: 10, y: 0 } }} />,
    );
    expect((container.querySelector("img.jl-avatar") as HTMLElement).style.objectPosition).toBe("10% 0%");
  });
});
