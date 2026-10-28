-- Sign-ups waiting for their email to be confirmed (additive: a new table, no existing rows touched).
-- CreateTable
CREATE TABLE "signup_confirmations" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signup_confirmations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "signup_confirmations_email_key" ON "signup_confirmations"("email");

-- CreateIndex
CREATE UNIQUE INDEX "signup_confirmations_tokenHash_key" ON "signup_confirmations"("tokenHash");

-- CreateIndex
CREATE INDEX "signup_confirmations_expiresAt_idx" ON "signup_confirmations"("expiresAt");
