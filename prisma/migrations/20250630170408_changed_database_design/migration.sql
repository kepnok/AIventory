/*
  Warnings:

  - You are about to drop the column `expiryDate` on the `Products` table. All the data in the column will be lost.
  - You are about to drop the column `lastRestocked` on the `Products` table. All the data in the column will be lost.
  - You are about to drop the column `quantity` on the `Products` table. All the data in the column will be lost.
  - You are about to drop the column `reorderLevel` on the `Products` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `Warehouse` table. All the data in the column will be lost.
  - You are about to drop the `RestockLog` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `restockLevel` to the `Products` table without a default value. This is not possible if the table is not empty.
  - Added the required column `warehouseId` to the `Users` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "RestockLog" DROP CONSTRAINT "RestockLog_productId_fkey";

-- AlterTable
ALTER TABLE "Products" DROP COLUMN "expiryDate",
DROP COLUMN "lastRestocked",
DROP COLUMN "quantity",
DROP COLUMN "reorderLevel",
ADD COLUMN     "restockLevel" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Users" ADD COLUMN     "warehouseId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Warehouse" DROP COLUMN "name";

-- DropTable
DROP TABLE "RestockLog";

-- CreateTable
CREATE TABLE "ProductBatch" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "restockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedBy" TEXT NOT NULL,

    CONSTRAINT "ProductBatch_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Users" ADD CONSTRAINT "Users_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductBatch" ADD CONSTRAINT "ProductBatch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
