import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import adminsRouter from "./admins.js";
import eventsRouter from "./events.js";
import ushersRouter from "./ushers.js";
import balanceRouter from "./balance.js";
import myAssignmentsRouter from "./my-assignments.js";
import notificationsRouter from "./notifications.js";
import ratingsRouter from "./ratings.js";
import pushTokensRouter from "./push-tokens.js";
import remindersRouter from "./reminders.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(adminsRouter);
router.use(eventsRouter);
router.use(ushersRouter);
router.use(balanceRouter);
router.use(myAssignmentsRouter);
router.use(notificationsRouter);
router.use(ratingsRouter);
router.use(pushTokensRouter);
router.use(remindersRouter);

export default router;
