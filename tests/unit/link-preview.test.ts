import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { extractPreviewImage, fetchLinkPreview, isPrivateAddress, PreviewError } from "@/lib/link-preview";

describe("isPrivateAddress", () => {
  it("blocks loopback, private, link-local and v4-mapped addresses", () => {
    for (const address of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "0.0.0.0", "100.64.0.1", "::1", "::", "fc00::1", "fd12::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1"]) {
      expect(isPrivateAddress(address), address).toBe(true);
    }
  });

  it("allows public addresses", () => {
    for (const address of ["8.8.8.8", "172.32.0.1", "93.184.216.34", "2606:4700::1111", "::ffff:8.8.8.8"]) {
      expect(isPrivateAddress(address), address).toBe(false);
    }
  });
});

describe("extractPreviewImage", () => {
  it("prefers og:image, then twitter:image, then image_src, and resolves relative URLs", () => {
    const page = "https://example.com/posts/1";
    expect(extractPreviewImage('<meta name="twitter:image" content="/t.png"><meta property="og:image" content="/og.png">', page)).toBe("https://example.com/og.png");
    expect(extractPreviewImage("<meta name='twitter:image' content='https://cdn.example.com/t.png'>", page)).toBe("https://cdn.example.com/t.png");
    expect(extractPreviewImage('<link rel="image_src" href="img.jpg">', page)).toBe("https://example.com/posts/img.jpg");
    expect(extractPreviewImage('<meta property="og:image" content="/a.png?x=1&amp;y=2">', page)).toBe("https://example.com/a.png?x=1&y=2");
  });

  it("ignores pages without one and non-web schemes", () => {
    expect(extractPreviewImage("<html><head><title>x</title></head></html>", "https://example.com")).toBeNull();
    expect(extractPreviewImage('<meta property="og:image" content="javascript:alert(1)">', "https://example.com")).toBeNull();
  });
});

describe("fetchLinkPreview", () => {
  let server: Server;
  let base: string;
  let png: Buffer;

  beforeAll(async () => {
    png = await sharp({ create: { width: 40, height: 20, channels: 3, background: "#00aa55" } }).png().toBuffer();
    server = createServer((req, res) => {
      switch (req.url) {
        case "/page":
          res.setHeader("content-type", "text/html; charset=utf-8");
          return res.end(`<html><head><meta property="og:image" content="/pic.png"></head><body>hi</body></html>`);
        case "/redirect":
          res.writeHead(302, { location: "/page" });
          return res.end();
        case "/loop":
          res.writeHead(302, { location: "/loop" });
          return res.end();
        case "/pic.png":
          res.setHeader("content-type", "image/png");
          return res.end(png);
        case "/plain":
          res.setHeader("content-type", "text/html");
          return res.end("<html><body>no preview here</body></html>");
        case "/huge":
          res.setHeader("content-type", "text/html");
          res.setHeader("content-length", String(50 * 1024 * 1024));
          return res.end("x");
        default:
          res.statusCode = 404;
          return res.end();
      }
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it("downloads the advertised image, following a redirect to the page", async () => {
    const preview = await fetchLinkPreview(`${base}/redirect`, { allowPrivateAddresses: true });
    expect(preview.imageUrl).toBe(`${base}/pic.png`);
    expect(preview.contentType).toBe("image/png");
    expect(Buffer.from(preview.data).equals(png)).toBe(true);
  });

  it("returns the link itself when it is an image", async () => {
    const preview = await fetchLinkPreview(`${base}/pic.png`, { allowPrivateAddresses: true });
    expect(preview.imageUrl).toBe(`${base}/pic.png`);
  });

  it("explains pages without a preview, 404s, redirect loops and oversized answers", async () => {
    const opts = { allowPrivateAddresses: true };
    await expect(fetchLinkPreview(`${base}/plain`, opts)).rejects.toThrow(/does not advertise/);
    await expect(fetchLinkPreview(`${base}/missing`, opts)).rejects.toThrow(/404/);
    await expect(fetchLinkPreview(`${base}/loop`, opts)).rejects.toThrow(/redirects/);
    await expect(fetchLinkPreview(`${base}/huge`, opts)).rejects.toThrow(/too large/);
    await expect(fetchLinkPreview("ftp://example.com/x", opts)).rejects.toThrow(/http/);
  });

  it("refuses private addresses unless told otherwise (the production default)", async () => {
    await expect(fetchLinkPreview(`${base}/page`)).rejects.toBeInstanceOf(PreviewError);
    await expect(fetchLinkPreview(`${base}/page`)).rejects.toThrow(/not reachable/);
    await expect(fetchLinkPreview("http://localhost:65000/page")).rejects.toThrow(/not reachable/);
  });
});
