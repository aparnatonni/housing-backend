import { Router } from "express";
import { authorize, protect } from "../auth/auth.middleware";
import { remove, update } from "./rooms.controller";

const roomsRouter = Router();

roomsRouter.use(protect, authorize("OWNER"));

roomsRouter.patch("/:id", update);
roomsRouter.delete("/:id", remove);

export default roomsRouter;
