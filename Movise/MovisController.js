// controllers/MoviesController.js
import StatusCodes from "../config/errorHandel.js";
import MoviseModel from "./MoviseModel.js";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import AWS from "aws-sdk";

ffmpeg.setFfprobePath(ffprobeInstaller.path);

const s3 = new AWS.S3({
  endpoint: "https://idr01.zata.ai", // Confirm actual endpoint
  accessKeyId: "XZS8480JOSLIQ4MNN8ZW", // From Zata.ai Access Keys
  secretAccessKey: "WBMjXPrD2aDXBbfvcktxdA7W8LWG1j7paAeT89aQ",
  region: "idr01",
  s3ForcePathStyle: true,
  
});

async function zataUpload(filePath, folder, quality = "") {
  const fileStream = fs.createReadStream(filePath); // ✅ stream read
  const fileName = `${folder}/${quality ? quality + "/" : ""}${Date.now()}-${Math.round(
    Math.random() * 1e9
  )}${filePath.substring(filePath.lastIndexOf("."))}`;

  const params = {
    Bucket: "kenskensdrive",
    Key: fileName,
    Body: fileStream, // ✅ stream instead of full buffer
    ACL: "public-read",
  };

  // Important for large files:
  return new Promise((resolve, reject) => {
    s3.upload(params)
      .on("httpUploadProgress", (progress) => {
        console.log(
          `Uploading ${fileName}: ${(progress.loaded / progress.total * 100).toFixed(2)}%`
        );
      })
      .send((err, data) => {
        if (err) return reject(err);
        resolve(data.Location);
      });
  });
}

