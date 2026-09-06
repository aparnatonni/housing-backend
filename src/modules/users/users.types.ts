export type PublicUser = {
  id: string;
  name: string;
  email: string;
  role: "TENANT" | "OWNER" | "ADMIN";
  phone: string | null;
  avatarUrl: string | null;
  bio: string | null;
  isVerified: boolean;
  createdAt: Date;
  deletedAt?: Date | null;
  roommatePreference?: {
    minBudget: number | null;
    maxBudget: number | null;
    preferredCity: string | null;
    preferredArea: string | null;
    genderPreference: "MALE" | "FEMALE" | "ANY";
    lifestyleTags: string[];
    isSmoker: boolean | null;
    hasPets: boolean | null;
  } | null;
};
