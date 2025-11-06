import StatusCodes from "../config/errorHandel.js";
import UserModel from "./UserModel.js";
import PremiumModel from "../Premium/PremiumModel.js";
import OrderModel from "../Order/OrderModel.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import  Transporter from "../config/mailer.js"
import dotenv from "dotenv";

dotenv.config();

// In-memory OTP storage (use Redis in production)
const otpStorage = new Map();

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

      // Generate OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Store user data and OTP temporarily
      const tempUserData = {
        name,
        email,
        password,
        phonenumber,
        referralCode,
        otp,
        createdAt: new Date()
      };
      
      otpStorage.set(email, tempUserData);
      
      // Send OTP email
   

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: "KensDrive - Email Verification OTP",
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <img src="https://idr01.zata.ai/kenskensdrive/thumbnails/1759582246304-627777139.png" alt="KensDrive" style="max-width: 200px; height: auto;">
              <h1 style="color: #333; margin: 20px 0 10px 0;">KensDrive</h1>
              <p style="color: #666; margin: 0;">Your Premium Movie Streaming Platform</p>
            </div>
            
            <h2 style="color: #333; text-align: center; margin-bottom: 20px;">Email Verification</h2>
            
            <p style="color: #333; font-size: 16px; line-height: 1.6;">Hello <strong>${name}</strong>,</p>
            
            <p style="color: #333; font-size: 16px; line-height: 1.6;">Welcome to KensDrive! To complete your registration, please use the OTP below:</p>
            
            <div style="background-color: #f0f8ff; border: 2px dashed #007bff; border-radius: 8px; padding: 20px; text-align: center; margin: 25px 0;">
              <h1 style="color: #007bff; font-size: 32px; margin: 0; letter-spacing: 5px;">${otp}</h1>
            </div>
            
            <p style="color: #666; font-size: 14px; text-align: center; margin: 20px 0;">
              <strong>⏰ This OTP will expire in 10 minutes</strong>
            </p>
            
            <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
              <p style="color: #856404; margin: 0; font-size: 14px;">
                <strong>Security Note:</strong> Never share this OTP with anyone. KensDrive will never ask for your OTP via phone or email.
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
              <p style="color: #666; font-size: 14px; margin: 5px 0;">Best regards,</p>
              <p style="color: #333; font-weight: bold; margin: 5px 0;">The KensDrive Team</p>
              <p style="color: #999; font-size: 12px; margin: 15px 0 0 0;">© 2024 KensDrive. All rights reserved.</p>
            </div>
          </div>
        </div>
        `
      };

      await Transporter.sendMail(mailOptions);

      return res.status(200).json({
        message: "OTP sent to your email. Please verify to complete registration.",
        email
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Server error", error: err.message });
    }
  },

  verifyOTP: async (req, res) => {
    try {
      const { email, otp } = req.body;

      if (!email || !otp) {
        return res.status(400).json({ message: "Email and OTP are required" });
      }

      const tempUserData = otpStorage.get(email);
      if (!tempUserData) {
        return res.status(400).json({ message: "OTP expired or invalid email" });
      }

      // Check OTP expiry (10 minutes)
      const otpAge = new Date() - tempUserData.createdAt;
      if (otpAge > 10 * 60 * 1000) {
        otpStorage.delete(email);
        return res.status(400).json({ message: "OTP expired" });
      }

      if (tempUserData.otp !== otp) {
        return res.status(400).json({ message: "Invalid OTP" });
      }

      // Hash password
      const hashed = await bcrypt.hash(tempUserData.password, 10);

      // Create new user
      const newUser = new UserModel({ 
        name: tempUserData.name, 
        email: tempUserData.email, 
        password: hashed, 
        phonenumber: tempUserData.phonenumber 
      });

      // Referral check
      let referrer = null;
      if (tempUserData.referralCode) {
        referrer = await UserModel.findOne({ referralCode: tempUserData.referralCode.toUpperCase() });
        if (referrer) {
          newUser.referredBy = referrer._id;
        }
      }

      await newUser.save();
      otpStorage.delete(email);

      return res.status(201).json({
        message: "User registered successfully",
        user: {
          _id: newUser._id,
          name: newUser.name,
          email: newUser.email,
          phonenumber: newUser.phonenumber,
          referralCode: newUser.referralCode,
          referralLink: newUser.referralLink,
          walletPoints: newUser.walletPoints,
          referredBy: referrer ? { _id: referrer._id, name: referrer.name, email: referrer.email } : null
        }
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Server error", error: err.message });
    }
  }
,

  Login: async (req, res) => {
    try {
      const { emailOrPhone, password, deviceId, deviceInfo } = req.body;

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

      // Device limit check for premium users
      if (user.isPremium && deviceId) {
        const existingDevice = user.activeDevices.find(d => d.deviceId === deviceId);
        
        if (!existingDevice) {
          if (user.activeDevices.length >= user.maxDevices) {
            return res.status(403).send({ 
              message: `Device limit exceeded. Maximum ${user.maxDevices} devices allowed.`,
              activeDevices: user.activeDevices.length,
              maxDevices: user.maxDevices
            });
          }
          
          user.activeDevices.push({
            deviceId,
            deviceInfo: deviceInfo || 'Unknown Device',
            lastActive: new Date()
          });
        } else {
          existingDevice.lastActive = new Date();
        }
        
        await user.save();
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

      // Get user's premium purchase history
      const premiumOrders = await OrderModel.find({ 
        userid: decode._id, 
        paymentStatus: "completed" 
      }).sort({ createdAt: -1 });

      // Calculate total premium spent
      const totalPremiumSpent = premiumOrders.reduce((total, order) => total + order.price, 0);
      const totalSpentInRupees = totalPremiumSpent * 7; // 1 point = ₹7

      // Get premium plans with pricing
      const premiumPlans = await PremiumModel.find({ isActive: true });
      
      // Calculate pricing in rupees (1 point = ₹7)
    

      const userInfo = {
        ...decode,
        isPremium: decode.isPremium,
        walletPoints: decode.walletPoints,
        premiumPurchases: {
          totalOrders: premiumOrders.length,
          totalSpentInPoints: totalPremiumSpent,
          totalSpentInRupees: totalSpentInRupees,
          recentOrders: premiumOrders.slice(0, 5).map(order => ({
            premiumType: order.premiumType,
            price: order.price,
            priceInRupees: order.price * 7,
            purchaseDate: order.createdAt,
            expiresAt: order.expiresAt
          }))
        },
      
      };

      return res.status(200).send({ message: "Success", userInfo });
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
},

  getPremiumPricing: async (req, res) => {
    try {
      const premiumPlans = await PremiumModel.find({ isActive: true });
      
      const pricingInfo = premiumPlans.map(plan => ({
        _id: plan._id,
        name: plan.name,
        priceInPoints: plan.price,
        priceInRupees: plan.price * 7, // 1 point = ₹7
        durationInDays: plan.durationInDays,
        features: plan.features,
        createdAt: plan.createdAt
      }));

      return res.status(200).json({
        message: "Premium pricing retrieved successfully",
        plans: pricingInfo
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Server error", error: error.message });
    }
  },

  removeDevice: async (req, res) => {
    try {
      const { userId, deviceId } = req.body;
      if (!userId || !deviceId) {
        return res.status(400).json({ message: "userId and deviceId required" });
      }

      const user = await UserModel.findById(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      user.activeDevices = user.activeDevices.filter(d => d.deviceId !== deviceId);
      await user.save();

      return res.status(200).json({ 
        message: "Device removed successfully",
        activeDevices: user.activeDevices.length
      });
    } catch (error) {
      return res.status(500).json({ message: "Server error", error: error.message });
    }
  },

  getUserDevices: async (req, res) => {
    try {
      const { userId } = req.params;
      const user = await UserModel.findById(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      return res.status(200).json({
        activeDevices: user.activeDevices,
        maxDevices: user.maxDevices,
        deviceCount: user.activeDevices.length
      });
    } catch (error) {
      return res.status(500).json({ message: "Server error", error: error.message });
    }
  }

}


export default UserController;
