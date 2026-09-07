import type { MaintenanceStatus } from "@prisma/client";
import { AppError } from "../../errors";

export const MAINTENANCE_STATUS_TRANSITIONS: Record<
  MaintenanceStatus,
  MaintenanceStatus[]
> = {
  OPEN: ["IN_PROGRESS"],
  IN_PROGRESS: ["RESOLVED"],
  RESOLVED: ["CLOSED"],
  CLOSED: [],
};

export const canTransitionStatus = (
  from: MaintenanceStatus,
  to: MaintenanceStatus,
): boolean => MAINTENANCE_STATUS_TRANSITIONS[from]?.includes(to) ?? false;

export const assertValidTransition = (
  from: MaintenanceStatus,
  to: MaintenanceStatus,
): void => {
  if (from === to) {
    throw new AppError(`Maintenance request is already ${from}`, 409);
  }
  if (!canTransitionStatus(from, to)) {
    throw new AppError(`Invalid status transition from ${from} to ${to}`, 400);
  }
};
