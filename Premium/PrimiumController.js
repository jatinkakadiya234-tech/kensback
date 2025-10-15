import Primium from "./PremiumModel.js";
import StatusCodes from "../config/errorHandel.js";

const Primiums = {
  createPremiumPlan: async (req, res) => {
    try {
      const { name, price, features } = req.body;
      console.log(name);

      const existing = await Primium.findOne({ name });
      if (existing) {
        return res.status(400).json({ message: "Plan with this name already exists." });
      }

      let durationInDays;
      if (name === "monthly") {
        durationInDays = 30;
      } else if (name === "yearly") {
        durationInDays = 365;
      } else if (name === "unlimited") {
        durationInDays = -1;
      }

      const newPlan = new Primium({
        name,
        price,
        durationInDays,
        features,
      });

      await newPlan.save();
      res.status(201).json({
        message: "Premium plan created successfully",
        data: newPlan,
      });
    } catch (error) {
      console.error("Error creating premium plan:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  EditPrimium: async (req, res) => {
    try {
      const updateData = { ...req.body };
      
      if (updateData.name) {
        if (updateData.name === "monthly") {
          updateData.durationInDays = 30;
        } else if (updateData.name === "yearly") {
          updateData.durationInDays = 365;
        } else if (updateData.name === "unlimited") {
          updateData.durationInDays = -1;
        }
      }

      const updatedPlan = await Primium.findByIdAndUpdate(
        { _id: req.params.id },
        updateData,
        { new: true, runValidators: true }
      );

      if (!updatedPlan) {
        return res.status(404).json({ message: "Plan not found" });
      }

      res.json({ message: "Plan updated successfully", plan: updatedPlan });
    } catch (error) {
      console.error("Error updating premium plan:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  getAllPlans: async (req, res) => {
    try {
      const plans = await Primium.find().sort({ price: 1 });
      res.status(200).json({
        message: "Plans fetched successfully",
        data: plans,
      });
    } catch (error) {
      console.error("Error fetching premium plans:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  getPlanById: async (req, res) => {
    try {
      const plan = await Primium.findById(req.params._id);
      if (!plan) {
        return res.status(404).json({ message: "Plan not found" });
      }
      res.status(200).json({
        message: "Plan fetched successfully",
        data: plan,
      });
    } catch (error) {
      console.error("Error fetching premium plan:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  deletePlan: async (req, res) => {
    try {
      const plan = await Primium.findByIdAndDelete(req.params.id);
      if (!plan) {
        return res.status(404).json({ message: "Plan not found" });
      }
      res.status(200).json({ message: "Plan deleted successfully" });
    } catch (error) {
      console.error("Error deleting premium plan:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  togglePlanStatus: async (req, res) => {
    try {
      const plan = await Primium.findById(req.params.id);
      if (!plan) {
        return res.status(404).json({ message: "Plan not found" });
      }

      plan.isActive = !plan.isActive;
      await plan.save();

      res.status(200).json({
        message: `Plan ${plan.isActive ? "activated" : "deactivated"} successfully`,
        data: plan,
      });
    } catch (error) {
      console.error("Error toggling plan status:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  getActivePlans: async (req, res) => {
    try {
      const plans = await Primium.find({ isActive: true }).sort({ price: 1 });
      res.status(200).json({
        message: "Active plans fetched successfully",
        data: plans,
      });
    } catch (error) {
      console.error("Error fetching active plans:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },
};

export default Primiums;
