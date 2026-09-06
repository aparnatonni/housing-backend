import type { Prisma, User } from "@prisma/client";
import bcrypt from "bcryptjs";
import { AppError } from "../../errors";
import prisma from "../../lib/prisma";
import { serializeUser } from "../auth/auth.service";
import type { PublicUser } from "./users.types";
import type {
  ChangePasswordInput,
  UpdateProfileInput,
} from "./users.validation";

const BCRYPT_ROUNDS = 12;

const publicUserSelect = {
  id: true,
  email: true,
  role: true,
  name: true,
  phone: true,
  avatarUrl: true,
  bio: true,
  isVerified: true,
  createdAt: true,
  deletedAt: true,
  roommatePreference: {
    select: {
      minBudget: true,
      maxBudget: true,
      preferredCity: true,
      preferredArea: true,
      genderPreference: true,
      lifestyleTags: true,
      isSmoker: true,
      hasPets: true,
    },
  },
} satisfies Prisma.UserSelect;

export const toPublicUser = (user: User): ReturnType<typeof serializeUser> =>
  serializeUser(user);

const normalize = <T extends Record<string, unknown>>(data: T): T =>
  Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined),
  ) as T;

export const getProfile = (user: User) => serializeUser(user);

export const getPublicProfile = async (userId: string): Promise<PublicUser> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: publicUserSelect,
  });
  if (!user || user.deletedAt !== null) {
    throw new AppError("User not found", 404);
  }
  return user as unknown as PublicUser;
};

export const updateProfile = async (
  userId: string,
  input: UpdateProfileInput,
) => {
  const { roommatePreference, ...rest } = input;
  const userData = normalize(rest);

  const user = await prisma.user.update({
    where: { id: userId },
    data: userData,
    select: { id: true },
  });

  if (roommatePreference) {
    const { moveInDate, ...pref } = roommatePreference;
    const moveIn: Date | null | undefined =
      moveInDate === undefined
        ? undefined
        : moveInDate
          ? new Date(moveInDate)
          : null;

    const createData: Prisma.RoommatePreferenceUncheckedCreateInput = {
      userId,
      ...pref,
      ...(moveIn !== undefined ? { moveInDate: moveIn } : {}),
    };
    const updateData: Prisma.RoommatePreferenceUncheckedUpdateInput = {
      ...pref,
      ...(moveIn !== undefined ? { moveInDate: moveIn } : {}),
    };

    await prisma.roommatePreference.upsert({
      where: { userId },
      create: createData,
      update: updateData,
    });
  }

  const updated = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
  });
  return { user: serializeUser(updated) };
};

export const changePassword = async (
  user: User,
  input: ChangePasswordInput,
): Promise<void> => {
  if (user.passwordHash === null) {
    throw new AppError(
      "Your account uses Google sign-in and has no password set",
      400,
    );
  }

  const matches = await bcrypt.compare(
    input.currentPassword,
    user.passwordHash,
  );
  if (!matches) {
    throw new AppError("Current password is incorrect", 400);
  }
  if (input.currentPassword === input.newPassword) {
    throw new AppError(
      "New password must be different from the current one",
      400,
    );
  }

  const passwordHash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });
};

export const listUsers = async (params: {
  page: number;
  limit: number;
  role?: string;
  search?: string;
}) => {
  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    ...(params.role
      ? { role: params.role as Prisma.UserWhereInput["role"] }
      : {}),
    ...(params.search
      ? {
          OR: [
            { name: { contains: params.search, mode: "insensitive" } },
            { email: { contains: params.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        role: true,
        name: true,
        phone: true,
        avatarUrl: true,
        isVerified: true,
        isSuspended: true,
        provider: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (params.page - 1) * params.limit,
      take: params.limit,
    }),
  ]);

  return {
    items: users,
    meta: {
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
      hasNextPage: params.page < Math.ceil(total / params.limit),
    },
  };
};

export const updateUserStatus = async (
  userId: string,
  isSuspended: boolean,
) => {
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.deletedAt !== null) {
    throw new AppError("User not found", 404);
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { isSuspended },
    select: {
      id: true,
      email: true,
      role: true,
      name: true,
      phone: true,
      avatarUrl: true,
      isVerified: true,
      isSuspended: true,
      provider: true,
      createdAt: true,
    },
  });

  if (isSuspended) {
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  return user;
};
