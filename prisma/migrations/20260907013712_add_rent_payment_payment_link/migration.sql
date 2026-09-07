-- AlterTable
ALTER TABLE "rent_payments" ADD COLUMN     "payment_id" TEXT;

-- AddForeignKey
ALTER TABLE "rent_payments" ADD CONSTRAINT "rent_payments_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
