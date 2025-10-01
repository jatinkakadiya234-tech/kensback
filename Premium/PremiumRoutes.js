import express from "express";
import PremiumController from "./PrimiumController.js";
import authMiddleware from "../Middleware/Auth.js";

const PremiumRouter = express.Router();

// Create a new premium plan (admin only)
PremiumRouter.post("/create", PremiumController.createPremiumPlan);

// Edit an existing premium plan (admin only)
PremiumRouter.put("/edit/:id", PremiumController.EditPrimium);

// Get all premium plans
PremiumRouter.get("/all", PremiumController.getAllPlans);

// Get all active premium plans
PremiumRouter.get("/active", PremiumController.getActivePlans);

// Get a specific premium plan
PremiumRouter.get("/:id", PremiumController.getPlanById);

// Delete a premium plan (admin only)
PremiumRouter.delete("/delete/:id", PremiumController.deletePlan);

// Toggle plan active status (admin only)
PremiumRouter.patch("/toggle/:id", PremiumController.togglePlanStatus);

export default PremiumRouter;
