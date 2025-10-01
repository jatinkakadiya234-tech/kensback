

import UserModel from "../User/UserModel.js";
import Withdrawal from "./WithdrawalSchema.js";


const WithdrawalController = {
  createWithdrawalRequest: async (req, res) => {
  try {
    const { userId, points, bankName, accountNumber, ifscCode, referenceId } = req.body;

    if (!userId || !points || !bankName || !accountNumber || !ifscCode)
      return res.status(400).json({ message: "Missing required fields" });

    const user = await UserModel.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.walletPoints < 150 || points > user.walletPoints || points < 150)
      return res.status(400).json({ message: "Insufficient points or minimum 150 required" });

    // Ensure unique reference if provided
    let ref = referenceId;
    if (ref) {
      const exists = await Withdrawal.findOne({ referenceId: ref });
      if (exists) {
        return res.status(409).json({ message: "Duplicate referenceId" });
      }
    }

    // Create withdrawal request
    const request = new Withdrawal({ userId, points, bankName, accountNumber, ifscCode, referenceId: ref });
    await request.save();

    // Update user's wallet points and add transaction entry
    user.walletPoints -= points;
    user.walletTransactions.push({
      type: "debit",
      points,
      reason: `Withdrawal request for ${points} points`,
    });
    await user.save();

    res.status(201).json({ message: "Withdrawal request created", data: request });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
},


  getAllRequests: async (req, res) => {
    try {
      const requests = await Withdrawal.find()
        .populate("userId", "name email phonenumber walletPoints")
        .sort({ requestedAt: -1 });

      res.status(200).json({ data: requests });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  },

updateWithdrawalStatus: async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'approved' અથવા 'rejected'

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const request = await Withdrawal.findById(id);
    if (!request) return res.status(404).json({ message: "Request not found" });
    if (request.status !== "pending") return res.status(400).json({ message: "Request already processed" });

    const user = await UserModel.findById(request.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (status === "approved") {
      // Wallet points already deducted during request creation
      user.walletTransactions.push({
        type: "debit",
        points: request.points,
        reason: "Withdrawal approved",
      });
    } else if (status === "rejected") {
      // Reject -> points પાછા આપો
      user.walletPoints += request.points;
      user.walletTransactions.push({
        type: "credit",
        points: request.points,
        reason: "Withdrawal rejected - points refunded",
      });
    }

    await user.save();

    request.status = status;
    request.processedAt = new Date();
    await request.save();

    res.status(200).json({ message: `Request ${status}`, data: request });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
}

,

  deleteRequest: async (req, res) => {
  try {
    const { id } = req.params;
    const request = await Withdrawal.findById(id);
    if (!request) return res.status(404).json({ message: "Request not found" });

    const user = await UserModel.findById(request.userId);
    if (user && request.status === "pending") {
      user.walletPoints += request.points;
      user.walletTransactions.push({
        type: "credit",
        points: request.points,
        reason: "Withdrawal deleted - points refunded",
      });
      await user.save();
    }

    await Withdrawal.findByIdAndDelete(id);
    return res.status(200).json({ message: "Withdrawal request deleted" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
}
};

export default WithdrawalController
