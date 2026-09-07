-- AlterEnum
ALTER TYPE "PaymentGateway" ADD VALUE 'SSLCOMMERZ';

-- AlterTable
ALTER TABLE "bill_splits" ADD COLUMN     "payment_id" TEXT;

-- AddForeignKey
ALTER TABLE "bill_splits" ADD CONSTRAINT "bill_splits_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;