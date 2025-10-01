import mongoose from "mongoose";

const OrderSchema = new mongoose.Schema({
  userid: {
    type: mongoose.Types.ObjectId,
    ref: "user_tables",
    required: true
  },

  premiumType: {
    type: String,
    enum: ["monthly", "yearly"],
    default: "monthly"
  },

  price: {
    type: Number,
    required: true
  },

  paymentStatus: {
    type: String,
    enum: ["pending", "completed", "failed"],
    default: "pending"
  },

  url: {
    type: String
  },

  paymentId: {
    type: String
  },

  createdAt: {
    type: Date,
    default: Date.now
  },

  expiresAt: {
    type: Date
  }
});

const OrderModel = mongoose.model("tbl_order", OrderSchema);

export default OrderModel;
