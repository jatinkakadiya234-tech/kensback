// WithdrawalRouter.js
import express from "express";
import WithdrawalController from "./WithdrawalController.js";



const WithdrawalRouter = express.Router();

// User withdrawal request
WithdrawalRouter.post("/request", WithdrawalController.createWithdrawalRequest);

// Admin: Get all withdrawal requests
WithdrawalRouter.get("/all", WithdrawalController.getAllRequests);

// Admin: Update withdrawal status (approve/deny)
WithdrawalRouter.patch("/update/:id", WithdrawalController.updateWithdrawalStatus);

// Admin: Delete withdrawal request
WithdrawalRouter.delete("/delete/:id", WithdrawalController.deleteRequest);

export default WithdrawalRouter
