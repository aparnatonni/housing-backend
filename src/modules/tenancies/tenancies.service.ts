import type { Prisma } from "@prisma/client";
import { AppError } from "../../errors";
import prisma from "../../lib/prisma";
import type { ListTenanciesQuery } from "./tenancies.validation";

const tenancySelect = {
  id: true,
  startDate: true,
  endDate: true,
  rentAmount: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  application: {
    select: {
      id: true,
      note: true,
      moveInDate: true,
    },
  },
  room: {
    select: {
      id: true,
      roomType: true,
      rentAmount: true,
      capacity: true,
      images: true,
      property: {
        select: {
          id: true,
          title: true,
          address: true,
          city: true,
          area: true,
          state: true,
          propertyType: true,
          images: true,
        },
      },
    },
  },
} satisfies Prisma.TenancySelect;

const tenancySelectWithTenant = {
  ...tenancySelect,
  tenant: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      avatarUrl: true,
    },
  },
} satisfies Prisma.TenancySelect;

export const getMyTenancy = async (tenantId: string) => {
  const tenancy = await prisma.tenancy.findFirst({
    where: {
      tenantId,
      status: "ACTIVE",
      room: {
        deletedAt: null,
        property: { deletedAt: null },
      },
    },
    select: tenancySelect,
    orderBy: { createdAt: "desc" },
  });
  if (!tenancy) {
    throw new AppError("No active tenancy found", 404);
  }
  return tenancy;
};

export const listTenanciesByProperty = async (
  ownerId: string,
  propertyId: string,
  query: ListTenanciesQuery,
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
      "You do not have permission to view tenancies for this property",
      403,
    );
  }

  const where: Prisma.TenancyWhereInput = {
    room: {
      propertyId,
      deletedAt: null,
      property: { deletedAt: null },
    },
    ...(query.status ? { status: query.status } : {}),
  };

  const [total, items] = await Promise.all([
    prisma.tenancy.count({ where }),
    prisma.tenancy.findMany({
      where,
      select: tenancySelectWithTenant,
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
