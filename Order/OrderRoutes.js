import express from "express";
import OrderController from "./OrderController.js";
import authMiddleware from "../Middleware/Auth.js";

const OrderRouter = express.Router();

// Create a new order
OrderRouter.post("/create", OrderController.createOrder);

// Upgrade to premium
OrderRouter.post("/upgrade-premium", OrderController.upgradePremium);

// Get total earnings
OrderRouter.get("/total-earnings", OrderController.totelErnings);

// Get monthly premium count
OrderRouter.get("/monthly-premium-count", OrderController.totalMonthPremiumCount);

// Get premium type counts
OrderRouter.get("/premium-type-counts", OrderController.countPremiumTypes);

// Get monthly total price
OrderRouter.get("/monthly-total-price", OrderController.getMonthlyTotalPrice);

// Get revenue summary (total + today)
OrderRouter.get("/revenue", OrderController.getRevenue);

// Get monthly revenue
OrderRouter.get("/monthly-revenue", OrderController.getMonthlyRevenue);

// List all orders
OrderRouter.get("/list", OrderController.listOrders);

export default OrderRouter;