const MoviesController = {
  // ✅ Create Movie
  createMovie: async (req, res) => {
    try {
      const { image, video } = req.files;
      const { name, isPremium } = req.body;

      if (!name || isPremium === undefined) {
        return res.status(400).json({ message: "All fields are required" });
      }

      // Upload videos
      const [movie1Url, movie2Url] = await Promise.all([
        zataUpload(video[0].path, "movies", "720p"),
        zataUpload(video[1].path, "movies", "1080p"),
      ]);
      // Upload thumbnail
      const [thumbnailUrl] = await Promise.all([zataUpload(image[0].path, "thumbnails")]);

      // Save movie
      const movie = await MoviseModel.create({
        name,
        isPremium,
        qualities: {
          "720p": "https://"+movie1Url,
          "1080p": "https://"+movie2Url,
        },
        thumbnail: thumbnailUrl,
      });

      // Cleanup tmp files
      const allFiles = [...video, ...image];
      allFiles.forEach((file) => {
        try {
          fs.unlinkSync(file.path);
        } catch (cleanupErr) {
          console.error("Error cleaning up file:", cleanupErr);
        }
      });

      res.status(201).json({
        success: true,
        message: "Movie created successfully using Zata.ai storage",
        data: movie,
      });
    } catch (error) {
      console.error("Error creating movie:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create movie",
        error: error.message,
      });
    }
  },

  // ✅ Get All Movies
  getAllMovies: async (req, res) => {
    try {
      const { page = 1, limit = 10, category, search } = req.query;
      const query = {};

      if (category) query.category = category;
      if (search) query.name = { $regex: search, $options: "i" };

      const movies = await MoviseModel.find(query)
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 });

      const total = await MoviseModel.countDocuments(query);

      return res.status(StatusCodes.SUCCESS.code).send({
        message: "Movies fetched successfully",
        data: {
          movies,
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Get Movies Error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to fetch movies",
        error: error.message,
      });
    }
  },

  // ✅ Get Movie By ID
  getMovieById: async (req, res) => {
    try {
      const { id } = req.params;
      if (!id) return res.status(404).send({ message: "Missing dependency" });

      const movie = await MoviseModel.findById(id);
      if (!movie) {
        return res.status(StatusCodes.NOT_FOUND.code).send({
          message: "Movie not found",
        });
      }

      return res.status(StatusCodes.SUCCESS.code).send({
        message: "Movie fetched successfully",
        data: movie,
      });
    } catch (error) {
      console.error("Get Movie Error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to fetch movie",
        error: error.message,
      });
    }
  },

  // ✅ Update Movie
  updateMovie: async (req, res) => {
    try {
      const updates = {};
      const { name, category, description, tags, language, releaseDate, isPremium } = req.body;

      if (name) updates.name = name;
      if (category) updates.category = category;
      if (description) updates.description = description;
      if (tags) updates.tags = tags;
      if (language) updates.language = language;
      if (releaseDate) updates.releaseDate = releaseDate;
      if (isPremium !== undefined) updates.isPremium = isPremium;

      if (req.files) {
        if (req.files.video) {
          const video = req.files.video;
          updates.qualities = {
            "480p": video[0]?.path,
            "720p": video[1]?.path,
            "1080p": video[3]?.path,
          };
          updates.streamingUrl = video[3]?.path;
        }

        if (req.files.image) {
          updates.thumbnail = req.files.image[0]?.path;
        }
      }

      const movie = await MoviseModel.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true, runValidators: true });

      if (!movie) {
        return res.status(StatusCodes.NOT_FOUND.code).send({ message: "Movie not found" });
      }

      return res.status(StatusCodes.SUCCESS.code).send({
        message: "Movie updated successfully",
        data: movie,
      });
    } catch (error) {
      console.error("Update Movie Error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to update movie",
        error: error.message,
      });
    }
  },

  // ✅ Delete Movie
  deleteMovie: async (req, res) => {
    try {
      const movie = await MoviseModel.findByIdAndDelete(req.params.id);

      if (!movie) {
        return res.status(StatusCodes.NOT_FOUND.code).send({
          message: "Movie not found",
        });
      }

      return res.status(StatusCodes.SUCCESS.code).send({
        message: "Movie deleted successfully",
        data: movie,
      });
    } catch (error) {
      console.error("Delete Movie Error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to delete movie",
        error: error.message,
      });
    }
  },

  // ✅ View Counter
  ViewController: async (req, res) => {
    try {
      const { moviesId } = req.body;
      if (!moviesId) return res.status(400).send({ message: "Movie ID is required" });

      const movie = await MoviseModel.findById(moviesId);
      if (!movie) return res.status(404).send({ message: "Movie not found" });

      movie.views = (movie.views || 0) + 1;
      await movie.save();

      res.status(200).send({ message: "View count updated", views: movie.views });
    } catch (error) {
      console.error(error);
      res.status(500).send({ message: "Something went wrong" });
    }
  },

  // ✅ Total Viewers
  TotalViewers: async (req, res) => {
    try {
      const result = await MoviseModel.aggregate([{ $group: { _id: null, totalViews: { $sum: "$views" } } }]);
      const total = result[0]?.totalViews || 0;
      res.status(200).send(total.toString());
    } catch (error) {
      console.error("Error calculating total views:", error);
      res.status(500).send("0");
    }
  },

  // ✅ Genre Stats
  getGenreViewStats: async (req, res) => {
    try {
      const result = await MoviseModel.aggregate([{ $group: { _id: "$category", totalViews: { $sum: "$views" } } }]);

      const totalViews = result.reduce((sum, genre) => sum + genre.totalViews, 0);
      const genrePercent = result.map((genre) => ({
        category: genre._id,
        views: genre.totalViews,
        percent: ((genre.totalViews / totalViews) * 100).toFixed(1),
      }));

      res.status(200).json(genrePercent);
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Error fetching genre stats" });
    }
  },

  // ✅ Add Rating
  addRating: async (req, res) => {
    try {
      const { movieId, name, rating, comment, country, createdAt } = req.body;

      const movie = await MoviseModel.findById(movieId);
      if (!movie) return res.status(404).json({ message: "Movie not found" });

      movie.ratings.push({ name, rating, comment, country, createdAt });
      await movie.save();

      res.status(200).json({ message: "Rating added successfully" });
    } catch (error) {
      console.error("Error in addRating:", error);
      res.status(500).json({ message: "Server error" });
    }
  },

  // ✅ Average Rating
  getAverageRating: async (req, res) => {
    try {
      const movie = await MoviseModel.findById(req.params.id);
      if (!movie) return res.status(404).json({ message: "Movie not found" });

      const ratings = movie.ratings;
      if (ratings.length === 0) return res.status(200).json({ avg: 0 });

      const avg = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
      res.status(200).json({ avg: avg.toFixed(1) });
    } catch (error) {
      console.error("Error in getAverageRating:", error);
      res.status(500).json({ message: "Server error" });
    }
  },

  // ✅ Movie Stats
  getAllMovieStats: async (req, res) => {
    try {
      const movies = await MoviseModel.find();
      const movieStats = movies.map((movie) => {
        const totalRatings = movie.ratings?.length || 0;
        const avgRating = totalRatings > 0 ? movie.ratings.reduce((sum, r) => sum + r.rating, 0) / totalRatings : 0;

        return {
          name: movie.name,
          duration: movie.Duration,
          views: movie.views,
          rating: avgRating.toFixed(1),
        };
      });

      res.status(200).json(movieStats);
    } catch (error) {
      console.error("Error fetching movie stats:", error);
      res.status(500).json({ message: "Server error" });
    }
  },

  // ✅ Get by Tag
  getMoviesByTag: async (req, res) => {
    try {
      let tags = req.query.tag;
      if (!Array.isArray(tags)) tags = [tags];
      const movies = await MoviseModel.find({ tags: { $in: tags } });
      res.status(200).json(movies);
    } catch (error) {
      console.error("Error in getMoviesByTag:", error);
      res.status(500).json({ message: "Server Error" });
    }
  },

  // ✅ Get by Category
  getCategoryByMovies: async (req, res) => {
    try {
      const { category } = req.query;
      if (!category) {
        return res.status(400).json({ error: "Category is required" });
      }
      const movies = await MoviseModel.find({ category });
      return res.status(200).json(movies);
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  },
};

export default MoviesController;
