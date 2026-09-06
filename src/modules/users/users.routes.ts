import { Router } from "express";
import { protect } from "../auth/auth.middleware";
import { changeOwnPassword, me, updateMe, viewUser } from "./users.controller";

const usersRouter = Router();

usersRouter.get("/me", protect, me);
usersRouter.patch("/me", protect, updateMe);
usersRouter.patch("/change-password", protect, changeOwnPassword);
usersRouter.get("/:id", viewUser);

export default usersRouter;
