import { Role } from "@prisma/client";
import { Router } from "express";
import { authorize, protect } from "../auth/auth.middleware";
import { listAllUsers, status } from "./users.admin.controller";

const adminUsersRouter = Router();

adminUsersRouter.use(protect, authorize(Role.ADMIN));

adminUsersRouter.get("/", listAllUsers);
adminUsersRouter.patch("/:id/status", status);

export default adminUsersRouter;
