import type { Prisma } from "@prisma/client";
import { AppError } from "../../errors";
import { sendMailToUser } from "../../lib/mailer";
import prisma from "../../lib/prisma";
import { getBrowsableRoom } from "../rooms/rooms.service";
import type {
  CreateApplicationInput,
  ListApplicationsQuery,
} from "./applications.validation";

const applicationSelect = {
  id: true,
  status: true,
  moveInDate: true,
  note: true,
  createdAt: true,
  updatedAt: true,
  tenancy: {
    select: {
      id: true,
      startDate: true,
      rentAmount: true,
      status: true,
    },
  },
  tenant: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      avatarUrl: true,
    },
  },
  room: {
    select: {
      id: true,
      roomType: true,
      rentAmount: true,
      capacity: true,
      isAvailable: true,
      images: true,
      property: {
        select: {
          id: true,
          title: true,
          address: true,
          city: true,
          propertyType: true,
          images: true,
        },
      },
    },
  },
} satisfies Prisma.ApplicationSelect;

export const createApplication = async (
  tenantId: string,
  input: CreateApplicationInput,
) => {
  const room = await getBrowsableRoom(input.roomId);
  if (!room.isAvailable) {
    throw new AppError("This room is no longer available", 409);
  }

  const existing = await prisma.application.findFirst({
    where: { tenantId, roomId: room.id, status: "PENDING" },
    select: { id: true },
  });
  if (existing) {
    throw new AppError(
      "You already have a pending application for this room",
      409,
    );
  }

  return prisma.application.create({
    data: {
      tenantId,
      roomId: room.id,
      moveInDate: input.moveInDate ? new Date(input.moveInDate) : null,
      note: input.note,
      status: "PENDING",
    },
    select: applicationSelect,
  });
};

export const listMyApplications = async (
  tenantId: string,
  query: ListApplicationsQuery,
) => {
  const where: Prisma.ApplicationWhereInput = {
    tenantId,
    ...(query.status ? { status: query.status } : {}),
  };

  const [total, items] = await Promise.all([
    prisma.application.count({ where }),
    prisma.application.findMany({
      where,
      select: applicationSelect,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);

  return {
    items,
    meta: {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
      hasNextPage: query.page < Math.ceil(total / query.limit),
    },
  };
};

const loadApplicationForOwner = async (
  ownerId: string,
  applicationId: string,
) => {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      status: true,
      tenantId: true,
      roomId: true,
      moveInDate: true,
      room: {
        select: {
          deletedAt: true,
          rentAmount: true,
          property: { select: { deletedAt: true, ownerId: true } },
        },
      },
    },
  });
  if (
    !application ||
    application.room.deletedAt !== null ||
    application.room.property.deletedAt !== null
  ) {
    throw new AppError("Application not found", 404);
  }
  if (application.room.property.ownerId !== ownerId) {
    throw new AppError(
      "You do not have permission to process this application",
      403,
    );
  }
  return application;
};

const createAudit = (
  tx: Prisma.TransactionClient,
  userId: string,
  action: string,
  applicationId: string,
  metadata: Prisma.InputJsonValue,
) =>
  tx.auditLog.create({
    data: {
      userId,
      action,
      entityType: "Application",
      entityId: applicationId,
      metadata,
    },
  });

export const approveApplication = async (
  ownerId: string,
  applicationId: string,
) => {
  const application = await loadApplicationForOwner(ownerId, applicationId);
  if (application.status !== "PENDING") {
    throw new AppError("Application has already been processed", 409);
  }

  const { tenantId, roomId, moveInDate } = application;

  const approved = await prisma.$transaction(
    async (tx) => {
      const claim = await tx.application.updateMany({
        where: { id: applicationId, status: "PENDING" },
        data: { status: "APPROVED" },
      });
      if (claim.count === 0) {
        throw new AppError("Application has already been processed", 409);
      }

      const taken = await tx.room.updateMany({
        where: { id: roomId, isAvailable: true },
        data: { isAvailable: false },
      });
      if (taken.count === 0) {
        throw new AppError("This room has already been rented", 409);
      }

      await tx.application.updateMany({
        where: { roomId, status: "PENDING" },
        data: { status: "REJECTED" },
      });

      await tx.tenancy.create({
        data: {
          applicationId,
          tenantId,
          roomId,
          startDate: moveInDate ?? new Date(),
          rentAmount: application.room.rentAmount,
          status: "ACTIVE",
        },
      });

      await createAudit(tx, ownerId, "APPLICATION_APPROVED", applicationId, {
        roomId,
        tenantId,
      });

      await tx.notification.create({
        data: {
          userId: tenantId,
          type: "APPLICATION_APPROVED",
          message: "Your housing application has been approved.",
        },
      });

      return tx.application.findUniqueOrThrow({
        where: { id: applicationId },
        select: applicationSelect,
      });
    },
    { timeout: 30_000 },
  );

  await sendMailToUser(
    tenantId,
    "Your housing application has been approved",
    "Your housing application has been approved. Welcome aboard!",
  );

  return approved;
};

export const rejectApplication = async (
  ownerId: string,
  applicationId: string,
) => {
  const application = await loadApplicationForOwner(ownerId, applicationId);
  if (application.status !== "PENDING") {
    throw new AppError("Application has already been processed", 409);
  }

  const { tenantId, roomId } = application;

  const rejected = await prisma.$transaction(
    async (tx) => {
      const claim = await tx.application.updateMany({
        where: { id: applicationId, status: "PENDING" },
        data: { status: "REJECTED" },
      });
      if (claim.count === 0) {
        throw new AppError("Application has already been processed", 409);
      }

      await createAudit(tx, ownerId, "APPLICATION_REJECTED", applicationId, {
        roomId,
        tenantId,
      });

      await tx.notification.create({
        data: {
          userId: tenantId,
          type: "APPLICATION_REJECTED",
          message: "Your housing application has been rejected.",
        },
      });

      return tx.application.findUniqueOrThrow({
        where: { id: applicationId },
        select: applicationSelect,
      });
    },
    { timeout: 30_000 },
  );

  await sendMailToUser(
    tenantId,
    "Your housing application has been rejected",
    "Your housing application has been rejected.",
  );

  return rejected;
};
