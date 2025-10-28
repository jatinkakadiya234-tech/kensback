// server.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import db from "./config/DB.js";

import UserRouter from "./User/UserRoutes.js";
import MoviseRouter from "./Movise/MoviseRoutes.js";
import OrderRouter from "./Order/OrderRoutes.js";
import PremiumRouter from "./Premium/PremiumRoutes.js";
import WithdrawalRouter from "./Withdrawal/WithdrawalRouter.js";
import WebSeriesRouter from "./WebSeries/WebSeriesRoutes.js";

dotenv.config();

const app = express();
app.use(express.json());

// CORS options
const corsOptions = {
  origin: "*", 
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  credentials: false, // ✅ keep false with '*'
};

app.use(cors(corsOptions));
app.use(express.urlencoded({ extended: true }));

// Static folder for videos
app.use("/api/videos", express.static("uploads/videos"));

// DB connection
db();

// Routes
app.use("/api/user", UserRouter);
app.use("/api/movise", MoviseRouter);
app.use("/api/order", OrderRouter);
app.use("/api/premium", PremiumRouter);
app.use("/api/withdrawal", WithdrawalRouter);
app.use("/api/webseries", WebSeriesRouter);

const port = process.env.PORT || 7000;
app.listen(port, "0.0.0.0", () => {
  console.log(`Server is running on port ${port}`);
});
