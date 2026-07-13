-- Password + OTP auth. Additive only: no column is dropped, so every existing user, meal and
-- food entry survives untouched. An account that predates this migration simply has a NULL
-- passwordHash and sets one via the "forgot password" flow, keeping the same row and the same
-- id — which is what keeps its food log attached.

ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;
ALTER TABLE "User" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "EmailOtp" (
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailOtp_pkey" PRIMARY KEY ("email")
);

-- Sessions become JWTs (Auth.js can't persist a credentials login to this table), so every
-- existing database session is dead weight. Clearing them signs everyone out once, deliberately.
DELETE FROM "Session";
