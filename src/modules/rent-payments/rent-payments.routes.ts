import { Router } from "express";
import { authorize, protect } from "../auth/auth.middleware";
import { generate, list, markPaid } from "./rent-payments.controller";

const rentPaymentsRouter = Router();

rentPaymentsRouter.get(
  "/tenancies/:tenancyId/rent-payments",
  protect,
  authorize("TENANT", "OWNER"),
  list,
);
rentPaymentsRouter.post(
  "/tenancies/:tenancyId/rent-payments/generate",
  protect,
  authorize("OWNER"),
  generate,
);

rentPaymentsRouter.post("/rent-payments/:id/mark-paid", protect, markPaid);

export default rentPaymentsRouter;
