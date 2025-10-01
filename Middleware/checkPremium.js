// middleware/checkPremium.js

const checkPremium = async (req, res, next) => {
  try {
    const user = req.user;

    if (
      !user ||
      !user.isPremium ||
      !user.premiumExpiresAt ||
      new Date() > new Date(user.premiumExpiresAt)
    ) {
      return res
        .status(403)
        .json({ message: "Premium expired or not active" });
    }

    next();
  } catch (error) {
    console.error("checkPremium error:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export default checkPremium;
