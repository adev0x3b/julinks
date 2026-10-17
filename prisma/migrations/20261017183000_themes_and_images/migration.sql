-- Themes become rows with JSON tokens; users point at one. Images are keys into object storage.
CREATE TABLE "themes" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokens" JSONB NOT NULL,
    "backgroundKey" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "forkedFromId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "themes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "themes_ownerId_updatedAt_idx" ON "themes"("ownerId", "updatedAt");
CREATE INDEX "themes_isPublic_publishedAt_idx" ON "themes"("isPublic", "publishedAt");

ALTER TABLE "themes" ADD CONSTRAINT "themes_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "users" ADD COLUMN "avatarKey" TEXT,
ADD COLUMN "themeId" TEXT;

ALTER TABLE "links" ADD COLUMN "thumbnailKey" TEXT;

-- Users who had picked a preset other than the default keep their look as a theme of their own.
-- The token values mirror the presets in src/lib/themes.ts at the time of this migration.
WITH presets("preset", "name", "tokens") AS (
  VALUES
    ('sunrise', 'Sunrise', '{"background":"#fff7ed","backgroundEnd":"#fecdd3","text":"#431407","muted":"#9a3412","button":"#fb923c","buttonText":"#431407","buttonStyle":"solid","radius":"medium","font":"rounded","overlay":20}'::jsonb),
    ('forest',  'Forest',  '{"background":"#052e16","backgroundEnd":"#14532d","text":"#ecfdf5","muted":"#86efac","button":"#166534","buttonText":"#ecfdf5","buttonStyle":"solid","radius":"small","font":"serif","overlay":40}'::jsonb),
    ('paper',   'Paper',   '{"background":"#fafaf9","backgroundEnd":null,"text":"#1c1917","muted":"#57534e","button":"#1c1917","buttonText":"#1c1917","buttonStyle":"outline","radius":"none","font":"serif","overlay":10}'::jsonb),
    ('neon',    'Neon',    '{"background":"#09090b","backgroundEnd":null,"text":"#fafafa","muted":"#a3e635","button":"#a3e635","buttonText":"#a3e635","buttonStyle":"outline","radius":"none","font":"mono","overlay":50}'::jsonb)
),
created AS (
  INSERT INTO "themes" ("id", "ownerId", "name", "tokens", "updatedAt")
  SELECT 'mig_' || u."id", u."id", p."name", p."tokens", CURRENT_TIMESTAMP
  FROM "users" u JOIN presets p ON p."preset" = u."theme"
  RETURNING "id", "ownerId"
)
UPDATE "users" u SET "themeId" = c."id" FROM created c WHERE c."ownerId" = u."id";

ALTER TABLE "users" DROP COLUMN "theme";

ALTER TABLE "users" ADD CONSTRAINT "users_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "themes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
