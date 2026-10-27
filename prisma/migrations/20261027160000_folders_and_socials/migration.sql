-- Link folders (sections on the public page, open or collapsed) and the social icon row under the bio.
CREATE TABLE "folders" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "collapsed" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "folders_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "folders_userId_position_idx" ON "folders"("userId", "position");
ALTER TABLE "folders" ADD CONSTRAINT "folders_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "links" ADD COLUMN "folderId" TEXT;
CREATE INDEX "links_folderId_idx" ON "links"("folderId");
ALTER TABLE "links" ADD CONSTRAINT "links_folderId_fkey"
  FOREIGN KEY ("folderId") REFERENCES "folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "social_links" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  CONSTRAINT "social_links_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "social_links_userId_position_idx" ON "social_links"("userId", "position");
ALTER TABLE "social_links" ADD CONSTRAINT "social_links_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
