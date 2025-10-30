import Razorpay from "razorpay";
import dotenv from "dotenv";
import StatusCodes from "../config/errorHandel.js";
import OrderModel from "./OrderModel.js";
import UserModel from "../User/UserModel.js";

dotenv.config();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const OrderController = {
  createOrder: async (req, res) => {
    try {
      const { userid, premiumType, price, days } = req.body;
      if (!userid || !premiumType || !price)
        return res.status(404).send({ message: StatusCodes.BAD_REQUEST.message });

      const now = new Date();
      const expireDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      const result = await OrderModel.create({ ...req.body, expiresAt: expireDate });

      if (!result) {
        return res.status(StatusCodes.SERVER_ERROR.code).send({
          message: StatusCodes.SERVER_ERROR.message,
        });
      }

      const options = {
        amount: price * 100, // paise માં
        currency: "INR",
        receipt: result._id || `receipt_${Date.now()}`,
        payment_capture: 1,
      };

      const order = await razorpay.orders.create(options);
      const data = {
        ...result.toObject(),
        razorpayDetails: { ...order, api_key: "rzp_test_zGCQXPmnJfWXkO" },
      };

      return res.status(StatusCodes.SUCCESS.code).send({
        message: StatusCodes.SUCCESS.message,
        data,
      });
    } catch (error) {
      console.error(error);
      res.status(500).send({ message: "Server error" });
    }
  },

  upgradePremium: async (req, res) => {
    try {
      const { type, orderId, razorpay_order_id, razorpay_payment_id, user } = req.body;

      if (!orderId || !razorpay_payment_id || !user || !user._id) {
        return res.status(400).send({ message: "Missing required fields" });
      }

      const payment = await razorpay.payments.fetch(razorpay_payment_id);
      if (!payment || payment.status !== "captured") {
        await OrderModel.findByIdAndDelete({ _id: orderId });
        return res.status(400).send({ message: "Payment not successful" });
      }

      if (payment.status === "pending") {
        await OrderModel.findByIdAndDelete({ _id: orderId });
        return res.status(400).send({ message: "Payment is pending, order deleted" });
      }

      const orderDoc = await OrderModel.findById(orderId);
      if (!orderDoc) return res.status(404).send({ message: "Order not found" });

      await OrderModel.findByIdAndUpdate(orderId, {
        paymentStatus: "completed",
        razorpay_payment_id,
        razorpay_order_id,
      });

      await UserModel.findByIdAndUpdate(user._id, {
        isPremium: true,
        premiumType: type,
      });

      // Find referring user and add 10 points
      const currentUser = await UserModel.findById(user._id);
      if (currentUser?.referredBy) {
        await UserModel.findByIdAndUpdate(currentUser.referredBy, {
          $inc: { walletPoints: 10 }
        });
        
        // Create history entry
        await UserModel.findByIdAndUpdate(currentUser.referredBy, {
          $push: {
            pointsHistory: {
              points: 10,
              type: "referral_reward",
              description: "Referral payment reward - 10 points earned",
              createdAt: new Date()
            }
          }
        });
      }

      return res.status(200).send({
        message: "Premium upgraded successfully",
        paymentStatus: "success",
        orderId,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).send({ message: "Server error" });
    }
  },

  totelErnings: async (req, res) => {
    try {
      await OrderModel.deleteMany({ paymentStatus: "pending" });
      const result = await OrderModel.find({ paymentStatus: "completed" });
      const TotalPrice = result.reduce((sum, order) => sum + (order.price || 0), 0);
      res.status(200).send(TotalPrice.toString());
    } catch (error) {
      console.error("Error calculating total earnings:", error);
      res.status(500).send("0");
    }
  },

  totalMonthPremiumCount: async (req, res) => {
    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    try {
      const result = await OrderModel.aggregate([
        { $match: { paymentStatus: "completed" } },
        { $group: { _id: { $month: "$createdAt" }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]);

      const viewData = Array.from({ length: 12 }, (_, index) => {
        const month = index + 1;
        const found = result.find(item => item._id === month);
        return { name: monthNames[index], premiumCount: found ? found.count : 0 };
      });

      res.status(200).json(viewData);
    } catch (error) {
      console.error("Error fetching monthly premium counts:", error);
      res.status(500).json({ message: "Server error" });
    }
  },

  countPremiumTypes: async (req, res) => {
    try {
      const result = await OrderModel.aggregate([
        { $match: { premiumType: { $in: ["monthly","yearly"] } } },
        { $group: { _id: "$premiumType", count: { $sum: 1 } } },
      ]);

      const monthly = result.find(r => r._id === "monthly")?.count || 0;
      const yearly = result.find(r => r._id === "yearly")?.count || 0;

      res.status(200).json([{ type: "Monthly", count: monthly }, { type: "Yearly", count: yearly }]);
    } catch (error) {
      console.error("Error in countPremiumTypes:", error);
      res.status(500).json({ message: "Server Error" });
    }
  },

  getMonthlyTotalPrice: async (req, res) => {
    try {
      const result = await OrderModel.aggregate([
        { $match: { createdAt: { $exists: true } } },
        { $group: { _id: { $month: "$createdAt" }, totalPrice: { $sum: "$price" } } },
        { $sort: { _id: 1 } },
      ]);

      const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      const monthlyData = Array.from({ length: 12 }, (_, i) => {
        const monthEntry = result.find(item => item._id === i + 1);
        return { name: monthNames[i], premium: monthEntry ? monthEntry.totalPrice : 0 };
      });

      res.status(200).json(monthlyData);
    } catch (error) {
      console.error("Error in getMonthlyTotalPrice:", error);
      res.status(500).json({ message: "Server error" });
    }
  },

  getRevenue: async (req, res) => {
    try {
      const completed = await OrderModel.find({ paymentStatus: "completed" });
      const totalRevenue = completed.reduce((sum, o) => sum + (o.price || 0), 0);
      const totalOrders = completed.length;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const todayOrders = completed.filter(o => o.createdAt && o.createdAt >= today && o.createdAt < tomorrow);
      const todayRevenue = todayOrders.reduce((sum, o) => sum + (o.price || 0), 0);

      return res.status(200).json({ totalRevenue, totalOrders, todayRevenue });
    } catch (error) {
      console.error("Error in getRevenue:", error);
      return res.status(500).json({ message: "Server error" });
    }
  },

  getMonthlyRevenue: async (req, res) => {
    try {
      const result = await OrderModel.aggregate([
        { $match: { paymentStatus: "completed" } },
        { $group: { _id: { $month: "$createdAt" }, revenue: { $sum: "$price" } } },
        { $sort: { _id: 1 } },
      ]);

      const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      const data = Array.from({ length: 12 }, (_, i) => {
        const monthEntry = result.find(item => item._id === i + 1);
        return { name: monthNames[i], revenue: monthEntry ? monthEntry.revenue : 0 };
      });

      return res.status(200).json(data);
    } catch (error) {
      console.error("Error in getMonthlyRevenue:", error);
      return res.status(500).json({ message: "Server error" });
    }
  },

  listOrders: async (req, res) => {
    try {
      const orders = await OrderModel.find().sort({ createdAt: -1 }).populate("userid");
      res.status(200).json(orders);
    } catch (error) {
      console.error("Error listing orders:", error);
      res.status(500).json({ message: "Server error" });
    }
  },
};

export default OrderController;
