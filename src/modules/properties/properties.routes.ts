import { Router } from "express";
import { authorize, protect } from "../auth/auth.middleware";
import { uploadImages } from "./imageUpload.middleware";
import {
  addRoom,
  create,
  details,
  list,
  myProperties,
  remove,
  update,
  uploadPropertyImages,
} from "./properties.controller";

const propertiesRouter = Router();

propertiesRouter.get("/", list);
propertiesRouter.get(
  "/my-properties",
  protect,
  authorize("OWNER"),
  myProperties,
);
propertiesRouter.post("/", protect, authorize("OWNER"), create);
propertiesRouter.get("/:id", details);
propertiesRouter.patch("/:id", protect, authorize("OWNER"), update);
propertiesRouter.delete("/:id", protect, authorize("OWNER"), remove);
propertiesRouter.post("/:id/rooms", protect, authorize("OWNER"), addRoom);
propertiesRouter.post(
  "/:id/images",
  protect,
  authorize("OWNER"),
  uploadImages,
  uploadPropertyImages,
);

export default propertiesRouter;
