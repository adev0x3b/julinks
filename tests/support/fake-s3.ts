import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

/**
 * The slice of the S3 API the app uses (bucket head/create, object put/get/
 * head/delete/copy, path-style addressing), in memory, with no auth. Lets the
 * integration and e2e suites run without Docker; CI and compose use SeaweedFS.
 */
type Stored = { body: Buffer; contentType: string };

export type FakeS3 = { url: string; port: number; objects: Map<string, Stored>; close: () => Promise<void> };

export function startFakeS3(port = 0): Promise<FakeS3> {
  const buckets = new Set<string>();
  const objects = new Map<string, Stored>();

  const server: Server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const [, bucket, ...rest] = url.pathname.split("/");
    const key = rest.map(decodeURIComponent).join("/");
    const objectId = `${bucket}/${key}`;

    if (url.pathname === "/healthz") return end(res, 200, "ok");
    if (!bucket) return end(res, 400);

    if (!key) {
      if (req.method === "HEAD") return end(res, buckets.has(bucket) ? 200 : 404);
      if (req.method === "PUT") {
        buckets.add(bucket);
        return end(res, 200);
      }
      return end(res, 405);
    }

    switch (req.method) {
      case "PUT": {
        const copySource = req.headers["x-amz-copy-source"];
        if (typeof copySource === "string") {
          const source = objects.get(decodeURIComponent(copySource.replace(/^\//, "")));
          if (!source) return s3Error(res, 404, "NoSuchKey");
          objects.set(objectId, { ...source });
          res.writeHead(200, { "Content-Type": "application/xml" });
          return res.end("<CopyObjectResult><ETag>\"copy\"</ETag></CopyObjectResult>");
        }
        const body = await readBody(req);
        objects.set(objectId, { body, contentType: String(req.headers["content-type"] ?? "application/octet-stream") });
        res.writeHead(200, { ETag: '"fake"' });
        return res.end();
      }
      case "GET":
      case "HEAD": {
        const stored = objects.get(objectId);
        if (!stored) return s3Error(res, 404, "NoSuchKey");
        res.writeHead(200, { "Content-Type": stored.contentType, "Content-Length": stored.body.length });
        return res.end(req.method === "HEAD" ? undefined : stored.body);
      }
      case "DELETE":
        objects.delete(objectId);
        return end(res, 204);
      default:
        return end(res, 405);
    }
  });

  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => {
      const { port: bound } = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${bound}`,
        port: bound,
        objects,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function end(res: ServerResponse, status: number, body?: string) {
  res.writeHead(status, body ? { "Content-Type": "text/plain" } : undefined);
  res.end(body);
}

function s3Error(res: ServerResponse, status: number, code: string) {
  res.writeHead(status, { "Content-Type": "application/xml" });
  res.end(`<?xml version="1.0" encoding="UTF-8"?><Error><Code>${code}</Code><Message>${code}</Message></Error>`);
}
