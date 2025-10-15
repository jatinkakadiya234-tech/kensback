import mongoose from "mongoose";

const PremiumSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    enum: ["monthly",, "unlimited"],
  },
  price: Number,
  durationInDays: {
    type: Number,
    default: 30,
    validate: {
      validator: function(v) {
        return v === -1 || v > 0; // -1 for unlimited, positive for limited
      },
      message: 'Duration must be positive or -1 for unlimited'
    }
  },
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
