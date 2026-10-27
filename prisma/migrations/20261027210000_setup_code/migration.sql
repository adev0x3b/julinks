-- The one-time setup code that creates the admin on a fresh install (hash only; the code itself is printed).
-- Existing installs already have an admin, so no code is issued for them and nothing changes.
CREATE TABLE "setup_codes" (
    "id" INTEGER NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "setup_codes_pkey" PRIMARY KEY ("id")
);
