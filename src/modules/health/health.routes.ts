import { Router } from "express";
import { healthController } from "./health.controller";

const healthRouter = Router();

healthRouter.get("/health", healthController);

export default healthRouter;
