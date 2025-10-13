// controllers/MoviesController.js
import StatusCodes from "../config/errorHandel.js";
import MoviseModel from "./MoviseModel.js";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
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

// In-memory storage for upload progress (in production, use Redis or database)
const uploadProgress = new Map();

// ✅ Check available disk space
function checkDiskSpace(dirPath, requiredBytes) {
  try {
    const stats = fs.statSync(dirPath);
    // This is a basic check - in production you might want to use a proper disk space library
    console.log(`Directory exists: ${dirPath}`);
    return true;
  } catch (error) {
    console.error(`Error checking disk space for ${dirPath}:`, error);
    return false;
  }
}

// ✅ Ensure upload directories exist
function ensureUploadDirs() {
  const dirs = [
    './uploads',
    './uploads/chunks',
    './uploads/videos',
    './uploads/images',
    './uploads/others'
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    } else {
      console.log(`Directory exists: ${dir}`);
    }
  });
}

// Initialize directories on startup
ensureUploadDirs();

// ✅ Cleanup old chunk files (run every hour)
setInterval(() => {
  const chunksDir = './uploads/others';
  if (fs.existsSync(chunksDir)) {
    const files = fs.readdirSync(chunksDir);
    const now = Date.now();
    const oneHour = 60 * 60 * 1000; // 1 hour in milliseconds
    
    files.forEach(file => {
      const filePath = path.join(chunksDir, file);
      const stats = fs.statSync(filePath);
      
      // Delete files older than 1 hour
      if (now - stats.mtime.getTime() > oneHour) {
        try {
          fs.unlinkSync(filePath);
          console.log(`Cleaned up old chunk file: ${file}`);
        } catch (err) {
          console.error(`Error cleaning up file ${file}:`, err);
        }
      }
    });
  }
}, 60 * 60 * 1000); // Run every hour

