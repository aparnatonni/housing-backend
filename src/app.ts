import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import config from "./config";
import { errorHandler, notFoundHandler } from "./middlewares";
import authRouter from "./modules/auth/auth.routes";
import healthRouter from "./modules/health/health.routes";
import propertiesRouter from "./modules/properties/properties.routes";
import roomsRouter from "./modules/rooms/rooms.routes";
import adminUsersRouter from "./modules/users/users.admin.routes";
import usersRouter from "./modules/users/users.routes";

const app: Express = express();

app.use(helmet());
app.use(cors({ origin: config.cors.origin }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());

app.use(
  rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: "Too many requests, please try again later.",
      errors: null,
    },
  }),
);

const apiRouter = express.Router();
apiRouter.use(healthRouter);
apiRouter.use(authRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/admin/users", adminUsersRouter);
apiRouter.use("/properties", propertiesRouter);
apiRouter.use("/rooms", roomsRouter);

app.use("/api/v1", apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
