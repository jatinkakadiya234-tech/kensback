
import mongoose  from "mongoose";

const WithdrawalSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "user_tables", required: true },
  points: { type: Number, required: true },
  bankName: { type: String, required: true },
  accountNumber: { type: String, required: true },
  ifscCode: { type: String, required: true },
  referenceId: { type: String, index: true, unique: true, sparse: true },
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  requestedAt: { type: Date, default: Date.now },
  processedAt: { type: Date }
});

 const Withdrawal = mongoose.model("tbl_withdrawals", WithdrawalSchema);
export default Withdrawal ;