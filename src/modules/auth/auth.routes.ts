import { Router } from "express";
import {
  google,
  login,
  logout,
  me,
  refresh,
  register,
} from "./auth.controller";
import { protect } from "./auth.middleware";

const authRouter = Router();

authRouter.post("/auth/register", register);
authRouter.post("/auth/login", login);
authRouter.post("/auth/refresh-token", refresh);
authRouter.post("/auth/logout", logout);
authRouter.post("/auth/google", google);
authRouter.get("/auth/me", protect, me);

export default authRouter;
