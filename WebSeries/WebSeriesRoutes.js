import { Router } from "express";
import upload from "../Middleware/Multer.js";
import WebSeriesController from "./WebSeriesController.js";

const router = Router();

// List and create series
router.get("/", WebSeriesController.listSeries);
router.post("/", WebSeriesController.createSeries);

// Get single series
router.get("/:id", WebSeriesController.getSeries);

// Add season
router.post("/:id/seasons",WebSeriesController.addSeason);

// Add episode to a season
router.post("/:id/seasons/:seasonNumber/episodes", upload.fields([
    { name: "video", maxCount: 2 },
  ]), WebSeriesController.addEpisode);

router.delete("/series/:id", WebSeriesController.deleteSeries);

// Delete a season
router.delete("/series/:id/season/:seasonNumber", WebSeriesController.deleteSeason);

// Delete an episode
router.delete("/series/:id/season/:seasonNumber/episode/:episodeNumber", WebSeriesController.deleteEpisode);


export default router;


