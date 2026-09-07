import { Router } from "express";
import { authorize, protect } from "../auth/auth.middleware";
import {
  create,
  myRequests,
  received,
  updateStatus,
} from "./viewing-requests.controller";

const viewingRequestsRouter = Router();

viewingRequestsRouter.get(
  "/my-requests",
  protect,
  authorize("TENANT"),
  myRequests,
);
viewingRequestsRouter.get("/received", protect, authorize("OWNER"), received);
viewingRequestsRouter.post("/", protect, authorize("TENANT"), create);
viewingRequestsRouter.patch(
  "/:id/status",
  protect,
  authorize("OWNER"),
  updateStatus,
);

export default viewingRequestsRouter;
