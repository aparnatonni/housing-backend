import { Router } from "express";
import { authorize, protect } from "../auth/auth.middleware";
import {
  approve,
  create,
  myApplications,
  reject,
} from "./applications.controller";

const applicationsRouter = Router();

applicationsRouter.get(
  "/my-applications",
  protect,
  authorize("TENANT"),
  myApplications,
);
applicationsRouter.post("/", protect, authorize("TENANT"), create);
applicationsRouter.patch("/:id/approve", protect, authorize("OWNER"), approve);
applicationsRouter.patch("/:id/reject", protect, authorize("OWNER"), reject);

export default applicationsRouter;
