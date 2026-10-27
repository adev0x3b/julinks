-- Seeded demo profiles are flagged so they never count as an admin; before this the first sign-up became one.
ALTER TABLE "users" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;

UPDATE "users" SET "isDemo" = true, "role" = 'client'
  WHERE "email" IN ('ada@example.com', 'grace@example.com');

-- The oldest real account becomes admin when no real admin exists yet.
UPDATE "users" SET "role" = 'admin'
  WHERE NOT EXISTS (SELECT 1 FROM "users" WHERE "role" = 'admin' AND "isDemo" = false)
    AND "id" = (SELECT "id" FROM "users" WHERE "isDemo" = false ORDER BY "createdAt" ASC, "id" ASC LIMIT 1);
