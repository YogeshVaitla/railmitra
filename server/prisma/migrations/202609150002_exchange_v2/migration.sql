-- CreateTable
CREATE TABLE "ExchangeOffer" (
    "id" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "train" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "state" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "created" TIMESTAMP(3) NOT NULL,
    "record" JSONB NOT NULL,

    CONSTRAINT "ExchangeOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeRevocation" (
    "owner" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExchangeRevocation_pkey" PRIMARY KEY ("owner")
);

-- CreateTable
CREATE TABLE "ExchangeReport" (
    "id" SERIAL NOT NULL,
    "reporter" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangeReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExchangeOffer_train_date_idx" ON "ExchangeOffer"("train", "date");

-- CreateIndex
CREATE INDEX "ExchangeOffer_owner_expires_idx" ON "ExchangeOffer"("owner", "expires");

-- CreateIndex
CREATE INDEX "ExchangeOffer_created_idx" ON "ExchangeOffer"("created");

-- CreateIndex
CREATE INDEX "ExchangeReport_created_idx" ON "ExchangeReport"("created");

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeReport_reporter_target_day_key" ON "ExchangeReport"("reporter", "target", "day");
