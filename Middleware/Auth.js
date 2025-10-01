// middleware/authMiddleware.js
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import UserModel from "../User/UserModel.js";

dotenv.config();

const authMiddleware = async (req, res, next) => {
  const { token } = req.body;

  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRATE); // ✅ env variable uppercase + spelling fix
    const user = await UserModel.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error("Auth error:", err.message);
    res.status(401).json({ message: "Invalid token" });
  }
};

export default authMiddleware;
