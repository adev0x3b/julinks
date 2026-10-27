-- Session tokens carry the account's version; a password change bumps it so older tokens stop working.
-- Existing tokens carry no version and count as 0, which matches the default: nobody is logged out.
ALTER TABLE "users" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
