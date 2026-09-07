import { Router } from "express";
import { authorize, protect } from "../auth/auth.middleware";
import {
  cancel,
  fail,
  getById,
  initiate,
  myPayments,
  success,
  webhook,
} from "./payments.controller";

const paymentsRouter = Router();

paymentsRouter.post("/initiate", protect, authorize("TENANT"), initiate);

paymentsRouter.get("/success", success);
paymentsRouter.post("/success", success);
paymentsRouter.get("/fail", fail);
paymentsRouter.post("/fail", fail);
paymentsRouter.get("/cancel", cancel);
paymentsRouter.post("/cancel", cancel);
paymentsRouter.post("/webhook", webhook);

paymentsRouter.get("/my-payments", protect, authorize("TENANT"), myPayments);
paymentsRouter.get("/:id", protect, getById);

export default paymentsRouter;
