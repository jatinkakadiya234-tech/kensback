import StatusCodes from "../config/errorHandel.js";
import UserModel from "./UserModel.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const BONUS_NEW_USER = 2;   // points for new user
const BONUS_REFERRER = 10;  // points for referrer

const UserController = {
register: async (req, res) => {
  try {
    const { name, email, password, phonenumber, referralCode } = req.body;

    // Required fields check
    if (!name || !email || !password || !phonenumber) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Email uniqueness
    const existingEmail = await UserModel.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // Phone uniqueness
    const existingPhone = await UserModel.findOne({ phonenumber });
    if (existingPhone) {
      return res.status(400).json({ message: "Phone number already registered" });
    }

    // Hash password
    const hashed = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = new UserModel({ name, email, password: hashed, phonenumber });

    // Referral check
    let referrer = null;
    if (referralCode) {
      referrer = await UserModel.findOne({ referralCode: referralCode.toUpperCase() });
      if (referrer) {
        newUser.referredBy = referrer._id;
      }
    }

    await newUser.save();

    // Credit points if referral used
    // if (referrer) {
    //   await UserModel.findByIdAndUpdate(referrer._id, {
    //     $inc: { walletPoints: BONUS_REFERRER },
    //     $push: {
    //       walletTransactions: {
    //         type: "credit",
    //         points: BONUS_REFERRER,
    //         reason: `Referral bonus for inviting ${newUser.email}`,
    //       },
    //     },
    //   });

    //   await UserModel.findByIdAndUpdate(newUser._id, {
    //     $inc: { walletPoints: BONUS_NEW_USER },
    //     $push: {
    //       walletTransactions: {
    //         type: "credit",
    //         points: BONUS_NEW_USER,
    //         reason: `Welcome bonus for using referral ${referralCode}`,
    //       },
    //     },
    //   });
    // }

    return res.status(201).json({
      message: "User registered",
      user: {
        _id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        phonenumber: newUser.phonenumber,
        referralCode: newUser.referralCode,
        referralLink: newUser.referralLink,
        walletPoints: newUser.walletPoints,
        referredBy: referrer ? { _id: referrer._id, name: referrer.name, email: referrer.email } : null
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
}
,

  Login: async (req, res) => {
    try {
      const { emailOrPhone, password } = req.body;

      if (!emailOrPhone) {
        return res.status(404).send({ message: "Email or phone number is required" });
      }
      if (!password) {
        return res.status(404).send({ message: "Password is required" });
      }

      let user;
      if (/^\d{10}$/.test(emailOrPhone)) {
        user = await UserModel.findOne({ phonenumber: Number(emailOrPhone) });
      } else {
        user = await UserModel.findOne({ email: emailOrPhone });
      }

      if (!user) {
        return res.status(StatusCodes.UNAUTHORIZED.code).send({ message: StatusCodes.UNAUTHORIZED.message });
      }

      if (!bcrypt.compareSync(password, user.password)) {
        return res.status(401).send({ message: "Invalid Password" });
      }

      let payload = { ...user._doc };
      delete payload.password;

      const token = jwt.sign(payload, process.env.jwt_secrate, { expiresIn: "1d" });
      if (!token) return res.status(500).send({ message: "Something went wrong" });

      return res.status(StatusCodes.SUCCESS.code).send({ message: "Login successful", token });
    } catch (error) {
      console.log(error);
      return res.status(500).send({ message: "Internal server error", error: error.message });
    }
  },

  userinfo: async (req, res) => {
    try {
      const { token } = req.params;
      const decode = await jwt.verify(token, process.env.jwt_secrate);
      if (!decode) return res.status(500).send({ message: "Internal server error" });

      return res.status(200).send({ message: "Success", decode });
    } catch (error) {
      console.log(error);
      return res.status(500).send({ message: "Internal server error", error: error.message });
    }
  },

  userEdit: async (req, res) => {
    try {
      const { id } = req.params;
      const result = await UserModel.findByIdAndUpdate({ _id: id }, { ...req.body });
      if (!result) return res.status(500).send({ message: "Internal server error" });

      return res.status(200).send({ message: "User info updated" });
    } catch (error) {
      console.log(error);
      return res.status(500).send({ message: "Internal server error", error: error.message });
    }
  },

  listUsers: async (req, res) => {
    try {
      const users = await UserModel.find();
      res.status(200).json({ total: users.length });
    } catch (error) {
      console.error("Error listing users:", error);
      res.status(500).json({ message: "Server error" });
    }
  },
  withdrawPoints: async (req, res) => {
  try {
    const { userId, pointsToWithdraw, bankName, accountNumber, ifscCode } = req.body;

    if (!userId || !pointsToWithdraw || !bankName || !accountNumber || !ifscCode) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const user = await UserModel.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.walletPoints < 100) {
      return res.status(400).json({ message: "You need at least 100 points to withdraw" });
    }

    if (pointsToWithdraw > user.walletPoints) {
      return res.status(400).json({ message: "Insufficient points" });
    }

    // Update wallet points (1 point deducted per point withdrawn)
    user.walletPoints -= pointsToWithdraw;

    // Add withdrawal transaction
    user.walletTransactions.push({
      type: "debit",
      points: pointsToWithdraw,
      reason: "Withdrawal request",
      bankName,
      accountNumber,
      ifscCode
    });

    await user.save();

    const amountInRupees = pointsToWithdraw * 7; // 1 point = ₹7

    return res.status(200).json({
      message: `Withdrawal of ${pointsToWithdraw} points (₹${amountInRupees}) successful`,
      walletPoints: user.walletPoints,
      amountInRupees
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
}

}


export default UserController;
