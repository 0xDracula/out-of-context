-- Drop the CoC acceptance gate; no longer required to submit.
ALTER TABLE "User" DROP COLUMN "cocAccepted";

-- Restore the simple opt-out boolean, replacing the tri-state OptInStatus.
ALTER TABLE "User" ADD COLUMN "optedOut" BOOLEAN NOT NULL DEFAULT false;

-- Preserve existing opt-outs: anyone who explicitly opted out stays opted out.
UPDATE "User" SET "optedOut" = true WHERE "optInStatus" = 'OPTED_OUT';

ALTER TABLE "User" DROP COLUMN "optInStatus";

DROP TYPE "OptInStatus";
