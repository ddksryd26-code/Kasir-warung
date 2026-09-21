import { Router, type IRouter } from "express";
import healthRouter from "./health";
import warungRouter from "./warung";
import driveRouter from "./drive";

const router: IRouter = Router();

router.use(healthRouter);
router.use(warungRouter);
router.use(driveRouter);

export default router;
