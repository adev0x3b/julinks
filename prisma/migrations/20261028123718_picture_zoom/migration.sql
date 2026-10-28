-- Zoom for avatars and link pictures (additive: two columns defaulting to 100, existing pictures unchanged).
-- AlterTable
ALTER TABLE "links" ADD COLUMN     "imageZoom" INTEGER NOT NULL DEFAULT 100;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "avatarZoom" INTEGER NOT NULL DEFAULT 100;
