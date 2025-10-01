// middleware/isAdmin.js
import UserModel from "../User/UserModel.js";

const isAdmin = async (req, res, next) => {
  try {
    const user = await UserModel.findById(req.user._id); // req.user authMiddleware થી આવે છે

    if (!user || user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    next();
  } catch (error) {
    console.error("isAdmin middleware error:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export default isAdmin;
