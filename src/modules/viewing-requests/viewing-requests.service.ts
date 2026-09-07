import type { Prisma, ViewingStatus } from "@prisma/client";
import { AppError } from "../../errors";
import prisma from "../../lib/prisma";
import { getBrowsableRoom } from "../rooms/rooms.service";
import type {
  CreateViewingRequestInput,
  ListViewingRequestsQuery,
} from "./viewing-requests.validation";

const viewingRequestSelect = {
  id: true,
  requestedDate: true,
  notes: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  tenant: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      avatarUrl: true,
      isVerified: true,
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
} satisfies Prisma.ViewingRequestSelect;

const allowedTransitions: Record<ViewingStatus, ViewingStatus[]> = {
  PENDING: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["COMPLETED", "CANCELLED"],
  REJECTED: [],
  COMPLETED: [],
  CANCELLED: [],
};

export const createViewingRequest = async (
  tenantId: string,
  input: CreateViewingRequestInput,
) => {
  const room = await getBrowsableRoom(input.roomId);

  const existing = await prisma.viewingRequest.findFirst({
    where: { tenantId, roomId: room.id, status: "PENDING" },
    select: { id: true },
  });
  if (existing) {
    throw new AppError(
      "You already have a pending viewing request for this room",
      409,
    );
  }

  return prisma.viewingRequest.create({
    data: {
      tenantId,
      roomId: room.id,
      requestedDate: new Date(input.requestedDate),
      notes: input.notes,
      status: "PENDING",
    },
    select: viewingRequestSelect,
  });
};

export const listMyRequests = async (
  tenantId: string,
  query: ListViewingRequestsQuery,
) => {
  const where: Prisma.ViewingRequestWhereInput = {
    tenantId,
    ...(query.status ? { status: query.status } : {}),
  };

  const [total, items] = await Promise.all([
    prisma.viewingRequest.count({ where }),
    prisma.viewingRequest.findMany({
      where,
      select: viewingRequestSelect,
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

export const listReceivedRequests = async (
  ownerId: string,
  query: ListViewingRequestsQuery,
) => {
  const where: Prisma.ViewingRequestWhereInput = {
    room: { property: { ownerId, deletedAt: null } },
    ...(query.status ? { status: query.status } : {}),
  };

  const [total, items] = await Promise.all([
    prisma.viewingRequest.count({ where }),
    prisma.viewingRequest.findMany({
      where,
      select: viewingRequestSelect,
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

export const updateViewingStatus = async (
  ownerId: string,
  requestId: string,
  status: Exclude<ViewingStatus, "PENDING">,
) => {
  const request = await prisma.viewingRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      status: true,
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
    request.room.deletedAt !== null ||
    request.room.property.deletedAt !== null
  ) {
    throw new AppError("Viewing request not found", 404);
  }
  if (request.room.property.ownerId !== ownerId) {
    throw new AppError(
      "You do not have permission to update this viewing request",
      403,
    );
  }
  if (!allowedTransitions[request.status].includes(status)) {
    throw new AppError(
      `Cannot change a ${request.status} viewing request to ${status}`,
      409,
    );
  }

  return prisma.viewingRequest.update({
    where: { id: requestId },
    data: { status },
    select: viewingRequestSelect,
  });
};
