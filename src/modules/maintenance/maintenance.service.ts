import type { MaintenanceStatus, Prisma } from "@prisma/client";
import { AppError } from "../../errors";
import { sendMailToUser } from "../../lib/mailer";
import prisma from "../../lib/prisma";
import type {
  CreateMaintenanceRequestInput,
  UpdateMaintenanceStatusInput,
} from "./maintenance.validation";
import { assertValidTransition } from "./status-transitions";

const maintenanceRequestSelect = {
  id: true,
  category: true,
  description: true,
  images: true,
  status: true,
  priority: true,
  tenancyId: true,
  roomId: true,
  tenantId: true,
  resolvedAt: true,
  createdAt: true,
  updatedAt: true,
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
      property: {
        select: {
          id: true,
          title: true,
          address: true,
          city: true,
        },
      },
    },
  },
} satisfies Prisma.MaintenanceRequestSelect;

type MaintenanceRequestWithOwner = {
  id: string;
  status: MaintenanceStatus;
  category: string;
  tenantId: string;
  room: {
    deletedAt: Date | null;
    property: { deletedAt: Date | null; ownerId: string };
  };
};

const loadMaintenanceRequest = async (
  requestId: string,
): Promise<MaintenanceRequestWithOwner> => {
  const request = await prisma.maintenanceRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      status: true,
      category: true,
      tenantId: true,
      room: {
        select: {
          deletedAt: true,
          property: { select: { deletedAt: true, ownerId: true } },
        },
      },
    },
  });
  if (!request) {
    throw new AppError("Maintenance request not found", 404);
  }
  const room = request.room;
  if (
    room === null ||
    room.deletedAt !== null ||
    room.property.deletedAt !== null
  ) {
    throw new AppError("Maintenance request not found", 404);
  }
  return { ...request, room };
};

const createAudit = (
  tx: Prisma.TransactionClient,
  userId: string,
  action: string,
  requestId: string,
  metadata: Prisma.InputJsonValue,
) =>
  tx.auditLog.create({
    data: {
      userId,
      action,
      entityType: "MaintenanceRequest",
      entityId: requestId,
      metadata,
    },
  });

export const createMaintenanceRequest = async (
  tenantId: string,
  input: CreateMaintenanceRequestInput,
) => {
  const tenancy = await prisma.tenancy.findFirst({
    where: { tenantId, roomId: input.roomId, status: "ACTIVE" },
    select: {
      id: true,
      room: {
        select: {
          id: true,
          deletedAt: true,
          property: { select: { deletedAt: true } },
        },
      },
    },
  });
  if (
    !tenancy ||
    tenancy.room.deletedAt !== null ||
    tenancy.room.property.deletedAt !== null
  ) {
    throw new AppError(
      "You must have an active tenancy for this room to create a maintenance request",
      403,
    );
  }

  return prisma.maintenanceRequest.create({
    data: {
      tenantId,
      tenancyId: tenancy.id,
      roomId: tenancy.room.id,
      category: input.category,
      description: input.description,
      priority: input.priority,
      status: "OPEN",
    },
    select: maintenanceRequestSelect,
  });
};

export const listMyMaintenanceRequests = async (tenantId: string) =>
  prisma.maintenanceRequest.findMany({
    where: {
      tenantId,
      room: {
        deletedAt: null,
        property: { deletedAt: null },
      },
    },
    select: maintenanceRequestSelect,
    orderBy: { createdAt: "desc" },
  });

export const listPropertyMaintenanceRequests = async (
  ownerId: string,
  propertyId: string,
) => {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true, ownerId: true, deletedAt: true },
  });
  if (!property || property.deletedAt !== null) {
    throw new AppError("Property not found", 404);
  }
  if (property.ownerId !== ownerId) {
    throw new AppError(
      "You do not have permission to view this property's maintenance requests",
      403,
    );
  }

  return prisma.maintenanceRequest.findMany({
    where: { room: { propertyId, deletedAt: null } },
    select: maintenanceRequestSelect,
    orderBy: { createdAt: "desc" },
  });
};

export const updateMaintenanceStatus = async (
  ownerId: string,
  requestId: string,
  input: UpdateMaintenanceStatusInput,
) => {
  const request = await loadMaintenanceRequest(requestId);
  if (request.room.property.ownerId !== ownerId) {
    throw new AppError(
      "You do not have permission to update this maintenance request",
      403,
    );
  }

  const target = input.status;
  assertValidTransition(request.status, target);

  const updated = await prisma.$transaction(
    async (tx) => {
      const claim = await tx.maintenanceRequest.updateMany({
        where: { id: request.id, status: request.status },
        data: {
          status: target,
          resolvedAt: ["RESOLVED", "CLOSED"].includes(target)
            ? new Date()
            : null,
        },
      });
      if (claim.count === 0) {
        throw new AppError("Maintenance request has already been updated", 409);
      }

      await createAudit(tx, ownerId, "MAINTENANCE_STATUS_CHANGED", request.id, {
        from: request.status,
        to: target,
      });

      await tx.notification.create({
        data: {
          userId: request.tenantId,
          type: "MAINTENANCE_STATUS_CHANGED",
          message: `Your maintenance request (${request.category}) is now ${target}.`,
        },
      });

      return tx.maintenanceRequest.findUniqueOrThrow({
        where: { id: request.id },
        select: maintenanceRequestSelect,
      });
    },
    { timeout: 30_000 },
  );

  await sendMailToUser(
    request.tenantId,
    "Maintenance request status updated",
    `Your maintenance request (${request.category}) is now ${target}.`,
  );

  return updated;
};

export const addImagesToMaintenanceRequest = async (
  userId: string,
  userRole: string,
  requestId: string,
  urls: string[],
) => {
  const request = await prisma.maintenanceRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      tenantId: true,
      images: true,
      room: {
        select: {
          deletedAt: true,
          property: { select: { deletedAt: true, ownerId: true } },
        },
      },
    },
  });
  if (
    !request ||
    request.room === null ||
    request.room.deletedAt !== null ||
    request.room.property.deletedAt !== null
  ) {
    throw new AppError("Maintenance request not found", 404);
  }

  const isTenant = request.tenantId === userId;
  const isOwner = request.room.property.ownerId === userId;
  if (userRole === "ADMIN" || isTenant || isOwner) {
    // allowed
  } else {
    throw new AppError(
      "You do not have permission to add images to this maintenance request",
      403,
    );
  }

  return prisma.maintenanceRequest.update({
    where: { id: request.id },
    data: { images: { push: urls } },
    select: maintenanceRequestSelect,
  });
};
