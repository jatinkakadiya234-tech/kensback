import express from "express";
import upload from "../Middleware/Multer.js";
import MoviesController from "../Movise/MovisController.js";

const MoviseRouter = express.Router();

// Create movie
MoviseRouter.post(
  "/uplode",
  upload.fields([
    { name: "video", maxCount: 2 },
    { name: "image", maxCount: 1 },
  ]),
  MoviesController.createMovie
);

// Get all movies
MoviseRouter.get("/allmovies", MoviesController.getAllMovies);

// Get single movie by ID
MoviseRouter.get("/movies/:id", MoviesController.getMovieById);

// Update movie
MoviseRouter.put(
  "/movies/:id",
  upload.fields([
    { name: "video", maxCount: 4 },
    { name: "image", maxCount: 1 },
  ]),
  MoviesController.updateMovie
);

// Delete movie
MoviseRouter.delete("/delete/:id", MoviesController.deleteMovie);

// Views & stats
MoviseRouter.get("/view", MoviesController.ViewController);
MoviseRouter.get("/totelview", MoviesController.TotalViewers);
MoviseRouter.get("/genre-view-stats", MoviesController.getGenreViewStats);

// Movies by tag
MoviseRouter.get("/movies/by-tag", MoviesController.getMoviesByTag);

// Ratings
MoviseRouter.post("/add-rating", MoviesController.addRating);
MoviseRouter.get("/average-rating/:id", MoviesController.getAverageRating);

// All movies stats
MoviseRouter.get("/movie-stats", MoviesController.getAllMovieStats);

// Get movies by category
MoviseRouter.get("/category", MoviesController.getCategoryByMovies);

export default MoviseRouter;
