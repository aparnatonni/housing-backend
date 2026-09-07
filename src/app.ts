import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import config from "./config";
import { errorHandler, notFoundHandler } from "./middlewares";
import adminRouter from "./modules/admin/admin.routes";
import applicationsRouter from "./modules/applications/applications.routes";
import authRouter from "./modules/auth/auth.routes";
import billSplitsRouter from "./modules/bill-splits/bill-splits.routes";
import healthRouter from "./modules/health/health.routes";
import maintenanceRouter from "./modules/maintenance/maintenance.routes";
import paymentsRouter from "./modules/payments/payments.routes";
import propertiesRouter from "./modules/properties/properties.routes";
import rentPaymentsRouter from "./modules/rent-payments/rent-payments.routes";
import roomsRouter from "./modules/rooms/rooms.routes";
import tenanciesRouter from "./modules/tenancies/tenancies.routes";
import adminUsersRouter from "./modules/users/users.admin.routes";
import usersRouter from "./modules/users/users.routes";
import viewingRequestsRouter from "./modules/viewing-requests/viewing-requests.routes";

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
apiRouter.use("/admin", adminRouter);
apiRouter.use("/properties", propertiesRouter);
apiRouter.use("/rooms", roomsRouter);
apiRouter.use("/viewing-requests", viewingRequestsRouter);
apiRouter.use("/applications", applicationsRouter);
apiRouter.use("/tenancies", tenanciesRouter);
apiRouter.use("/bill-splits", billSplitsRouter);
apiRouter.use("/maintenance-requests", maintenanceRouter);
apiRouter.use("/payments", paymentsRouter);
apiRouter.use(rentPaymentsRouter);

app.use("/api/v1", apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
