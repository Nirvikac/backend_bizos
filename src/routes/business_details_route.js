import { Router } from "express";
import {
  createBusinessDetails,
  getBusinessDetails,
} from "../controllers/business_detail_controller.js";
import { authMiddleware } from "../middlewares/auth_middleware.js";
const businessDetailsRouter = Router();

businessDetailsRouter.post(
  "/createBusinessDetails",
  authMiddleware,
  createBusinessDetails,
);

businessDetailsRouter.get(
  "/getBusinessDetails",
  authMiddleware,
  getBusinessDetails,
);

export default businessDetailsRouter;
