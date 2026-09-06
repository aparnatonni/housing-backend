-- CreateEnum
CREATE TYPE "Role" AS ENUM ('TENANT', 'OWNER', 'ADMIN');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('LOCAL', 'GOOGLE');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('APARTMENT', 'HOUSE', 'STUDIO', 'CONDO', 'TOWNHOUSE');

-- CreateEnum
CREATE TYPE "PropertyStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "RoomType" AS ENUM ('SINGLE', 'DOUBLE', 'TRIPLE', 'QUAD', 'MASTER', 'STUDIO');

-- CreateEnum
CREATE TYPE "ViewingStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "TenancyStatus" AS ENUM ('ACTIVE', 'ENDED');

-- CreateEnum
CREATE TYPE "RentPaymentStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'FAILED');

-- CreateEnum
CREATE TYPE "BillType" AS ENUM ('ELECTRICITY', 'WATER', 'GAS', 'INTERNET', 'OTHER');

-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "MaintenancePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentGateway" AS ENUM ('STRIPE', 'RAZORPAY', 'PAYPAL', 'CASH', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentPurpose" AS ENUM ('RENT', 'BILL', 'DEPOSIT', 'OTHER');

-- CreateEnum
CREATE TYPE "GenderPreference" AS ENUM ('MALE', 'FEMALE', 'ANY');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "role" "Role" NOT NULL DEFAULT 'TENANT',
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "avatar_url" TEXT,
    "bio" TEXT,
    "date_of_birth" TIMESTAMP(3),
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "provider" "AuthProvider" NOT NULL DEFAULT 'LOCAL',
    "google_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "properties" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "area" TEXT,
    "state" TEXT,
    "zip_code" TEXT,
    "property_type" "PropertyType" NOT NULL DEFAULT 'APARTMENT',
    "amenities" TEXT[],
    "images" TEXT[],
    "status" "PropertyStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "room_type" "RoomType" NOT NULL DEFAULT 'SINGLE',
    "rent_amount" DOUBLE PRECISION NOT NULL,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "capacity" INTEGER NOT NULL,
    "images" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roommate_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "min_budget" DOUBLE PRECISION,
    "max_budget" DOUBLE PRECISION,
    "preferred_city" TEXT,
    "preferred_area" TEXT,
    "gender_preference" "GenderPreference" NOT NULL DEFAULT 'ANY',
    "lifestyle_tags" TEXT[],
    "is_smoker" BOOLEAN,
    "has_pets" BOOLEAN,
    "move_in_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roommate_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "viewing_requests" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "requested_date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "status" "ViewingStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "viewing_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "move_in_date" TIMESTAMP(3),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenancies" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "rent_amount" DOUBLE PRECISION NOT NULL,
    "status" "TenancyStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenancies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rent_payments" (
    "id" TEXT NOT NULL,
    "tenancy_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "paid_at" TIMESTAMP(3),
    "status" "RentPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rent_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_splits" (
    "id" TEXT NOT NULL,
    "tenancy_id" TEXT NOT NULL,
    "bill_type" "BillType" NOT NULL,
    "total_amount" DOUBLE PRECISION NOT NULL,
    "due_date" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "status" "BillStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bill_splits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_split_tenants" (
    "id" TEXT NOT NULL,
    "bill_split_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "share_amount" DOUBLE PRECISION NOT NULL,
    "is_paid" BOOLEAN NOT NULL DEFAULT false,
    "paid_at" TIMESTAMP(3),

    CONSTRAINT "bill_split_tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_requests" (
    "id" TEXT NOT NULL,
    "tenancy_id" TEXT,
    "room_id" TEXT,
    "tenant_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "images" TEXT[],
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "MaintenancePriority" NOT NULL DEFAULT 'MEDIUM',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "maintenance_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "purpose" "PaymentPurpose" NOT NULL DEFAULT 'RENT',
    "gateway" "PaymentGateway" NOT NULL DEFAULT 'STRIPE',
    "gateway_transaction_id" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");

-- CreateIndex
CREATE INDEX "users_role_deleted_at_idx" ON "users"("role", "deleted_at");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at");

-- CreateIndex
CREATE INDEX "properties_owner_id_deleted_at_idx" ON "properties"("owner_id", "deleted_at");

-- CreateIndex
CREATE INDEX "properties_city_status_deleted_at_idx" ON "properties"("city", "status", "deleted_at");

-- CreateIndex
CREATE INDEX "properties_area_idx" ON "properties"("area");

-- CreateIndex
CREATE INDEX "properties_status_created_at_idx" ON "properties"("status", "created_at");

-- CreateIndex
CREATE INDEX "properties_deleted_at_idx" ON "properties"("deleted_at");

-- CreateIndex
CREATE INDEX "rooms_property_id_deleted_at_idx" ON "rooms"("property_id", "deleted_at");

-- CreateIndex
CREATE INDEX "rooms_is_available_deleted_at_idx" ON "rooms"("is_available", "deleted_at");

-- CreateIndex
CREATE INDEX "rooms_room_type_rent_amount_idx" ON "rooms"("room_type", "rent_amount");

-- CreateIndex
CREATE INDEX "rooms_deleted_at_idx" ON "rooms"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "roommate_preferences_user_id_key" ON "roommate_preferences"("user_id");

-- CreateIndex
CREATE INDEX "roommate_preferences_preferred_city_idx" ON "roommate_preferences"("preferred_city");

-- CreateIndex
CREATE INDEX "roommate_preferences_gender_preference_idx" ON "roommate_preferences"("gender_preference");

-- CreateIndex
CREATE INDEX "viewing_requests_tenant_id_status_idx" ON "viewing_requests"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "viewing_requests_room_id_status_idx" ON "viewing_requests"("room_id", "status");

-- CreateIndex
CREATE INDEX "viewing_requests_status_idx" ON "viewing_requests"("status");

-- CreateIndex
CREATE INDEX "viewing_requests_requested_date_idx" ON "viewing_requests"("requested_date");

-- CreateIndex
CREATE INDEX "applications_tenant_id_status_idx" ON "applications"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "applications_room_id_status_idx" ON "applications"("room_id", "status");

-- CreateIndex
CREATE INDEX "applications_status_idx" ON "applications"("status");

-- CreateIndex
CREATE INDEX "applications_created_at_idx" ON "applications"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "tenancies_application_id_key" ON "tenancies"("application_id");

-- CreateIndex
CREATE INDEX "tenancies_tenant_id_status_idx" ON "tenancies"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "tenancies_room_id_status_idx" ON "tenancies"("room_id", "status");

-- CreateIndex
CREATE INDEX "tenancies_status_idx" ON "tenancies"("status");

-- CreateIndex
CREATE INDEX "tenancies_created_at_idx" ON "tenancies"("created_at");

-- CreateIndex
CREATE INDEX "rent_payments_tenancy_id_status_idx" ON "rent_payments"("tenancy_id", "status");

-- CreateIndex
CREATE INDEX "rent_payments_tenancy_id_due_date_idx" ON "rent_payments"("tenancy_id", "due_date");

-- CreateIndex
CREATE INDEX "rent_payments_status_idx" ON "rent_payments"("status");

-- CreateIndex
CREATE INDEX "rent_payments_due_date_idx" ON "rent_payments"("due_date");

-- CreateIndex
CREATE INDEX "bill_splits_tenancy_id_idx" ON "bill_splits"("tenancy_id");

-- CreateIndex
CREATE INDEX "bill_splits_status_idx" ON "bill_splits"("status");

-- CreateIndex
CREATE INDEX "bill_splits_due_date_idx" ON "bill_splits"("due_date");

-- CreateIndex
CREATE INDEX "bill_split_tenants_bill_split_id_idx" ON "bill_split_tenants"("bill_split_id");

-- CreateIndex
CREATE INDEX "bill_split_tenants_tenant_id_is_paid_idx" ON "bill_split_tenants"("tenant_id", "is_paid");

-- CreateIndex
CREATE INDEX "bill_split_tenants_tenant_id_idx" ON "bill_split_tenants"("tenant_id");

-- CreateIndex
CREATE INDEX "maintenance_requests_tenant_id_status_idx" ON "maintenance_requests"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "maintenance_requests_room_id_status_idx" ON "maintenance_requests"("room_id", "status");

-- CreateIndex
CREATE INDEX "maintenance_requests_status_priority_idx" ON "maintenance_requests"("status", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "payments_gateway_transaction_id_key" ON "payments"("gateway_transaction_id");

-- CreateIndex
CREATE INDEX "payments_user_id_status_idx" ON "payments"("user_id", "status");

-- CreateIndex
CREATE INDEX "payments_user_id_created_at_idx" ON "payments"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "payments_purpose_idx" ON "payments"("purpose");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_created_at_idx" ON "audit_logs"("entity_type", "created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_is_read_idx" ON "notifications"("is_read");

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roommate_preferences" ADD CONSTRAINT "roommate_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "viewing_requests" ADD CONSTRAINT "viewing_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "viewing_requests" ADD CONSTRAINT "viewing_requests_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenancies" ADD CONSTRAINT "tenancies_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenancies" ADD CONSTRAINT "tenancies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenancies" ADD CONSTRAINT "tenancies_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rent_payments" ADD CONSTRAINT "rent_payments_tenancy_id_fkey" FOREIGN KEY ("tenancy_id") REFERENCES "tenancies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_splits" ADD CONSTRAINT "bill_splits_tenancy_id_fkey" FOREIGN KEY ("tenancy_id") REFERENCES "tenancies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_split_tenants" ADD CONSTRAINT "bill_split_tenants_bill_split_id_fkey" FOREIGN KEY ("bill_split_id") REFERENCES "bill_splits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_split_tenants" ADD CONSTRAINT "bill_split_tenants_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_tenancy_id_fkey" FOREIGN KEY ("tenancy_id") REFERENCES "tenancies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