// ✅ Assemble chunks into complete file
async function assembleChunks(uploadId) {
  let writeStream = null;
  let outputPath = null;
  
  try {
    const uploadInfo = uploadProgress.get(uploadId);
    if (!uploadInfo) {
      console.error(`Upload info not found for ${uploadId}`);
      return;
    }

    const { chunks, fileName, fileSize } = uploadInfo;
    outputPath = path.resolve(`./uploads/chunks/${uploadId}-${fileName}`);
    
    // Ensure directory exists
    const chunksDir = path.dirname(outputPath);
    if (!fs.existsSync(chunksDir)) {
      fs.mkdirSync(chunksDir, { recursive: true });
    }

    console.log(`Starting assembly for upload ${uploadId}`);
    console.log(`Chunks to assemble: ${chunks.size}`);
    console.log(`Output path: ${outputPath}`);
    console.log(`Expected file size: ${fileSize} bytes`);

    // Check available disk space (basic check)
    try {
      const stats = fs.statSync(chunksDir);
      console.log(`Directory stats:`, stats);
    } catch (err) {
      console.error('Error checking directory:', err);
    }

    // Create write stream with better error handling
    writeStream = fs.createWriteStream(outputPath, {
      flags: 'w',
      mode: 0o666,
      autoClose: true,
      emitClose: true
    });

    // Add error handler to write stream
    writeStream.on('error', (error) => {
      console.error('Write stream error:', error);
      throw error;
    });

    // Sort chunks by number and write them in order
    const sortedChunks = Array.from(chunks.entries()).sort((a, b) => a[0] - b[0]);
    
    let totalBytesWritten = 0;
    
    for (const [chunkNumber, chunkPath] of sortedChunks) {
      console.log(`Processing chunk ${chunkNumber} from path: ${chunkPath}`);
      
      // Check if chunk file exists
      if (!fs.existsSync(chunkPath)) {
        console.error(`Chunk file not found: ${chunkPath}`);
        throw new Error(`Chunk file not found: ${chunkPath}`);
      }

      // Get chunk file stats
      const chunkStats = fs.statSync(chunkPath);
      console.log(`Chunk ${chunkNumber} size: ${chunkStats.size} bytes`);
      
      // Read chunk data in smaller buffers to avoid memory issues
      const chunkData = fs.readFileSync(chunkPath);
      
      // Write chunk data with error handling
      const writePromise = new Promise((resolve, reject) => {
        const canContinue = writeStream.write(chunkData, (error) => {
          if (error) {
            console.error(`Error writing chunk ${chunkNumber}:`, error);
            reject(error);
          } else {
            totalBytesWritten += chunkData.length;
            console.log(`Chunk ${chunkNumber} written successfully. Total bytes: ${totalBytesWritten}`);
            resolve();
          }
        });

        if (!canContinue) {
          // Wait for drain event if write buffer is full
          writeStream.once('drain', resolve);
        }
      });

      await writePromise;
      
      // Clean up chunk file after successful write
      try {
        fs.unlinkSync(chunkPath);
        console.log(`Chunk file deleted: ${chunkPath}`);
      } catch (err) {
        console.error('Error deleting chunk file:', err);
        // Don't fail the whole process for cleanup errors
      }
    }
    
    // Close the write stream properly
    await new Promise((resolve, reject) => {
      writeStream.end((error) => {
        if (error) {
          console.error('Error closing write stream:', error);
          reject(error);
        } else {
          console.log('Write stream closed successfully');
          resolve();
        }
      });
    });

    // Verify the assembled file
    if (!fs.existsSync(outputPath)) {
      throw new Error('Assembled file was not created');
    }

    const assembledStats = fs.statSync(outputPath);
    console.log(`File assembly completed for upload ${uploadId}`);
    console.log(`Assembled file size: ${assembledStats.size} bytes`);
    console.log(`Expected size: ${fileSize} bytes`);
    console.log(`Size match: ${assembledStats.size === fileSize ? 'YES' : 'NO'}`);

    // Upload to Zata.ai
    console.log(`Starting upload to storage for ${uploadId}...`);
    const finalUrl = await zataUpload(outputPath, "movies", fileName.includes('720') ? "720p" : "1080p");
    
    // Update upload info
    uploadInfo.status = 'completed';
    uploadInfo.finalUrl = "https://" + finalUrl;
    uploadInfo.assembledPath = outputPath;
    
    console.log(`File upload to storage completed for upload ${uploadId}`);
    console.log(`Final URL: ${uploadInfo.finalUrl}`);
    
  } catch (error) {
    console.error('Error assembling chunks:', error);
    console.error('Error details:', {
      code: error.code,
      errno: error.errno,
      syscall: error.syscall,
      path: error.path,
      message: error.message
    });
    
    const uploadInfo = uploadProgress.get(uploadId);
    if (uploadInfo) {
      uploadInfo.status = 'failed';
      uploadInfo.error = error.message;
    }

    // Cleanup on error
    if (outputPath && fs.existsSync(outputPath)) {
      try {
        fs.unlinkSync(outputPath);
        console.log('Cleaned up failed assembly file');
      } catch (cleanupError) {
        console.error('Error cleaning up failed assembly file:', cleanupError);
      }
    }
    
    throw error; // Re-throw to be caught by caller
  } finally {
    // Ensure write stream is closed
    if (writeStream && !writeStream.destroyed) {
      try {
        writeStream.destroy();
      } catch (err) {
        console.error('Error destroying write stream:', err);
      }
    }
  }
}

