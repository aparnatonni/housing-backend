import { Router } from "express";
import { authorize, protect } from "../auth/auth.middleware";
import { uploadImages } from "../properties/imageUpload.middleware";
import {
  create,
  myRequests,
  propertyRequests,
  updateStatus,
  uploadIssueImages,
} from "./maintenance.controller";

const maintenanceRouter = Router();

maintenanceRouter.post("/", protect, authorize("TENANT"), create);
maintenanceRouter.get("/my-requests", protect, authorize("TENANT"), myRequests);
maintenanceRouter.get(
  "/property/:propertyId",
  protect,
  authorize("OWNER"),
  propertyRequests,
);
maintenanceRouter.patch(
  "/:id/status",
  protect,
  authorize("OWNER"),
  updateStatus,
);
maintenanceRouter.post(
  "/:id/images",
  protect,
  authorize("TENANT", "OWNER"),
  uploadImages,
  uploadIssueImages,
);

export default maintenanceRouter;
