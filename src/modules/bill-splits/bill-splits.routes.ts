import { Router } from "express";
import { authorize, protect } from "../auth/auth.middleware";
import { byTenancy, create, settle } from "./bill-splits.controller";

const billSplitsRouter = Router();

billSplitsRouter.post("/", protect, authorize("OWNER", "TENANT"), create);
billSplitsRouter.get(
  "/tenancy/:tenancyId",
  protect,
  authorize("OWNER", "TENANT"),
  byTenancy,
);
billSplitsRouter.patch(
  "/:id/settle-share",
  protect,
  authorize("TENANT"),
  settle,
);

export default billSplitsRouter;
