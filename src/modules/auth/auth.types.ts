import type { Role } from "@prisma/client";

export type AuthUser = {
  id: string;
  email: string;
  role: Role;
  name: string;
  phone: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
  isSuspended: boolean;
  provider: "LOCAL" | "GOOGLE";
};
