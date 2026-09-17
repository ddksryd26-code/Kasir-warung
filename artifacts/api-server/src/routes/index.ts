import { Router, type IRouter } from "express";
import healthRouter from "./health";
import warungRouter from "./warung";

const router: IRouter = Router();

router.use(healthRouter);
router.use(warungRouter);

export default router;
