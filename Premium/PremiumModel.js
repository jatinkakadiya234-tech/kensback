import mongoose from "mongoose";

const PremiumSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    enum: ["monthly", "yearly"],
  },
  price: Number,
  durationInDays: Number,
  features: {
    fullMovieAccess: Boolean,
    adFree: Boolean,
    hdStreaming: Boolean,
    earlyAccess: Boolean,
    downloadsAllowed: Boolean,
    maxDevices: Number,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const PremiumModel = mongoose.model("Premium", PremiumSchema);

export default PremiumModel;