const MoviesController = {
  // ✅ Create Movie (Regular upload)
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

  // ✅ Initialize Chunked Upload
  initializeChunkedUpload: async (req, res) => {
    try {
      const { fileName, fileSize, fileType, totalChunks } = req.body;
      
      if (!fileName || !fileSize || !totalChunks) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const uploadId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      uploadProgress.set(uploadId, {
        fileName,
        fileSize: parseInt(fileSize),
        fileType,
        totalChunks: parseInt(totalChunks),
        uploadedChunks: 0,
        chunks: new Map(),
        progress: 0,
        status: 'initialized'
      });

      res.status(200).json({
        success: true,
        uploadId,
        message: "Upload initialized successfully"
      });
    } catch (error) {
      console.error("Error initializing upload:", error);
      res.status(500).json({
        success: false,
        message: "Failed to initialize upload",
        error: error.message,
      });
    }
  },

  // ✅ Upload Chunk
  uploadChunk: async (req, res) => {
    try {
      const { uploadId, chunkNumber, totalChunks } = req.body;
      const chunkFile = req.file;

      console.log(`Uploading chunk ${chunkNumber} for upload ${uploadId}`);
      console.log(`Chunk file path: ${chunkFile?.path}`);
      console.log(`Chunk file size: ${chunkFile?.size}`);

      if (!uploadId || !chunkNumber || !chunkFile) {
        console.error("Missing required fields:", { uploadId, chunkNumber, hasFile: !!chunkFile });
        return res.status(400).json({ message: "Missing required fields" });
      }

      const uploadInfo = uploadProgress.get(uploadId);
      if (!uploadInfo) {
        console.error("Upload session not found:", uploadId);
        return res.status(404).json({ message: "Upload session not found" });
      }

      // Verify chunk file exists
      if (!fs.existsSync(chunkFile.path)) {
        console.error("Chunk file does not exist:", chunkFile.path);
        return res.status(400).json({ message: "Chunk file not found" });
      }

      // Store chunk
      uploadInfo.chunks.set(parseInt(chunkNumber), chunkFile.path);
      uploadInfo.uploadedChunks++;
      uploadInfo.progress = Math.round((uploadInfo.uploadedChunks / uploadInfo.totalChunks) * 100);

      console.log(`Chunk ${chunkNumber} stored successfully. Progress: ${uploadInfo.progress}%`);
      console.log(`Total chunks uploaded: ${uploadInfo.uploadedChunks}/${uploadInfo.totalChunks}`);

      // Check if all chunks are uploaded
      if (uploadInfo.uploadedChunks === uploadInfo.totalChunks) {
        console.log(`All chunks uploaded for ${uploadId}, starting assembly...`);
        uploadInfo.status = 'assembling';
        
        // Start assembling file in background with better error handling
        assembleChunks(uploadId).then(() => {
          console.log(`Assembly completed successfully for ${uploadId}`);
        }).catch((error) => {
          console.error(`Assembly failed for ${uploadId}:`, error);
          const uploadInfo = uploadProgress.get(uploadId);
          if (uploadInfo) {
            uploadInfo.status = 'failed';
            uploadInfo.error = error.message;
          }
        });
      }

      res.status(200).json({
        success: true,
        progress: uploadInfo.progress,
        uploadedChunks: uploadInfo.uploadedChunks,
        totalChunks: uploadInfo.totalChunks,
        status: uploadInfo.status,
        message: `Chunk ${chunkNumber} uploaded successfully`
      });
    } catch (error) {
      console.error("Error uploading chunk:", error);
      res.status(500).json({
        success: false,
        message: "Failed to upload chunk",
        error: error.message,
      });
    }
  },

  // ✅ Get Upload Progress
  getUploadProgress: async (req, res) => {
    try {
      const { uploadId } = req.params;
      
      const uploadInfo = uploadProgress.get(uploadId);
      if (!uploadInfo) {
        return res.status(404).json({ message: "Upload session not found" });
      }

      res.status(200).json({
        success: true,
        progress: uploadInfo.progress,
        uploadedChunks: uploadInfo.uploadedChunks,
        totalChunks: uploadInfo.totalChunks,
        status: uploadInfo.status,
        fileName: uploadInfo.fileName,
        fileSize: uploadInfo.fileSize
      });
    } catch (error) {
      console.error("Error getting upload progress:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get upload progress",
        error: error.message,
      });
    }
  },

  // ✅ Create Movie with Chunked Upload
  createMovieWithChunks: async (req, res) => {
    try {
      const { uploadId720, uploadId1080, name, isPremium } = req.body;
      const { image } = req.files;

      if (!uploadId720 || !uploadId1080 || !name || !image) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const upload720 = uploadProgress.get(uploadId720);
      const upload1080 = uploadProgress.get(uploadId1080);

      if (!upload720 || !upload1080) {
        return res.status(404).json({ message: "Upload sessions not found" });
      }

      if (upload720.status !== 'completed' || upload1080.status !== 'completed') {
        return res.status(400).json({ message: "Videos are still being processed" });
      }

      // Upload thumbnail
      const [thumbnailUrl] = await Promise.all([zataUpload(image[0].path, "thumbnails")]);

      // Save movie
      const movie = await MoviseModel.create({
        name,
        isPremium,
        qualities: {
          "720p": upload720.finalUrl,
          "1080p": upload1080.finalUrl,
        },
        thumbnail: thumbnailUrl,
      });

      // Cleanup
      try {
        fs.unlinkSync(upload720.assembledPath);
        fs.unlinkSync(upload1080.assembledPath);
        fs.unlinkSync(image[0].path);
      } catch (cleanupErr) {
        console.error("Error cleaning up files:", cleanupErr);
      }

      // Remove from progress tracking
      uploadProgress.delete(uploadId720);
      uploadProgress.delete(uploadId1080);

      res.status(201).json({
        success: true,
        message: "Movie created successfully with chunked upload",
        data: movie,
      });
    } catch (error) {
      console.error("Error creating movie with chunks:", error);
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
