import type { Prisma } from "@prisma/client";
import { AppError } from "../../errors";
import prisma from "../../lib/prisma";

const browsableRoomSelect = {
  id: true,
  roomType: true,
  rentAmount: true,
  isAvailable: true,
  capacity: true,
  images: true,
  deletedAt: true,
  property: {
    select: {
      id: true,
      title: true,
      address: true,
      city: true,
      propertyType: true,
      images: true,
      status: true,
      deletedAt: true,
      ownerId: true,
    },
  },
} satisfies Prisma.RoomSelect;

export type BrowsableRoom = Prisma.RoomGetPayload<{
  select: typeof browsableRoomSelect;
}>;

export const getBrowsableRoom = async (
  roomId: string,
): Promise<BrowsableRoom> => {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: browsableRoomSelect,
  });
  if (
    !room ||
    room.deletedAt !== null ||
    room.property.deletedAt !== null ||
    room.property.status !== "ACTIVE"
  ) {
    throw new AppError("Room not found", 404);
  }
  return room;
};
