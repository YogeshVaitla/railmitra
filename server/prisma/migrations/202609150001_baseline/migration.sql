-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "SeatMaster" (
    "id" SERIAL NOT NULL,
    "trainNo" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "seatNo" INTEGER NOT NULL,
    "seatType" TEXT NOT NULL,
    "coachType" TEXT NOT NULL,
    "classType" TEXT NOT NULL,

    CONSTRAINT "SeatMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeatReport" (
    "id" SERIAL NOT NULL,
    "seatId" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "gpsLat" DOUBLE PRECISION,
    "gpsLong" DOUBLE PRECISION,
    "verificationMethod" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeatReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserReputation" (
    "id" SERIAL NOT NULL,
    "deviceId" TEXT NOT NULL,
    "trustScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "totalReports" INTEGER NOT NULL DEFAULT 0,
    "verifiedReports" INTEGER NOT NULL DEFAULT 0,
    "streakCount" INTEGER NOT NULL DEFAULT 0,
    "lastReportAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserReputation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToiletStatus" (
    "id" SERIAL NOT NULL,
    "trainNo" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "toiletType" TEXT NOT NULL,
    "cleanlinessScore" DOUBLE PRECISION NOT NULL DEFAULT 3.0,
    "waterAvailable" BOOLEAN NOT NULL DEFAULT true,
    "queueLength" INTEGER NOT NULL DEFAULT 0,
    "reportedBy" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToiletStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SwapRequest" (
    "id" SERIAL NOT NULL,
    "trainNo" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentCoachId" TEXT NOT NULL,
    "currentSeatNo" INTEGER NOT NULL,
    "currentSeatType" TEXT NOT NULL,
    "desiredSeatType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "matchedWith" INTEGER,
    "sessionId" INTEGER,
    "priorityScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "reason" TEXT,
    "expiresAt" TIMESTAMP(3),
    "journeyDate" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SwapRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SwapEvent" (
    "id" SERIAL NOT NULL,
    "swapId" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "metadata" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SwapEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SwapSession" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "acceptedBy" TEXT NOT NULL DEFAULT '',
    "totalRequired" INTEGER NOT NULL DEFAULT 2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "SwapSession_pkey" PRIMARY KEY ("id")
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

-- CreateIndex
CREATE INDEX "SwapRequest_trainNo_journeyDate_status_idx" ON "SwapRequest"("trainNo", "journeyDate", "status");

-- CreateIndex
CREATE INDEX "SwapRequest_expiresAt_idx" ON "SwapRequest"("expiresAt");

-- CreateIndex
CREATE INDEX "SwapEvent_swapId_timestamp_idx" ON "SwapEvent"("swapId", "timestamp");

-- CreateIndex
CREATE INDEX "SwapEvent_eventType_idx" ON "SwapEvent"("eventType");

-- CreateIndex
CREATE INDEX "SwapSession_status_idx" ON "SwapSession"("status");

-- AddForeignKey
ALTER TABLE "SeatReport" ADD CONSTRAINT "SeatReport_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "SeatMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SwapRequest" ADD CONSTRAINT "SwapRequest_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SwapSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SwapEvent" ADD CONSTRAINT "SwapEvent_swapId_fkey" FOREIGN KEY ("swapId") REFERENCES "SwapRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
