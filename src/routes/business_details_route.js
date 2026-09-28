import { Router } from "express";
import {
  createBusinessDetails,
  getBusinessDetails,
  getPaymentQr,
  uploadPaymentQr,
} from "../controllers/business_detail_controller.js";
import { authMiddleware } from "../middlewares/auth_middleware.js";
import { uploadQrImage } from "../middlewares/upload.middleware.js";
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

businessDetailsRouter.get("/paymentQr", authMiddleware, getPaymentQr);

businessDetailsRouter.post(
  "/paymentQr",
  authMiddleware,
  uploadQrImage,
  uploadPaymentQr,
);

export default businessDetailsRouter;
