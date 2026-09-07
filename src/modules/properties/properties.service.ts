import type { Prisma, Property } from "@prisma/client";
import { AppError } from "../../errors";
import { invalidatePropertyLists } from "../../lib/cache";
import prisma from "../../lib/prisma";
import type {
  CreatePropertyInput,
  CreateRoomInput,
  ListPropertiesQuery,
  UpdatePropertyInput,
  UpdateRoomInput,
} from "./properties.validation";

const normalize = <T extends Record<string, unknown>>(data: T): T =>
  Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined),
  ) as T;

const roomSelect = {
  id: true,
  propertyId: true,
  roomType: true,
  rentAmount: true,
  isAvailable: true,
  capacity: true,
  images: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.RoomSelect;

const propertySelect = {
  id: true,
  title: true,
  description: true,
  address: true,
  city: true,
  area: true,
  state: true,
  zipCode: true,
  propertyType: true,
  amenities: true,
  images: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  rooms: {
    where: { deletedAt: null },
    select: {
      id: true,
      roomType: true,
      rentAmount: true,
      isAvailable: true,
      capacity: true,
      images: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" } as Prisma.RoomOrderByWithRelationInput,
  },
  owner: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      avatarUrl: true,
      isVerified: true,
    },
  },
} satisfies Prisma.PropertySelect;

const listPropertySelect = {
  id: true,
  title: true,
  address: true,
  city: true,
  area: true,
  state: true,
  zipCode: true,
  propertyType: true,
  amenities: true,
  images: true,
  status: true,
  createdAt: true,
  rooms: {
    where: { deletedAt: null },
    select: { rentAmount: true },
    orderBy: { rentAmount: "asc" } as Prisma.RoomOrderByWithRelationInput,
  },
} satisfies Prisma.PropertySelect;

export const getOwnedProperty = async (
  ownerId: string,
  propertyId: string,
): Promise<Property> => {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
  });
  if (!property || property.deletedAt !== null) {
    throw new AppError("Property not found", 404);
  }
  if (property.ownerId !== ownerId) {
    throw new AppError(
      "You do not have permission to modify this property",
      403,
    );
  }
  return property;
};

const getOwnedRoom = async (ownerId: string, roomId: string) => {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: {
      id: true,
      deletedAt: true,
      property: {
        select: { ownerId: true, deletedAt: true },
      },
    },
  });
  if (!room || room.deletedAt !== null || room.property.deletedAt !== null) {
    throw new AppError("Room not found", 404);
  }
  if (room.property.ownerId !== ownerId) {
    throw new AppError("You do not have permission to modify this room", 403);
  }
  return room;
};

export const createProperty = async (
  ownerId: string,
  input: CreatePropertyInput,
) => {
  const property = await prisma.property.create({
    data: {
      ownerId,
      ...normalize(input),
      images: input.images ?? [],
      amenities: input.amenities ?? [],
      status: input.status ?? "ACTIVE",
    },
    select: propertySelect,
  });
  await invalidatePropertyLists();
  return property;
};

export const getPropertyById = async (
  propertyId: string,
  options?: {
    includeInactive?: boolean;
  },
) => {
  const existing = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true, deletedAt: true, status: true },
  });
  if (!existing || existing.deletedAt !== null) {
    throw new AppError("Property not found", 404);
  }
  if (!options?.includeInactive && existing.status !== "ACTIVE") {
    throw new AppError("Property not found", 404);
  }
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: propertySelect,
  });
  if (!property) {
    throw new AppError("Property not found", 404);
  }
  return property;
};

