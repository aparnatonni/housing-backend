import { Role } from "@prisma/client";
import { Router } from "express";
import { authorize, protect } from "../auth/auth.middleware";
import {
  auditLogs,
  dashboardStats,
  payments,
  propertyStatus,
} from "./admin.controller";

const adminRouter = Router();

adminRouter.use(protect, authorize(Role.ADMIN));

adminRouter.get("/dashboard-stats", dashboardStats);
adminRouter.get("/audit-logs", auditLogs);
adminRouter.get("/payments", payments);
adminRouter.patch("/properties/:id/status", propertyStatus);

export default adminRouter;
