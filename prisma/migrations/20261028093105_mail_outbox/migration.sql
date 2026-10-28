-- The outbox every mail goes through (additive: a new table and enum, no existing rows touched).
-- CreateEnum
CREATE TYPE "MailStatus" AS ENUM ('queued', 'sending', 'sent', 'failed');

-- CreateTable
CREATE TABLE "mail_outbox" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "recipients" TEXT[],
    "subject" TEXT NOT NULL DEFAULT '',
    "text" TEXT NOT NULL DEFAULT '',
    "html" TEXT NOT NULL DEFAULT '',
    "status" "MailStatus" NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "notBefore" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "mail_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mail_outbox_status_notBefore_idx" ON "mail_outbox"("status", "notBefore");

-- CreateIndex
CREATE INDEX "mail_outbox_sentAt_idx" ON "mail_outbox"("sentAt");