export const listProperties = async (query: ListPropertiesQuery) => {
  const rentAmount: Record<string, number> = {};
  if (query.minRent !== undefined) rentAmount.gte = query.minRent;
  if (query.maxRent !== undefined) rentAmount.lte = query.maxRent;

  const where: Prisma.PropertyWhereInput = {
    deletedAt: null,
    status: "ACTIVE",
    ...(query.city
      ? { city: { equals: query.city, mode: "insensitive" } }
      : {}),
    ...(query.propertyType ? { propertyType: query.propertyType } : {}),
    ...(query.search
      ? {
          OR: [
            { title: { contains: query.search, mode: "insensitive" } },
            { address: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(Object.keys(rentAmount).length > 0
      ? { rooms: { some: { deletedAt: null, rentAmount } } }
      : {}),
  };

  const isPriceSort =
    query.sortBy === "price_asc" || query.sortBy === "price_desc";

  const [total, properties] = await Promise.all([
    prisma.property.count({ where }),
    prisma.property.findMany({
      where,
      select: listPropertySelect,
      orderBy: { createdAt: query.sortBy === "oldest" ? "asc" : "desc" },
      ...(isPriceSort
        ? {}
        : { skip: (query.page - 1) * query.limit, take: query.limit }),
    }),
  ]);

  const items = properties.map(({ rooms, ...rest }) => ({
    ...rest,
    roomCount: rooms.length,
    minRent: rooms[0]?.rentAmount ?? null,
  }));

  if (isPriceSort) {
    const byRent = (a: (typeof items)[number], b: (typeof items)[number]) =>
      (a.minRent ?? Number.POSITIVE_INFINITY) -
      (b.minRent ?? Number.POSITIVE_INFINITY);
    items.sort(query.sortBy === "price_asc" ? byRent : (a, b) => byRent(b, a));
  }

  const start = isPriceSort ? (query.page - 1) * query.limit : 0;
  const end = isPriceSort
    ? Math.min(start + query.limit, items.length)
    : undefined;

  const pageItems = isPriceSort ? items.slice(start, end) : items;

  return {
    items: pageItems,
    meta: {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
      hasNextPage: query.page < Math.ceil(total / query.limit),
    },
  };
};

export const listMyProperties = async (
  ownerId: string,
  query: { page: number; limit: number; search?: string },
) => {
  const where: Prisma.PropertyWhereInput = {
    ownerId,
    deletedAt: null,
    ...(query.search
      ? {
          OR: [
            { title: { contains: query.search, mode: "insensitive" } },
            { address: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, properties] = await Promise.all([
    prisma.property.count({ where }),
    prisma.property.findMany({
      where,
      select: listPropertySelect,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);

  return {
    items: properties.map(({ rooms, ...rest }) => ({
      ...rest,
      roomCount: rooms.length,
      minRent: rooms[0]?.rentAmount ?? null,
    })),
    meta: {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
      hasNextPage: query.page < Math.ceil(total / query.limit),
    },
  };
};

export const updateProperty = async (
  ownerId: string,
  propertyId: string,
  input: UpdatePropertyInput,
) => {
  await getOwnedProperty(ownerId, propertyId);
  const data = normalize(input) as Prisma.PropertyUncheckedUpdateInput;
  const property = await prisma.property.update({
    where: { id: propertyId },
    data,
    select: propertySelect,
  });
  await invalidatePropertyLists();
  return property;
};

export const softDeleteProperty = async (
  ownerId: string,
  propertyId: string,
): Promise<string> => {
  await getOwnedProperty(ownerId, propertyId);
  await prisma.property.update({
    where: { id: propertyId },
    data: { deletedAt: new Date() },
  });
  await invalidatePropertyLists();
  return propertyId;
};

export const addImagesToProperty = async (
  ownerId: string,
  propertyId: string,
  imageUrls: string[],
) => {
  await getOwnedProperty(ownerId, propertyId);
  const property = await prisma.property.update({
    where: { id: propertyId },
    data: { images: { push: imageUrls } },
    select: propertySelect,
  });
  await invalidatePropertyLists();
  return property;
};

export const createRoom = async (
  ownerId: string,
  propertyId: string,
  input: CreateRoomInput,
) => {
  await getOwnedProperty(ownerId, propertyId);
  const room = await prisma.room.create({
    data: {
      propertyId,
      ...normalize(input),
      images: input.images ?? [],
    },
    select: roomSelect,
  });
  await invalidatePropertyLists();
  return room;
};

export const updateRoom = async (
  ownerId: string,
  roomId: string,
  input: UpdateRoomInput,
) => {
  await getOwnedRoom(ownerId, roomId);
  const room = await prisma.room.update({
    where: { id: roomId },
    data: normalize(input),
    select: roomSelect,
  });
  await invalidatePropertyLists();
  return room;
};

export const softDeleteRoom = async (
  ownerId: string,
  roomId: string,
): Promise<string> => {
  await getOwnedRoom(ownerId, roomId);
  await prisma.room.update({
    where: { id: roomId },
    data: { deletedAt: new Date() },
  });
  await invalidatePropertyLists();
  return roomId;
};
