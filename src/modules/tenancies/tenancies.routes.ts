import { Router } from "express";
import { authorize, protect } from "../auth/auth.middleware";
import { byProperty, myTenancy } from "./tenancies.controller";

const tenanciesRouter = Router();

tenanciesRouter.get("/my-tenancy", protect, authorize("TENANT"), myTenancy);
tenanciesRouter.get("/:propertyId", protect, authorize("OWNER"), byProperty);

export default tenanciesRouter;
