-- Messages from the contact form (reports, privacy requests). Additive: a new table and enum.
-- CreateEnum
CREATE TYPE "ContactMessageKind" AS ENUM ('report', 'privacy', 'other');

-- CreateTable
CREATE TABLE "contact_messages" (
    "id" TEXT NOT NULL,
    "kind" "ContactMessageKind" NOT NULL,
    "page" TEXT,
    "message" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contact_messages_createdAt_idx" ON "contact_messages"("createdAt");
