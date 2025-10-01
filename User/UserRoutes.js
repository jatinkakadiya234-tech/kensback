// routes/UserRouter.js
import express from "express";
import UserController from "./UserController.js";
import authMiddleware from "../Middleware/Auth.js";

const UserRouter = express.Router();

UserRouter.post("/register", UserController.register);
UserRouter.post("/login", UserController.Login);
UserRouter.get("/userinfo/:token", UserController.userinfo);
UserRouter.put("/edit/:id", UserController.userEdit);
UserRouter.get("/list", UserController.listUsers);
UserRouter.post("/withdraw", UserController.withdrawPoints);
// UserRouter.post("/upgrade", authMiddleware, UserController.upgradePremium);

export default UserRouter;
