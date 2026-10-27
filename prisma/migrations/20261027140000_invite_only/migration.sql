-- Sign-ups become requests that an admin or moderator approves or denies, and accounts get a role.
CREATE TYPE "AccountStatus" AS ENUM ('pending', 'approved', 'denied');
CREATE TYPE "Role" AS ENUM ('client', 'moderator', 'admin');

ALTER TABLE "users"
  ADD COLUMN "status" "AccountStatus" NOT NULL DEFAULT 'pending',
  ADD COLUMN "role" "Role" NOT NULL DEFAULT 'client',
  ADD COLUMN "reviewedAt" TIMESTAMP(3);

-- Accounts that exist already were created when anyone could sign up: keep them working,
-- and make the oldest one the admin so somebody can review the requests that follow.
UPDATE "users" SET "status" = 'approved', "reviewedAt" = CURRENT_TIMESTAMP;
UPDATE "users" SET "role" = 'admin'
  WHERE "id" = (SELECT "id" FROM "users" ORDER BY "createdAt" ASC, "id" ASC LIMIT 1);
