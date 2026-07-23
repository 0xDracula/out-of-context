/*
  Warnings:

  - You are about to drop the column `optedOut` on the `User` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "OptInStatus" AS ENUM ('DEFAULT', 'OPTED_IN', 'OPTED_OUT');

-- AlterTable
ALTER TABLE "User" DROP COLUMN "optedOut",
ADD COLUMN     "optInStatus" "OptInStatus" NOT NULL DEFAULT 'DEFAULT';
