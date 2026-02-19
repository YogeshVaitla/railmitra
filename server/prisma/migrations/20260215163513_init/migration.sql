-- CreateTable
CREATE TABLE "SeatMaster" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "trainNo" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "seatNo" INTEGER NOT NULL,
    "seatType" TEXT NOT NULL,
    "coachType" TEXT NOT NULL,
    "classType" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "SeatReport" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "seatId" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "gpsLat" REAL,
    "gpsLong" REAL,
    "verificationMethod" TEXT NOT NULL,
    "confidence" REAL NOT NULL DEFAULT 0.5,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SeatReport_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "SeatMaster" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserReputation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "deviceId" TEXT NOT NULL,
    "trustScore" REAL NOT NULL DEFAULT 0.5,
    "totalReports" INTEGER NOT NULL DEFAULT 0,
    "verifiedReports" INTEGER NOT NULL DEFAULT 0,
    "streakCount" INTEGER NOT NULL DEFAULT 0,
    "lastReportAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ToiletStatus" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "trainNo" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "toiletType" TEXT NOT NULL,
    "cleanlinessScore" REAL NOT NULL DEFAULT 3.0,
    "waterAvailable" BOOLEAN NOT NULL DEFAULT true,
    "queueLength" INTEGER NOT NULL DEFAULT 0,
    "reportedBy" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SwapRequest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "trainNo" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentCoachId" TEXT NOT NULL,
    "currentSeatNo" INTEGER NOT NULL,
    "currentSeatType" TEXT NOT NULL,
    "desiredSeatType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "matchedWith" INTEGER,
    "journeyDate" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "SeatMaster_trainNo_idx" ON "SeatMaster"("trainNo");

-- CreateIndex
CREATE INDEX "SeatMaster_trainNo_coachId_idx" ON "SeatMaster"("trainNo", "coachId");

-- CreateIndex
CREATE UNIQUE INDEX "SeatMaster_trainNo_coachId_seatNo_key" ON "SeatMaster"("trainNo", "coachId", "seatNo");

-- CreateIndex
CREATE INDEX "SeatReport_seatId_timestamp_idx" ON "SeatReport"("seatId", "timestamp");

-- CreateIndex
CREATE INDEX "SeatReport_deviceId_idx" ON "SeatReport"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "UserReputation_deviceId_key" ON "UserReputation"("deviceId");

-- CreateIndex
CREATE INDEX "UserReputation_trustScore_idx" ON "UserReputation"("trustScore");

-- CreateIndex
CREATE INDEX "ToiletStatus_trainNo_coachId_idx" ON "ToiletStatus"("trainNo", "coachId");

-- CreateIndex
CREATE INDEX "SwapRequest_trainNo_status_idx" ON "SwapRequest"("trainNo", "status");

-- CreateIndex
CREATE INDEX "SwapRequest_trainNo_desiredSeatType_status_idx" ON "SwapRequest"("trainNo", "desiredSeatType", "status");
