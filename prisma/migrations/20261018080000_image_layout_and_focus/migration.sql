-- Link pictures can show small (thumbnail) or big (featured), and every picture gets a focal point.
CREATE TYPE "ImageLayout" AS ENUM ('thumbnail', 'featured');

ALTER TABLE "users"
  ADD COLUMN "avatarFocusX" INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN "avatarFocusY" INTEGER NOT NULL DEFAULT 50;

ALTER TABLE "links"
  ADD COLUMN "imageLayout" "ImageLayout" NOT NULL DEFAULT 'thumbnail',
  ADD COLUMN "imageFocusX" INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN "imageFocusY" INTEGER NOT NULL DEFAULT 50;
