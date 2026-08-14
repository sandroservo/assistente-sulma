-- CreateTable
CREATE TABLE "ExcludedContact" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExcludedContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExcludedContact_organizationId_phone_key" ON "ExcludedContact"("organizationId", "phone");

-- CreateIndex
CREATE INDEX "ExcludedContact_organizationId_idx" ON "ExcludedContact"("organizationId");

-- AddForeignKey
ALTER TABLE "ExcludedContact" ADD CONSTRAINT "ExcludedContact_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
