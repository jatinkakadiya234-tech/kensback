import { Router } from "express";
import upload, { chunkUpload } from "../Middleware/Multer.js";
import WebSeriesController from "./WebSeriesController.js";

const router = Router();

// List and create series
router.get("/", WebSeriesController.listSeries);
router.post("/", WebSeriesController.createSeries);

// Get single series
router.get("/:id", WebSeriesController.getSeries);
// List episodes in a season
router.get("/:id/seasons/:seasonNumber/episodes", WebSeriesController.listEpisodes);
// Get single episode
router.get("/:id/seasons/:seasonNumber/episodes/:episodeNumber", WebSeriesController.getEpisode);

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

// Chunked upload endpoints for webseries
router.post("/upload/initialize", WebSeriesController.initializeChunkedUpload);
router.post("/upload/chunk", chunkUpload.single('chunk'), WebSeriesController.uploadChunk);
router.get("/upload/progress/:uploadId", WebSeriesController.getUploadProgress);

// Add episode using chunked upload ids
router.post(":id/seasons/:seasonNumber/episodes/chunks", upload.none(), WebSeriesController.addEpisodeWithChunks);
// Update existing episode using chunks
router.post(":id/seasons/:seasonNumber/episodes/:episodeNumber/update-chunks", upload.none(), WebSeriesController.updateEpisodeWithChunks);

export default router;


