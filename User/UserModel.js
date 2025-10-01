// models/User.js
import mongoose from "mongoose";
import crypto from "crypto";

const WalletTransactionSchema = new mongoose.Schema({
  type: { type: String, enum: ["credit", "debit"], required: true },
  points: { type: Number, required: true },
  reason: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isPremium: { type: Boolean, default: false },
  phonenumber: {
    type: Number,
    required: true,
    unique:true,
    validate: {
      validator: v => /^\d{10}$/.test(v),
      message: props => `${props.value} is not a valid number!`
    }
  },

  userimage: {
    type: String,
    default:
      "https://img.freepik.com/premium-vector/vector-flat-illustration-grayscale-avatar-user-profile-person-icon-gender-neutral-silhouette-profile-picture-suitable-social-media-profiles-icons-screensavers-as-templatex9xa_719432-2210.jpg"
  },

  role: { type: String, enum: ["user", "admin"], default: "user" },

  // Wallet
  walletPoints: { type: Number, default: 0 },
  walletTransactions: { type: [WalletTransactionSchema], default: [] },

  // Referral system
  referralCode: { type: String, unique: true, index: true },
  referralLink: { type: String, unique: true },
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: "user_tables", default: null },

  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

// 🔹 Auto-generate unique referral code + referral link
UserSchema.pre("save", async function (next) {
  if (!this.referralCode) {
    let code;
    let exists = true;
    let tries = 0;

    while (exists && tries < 5) {
      code = crypto.randomBytes(3).toString("hex").toUpperCase(); // 6-char code
      exists = await mongoose.models.user_tables.findOne({ referralCode: code });
      tries++;
    }

    if (exists) {
      code = "R" + Date.now().toString(36).toUpperCase();
    }

    this.referralCode = code;
    this.referralLink = `http://localhost:5173/register?ref=${code}`;
  }
  next();
});

const UserModel = mongoose.model("user_tables", UserSchema);
export default UserModel;
