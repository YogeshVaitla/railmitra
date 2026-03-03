-- CreateTable
CREATE TABLE "SwapEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "swapId" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "metadata" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SwapEvent_swapId_fkey" FOREIGN KEY ("swapId") REFERENCES "SwapRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SwapSession" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "acceptedBy" TEXT NOT NULL DEFAULT '',
    "totalRequired" INTEGER NOT NULL DEFAULT 2,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SwapRequest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "trainNo" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentCoachId" TEXT NOT NULL,
    "currentSeatNo" INTEGER NOT NULL,
    "currentSeatType" TEXT NOT NULL,
    "desiredSeatType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "matchedWith" INTEGER,
    "sessionId" INTEGER,
    "priorityScore" REAL NOT NULL DEFAULT 0.5,
    "reason" TEXT,
    "expiresAt" DATETIME,
    "journeyDate" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SwapRequest_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SwapSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SwapRequest" ("createdAt", "currentCoachId", "currentSeatNo", "currentSeatType", "desiredSeatType", "id", "journeyDate", "matchedWith", "status", "trainNo", "updatedAt", "userId") SELECT "createdAt", "currentCoachId", "currentSeatNo", "currentSeatType", "desiredSeatType", "id", "journeyDate", "matchedWith", "status", "trainNo", "updatedAt", "userId" FROM "SwapRequest";
DROP TABLE "SwapRequest";
ALTER TABLE "new_SwapRequest" RENAME TO "SwapRequest";
CREATE INDEX "SwapRequest_trainNo_status_idx" ON "SwapRequest"("trainNo", "status");
CREATE INDEX "SwapRequest_trainNo_desiredSeatType_status_idx" ON "SwapRequest"("trainNo", "desiredSeatType", "status");
CREATE INDEX "SwapRequest_trainNo_journeyDate_status_idx" ON "SwapRequest"("trainNo", "journeyDate", "status");
CREATE INDEX "SwapRequest_expiresAt_idx" ON "SwapRequest"("expiresAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "SwapEvent_swapId_timestamp_idx" ON "SwapEvent"("swapId", "timestamp");

-- CreateIndex
CREATE INDEX "SwapEvent_eventType_idx" ON "SwapEvent"("eventType");

-- CreateIndex
CREATE INDEX "SwapSession_status_idx" ON "SwapSession"("status");
