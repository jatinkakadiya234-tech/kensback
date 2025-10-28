import WebSeriesModel from "./WebSeriesModel.js";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import AWS from "aws-sdk";
import path from "path";

ffmpeg.setFfprobePath(ffprobeInstaller.path);

const s3 = new AWS.S3({
  endpoint: "https://idr01.zata.ai", // Confirm actual endpoint
  accessKeyId: "XZS8480JOSLIQ4MNN8ZW", // From Zata.ai Access Keys
  secretAccessKey: "WBMjXPrD2aDXBbfvcktxdA7W8LWG1j7paAeT89aQ",
  region: "idr01",
  s3ForcePathStyle: true,
  
});

async function zataUpload(filePath, folder, quality = "") {
  const fileContent = fs.readFileSync(filePath);
  const fileName = `${folder}/${quality ? quality + "/" : ""}${Date.now()}-${Math.round(
    Math.random() * 1e9
  )}${filePath.substring(filePath.lastIndexOf("."))}`;

  const params = {
    Bucket: "kenskensdrive",
    Key: fileName,
    Body: fileContent,
    ACL: "public-read",
  };

  const data = await s3.upload(params).promise();
  console.log(data);
  return data.Location; // public URL
}

// In-memory upload progress for webseries
const uploadProgress = new Map();

// Ensure upload dirs
function ensureUploadDirs() {
  const dirs = [
    './uploads',
    './uploads/others'
  ];
  dirs.forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });
}
ensureUploadDirs();

async function assembleChunks(uploadId) {
  const info = uploadProgress.get(uploadId);
  if (!info) throw new Error('Upload info not found');
  const { chunks, fileName, fileSize } = info;
  const outputPath = path.resolve(`./uploads/others/${uploadId}-${fileName}`);
  const writeStream = fs.createWriteStream(outputPath);
  const ordered = Array.from(chunks.entries()).sort((a,b)=>a[0]-b[0]);
  for (const [, chunkPath] of ordered) {
    const data = fs.readFileSync(chunkPath);
    writeStream.write(data);
    try { fs.unlinkSync(chunkPath); } catch {}
  }
  await new Promise((res, rej) => writeStream.end(err => err ? rej(err) : res()));
  const stats = fs.statSync(outputPath);
  if (fileSize && stats.size !== fileSize) {
    info.status = 'failed';
    throw new Error('Assembled size mismatch');
  }
  const finalUrl = await zataUpload(outputPath, "webseries", "");
  info.status = 'completed';
  info.finalUrl = finalUrl; // already absolute
  info.assembledPath = outputPath;
}

const WebSeriesController = {
    // Chunked upload: initialize
    initializeChunkedUpload: async (req, res) => {
        try {
            const { fileName, fileSize, totalChunks } = req.body;
            if (!fileName || !fileSize || !totalChunks) return res.status(400).json({ message: 'Missing required fields' });
            const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
            uploadProgress.set(uploadId, {
                fileName,
                fileSize: parseInt(fileSize),
                totalChunks: parseInt(totalChunks),
                uploadedChunks: 0,
                chunks: new Map(),
                progress: 0,
                status: 'initialized'
            });
            return res.status(200).json({ success: true, uploadId });
        } catch (e) {
            return res.status(500).json({ message: 'server error', error: e.message });
        }
    },

    // Chunked upload: receive chunk
    uploadChunk: async (req, res) => {
        try {
            const { uploadId, chunkNumber, totalChunks } = req.body;
            const chunkFile = req.file;
            const info = uploadProgress.get(uploadId);
            if (!info || !chunkFile) return res.status(400).json({ message: 'invalid upload session or file' });
            info.chunks.set(parseInt(chunkNumber), chunkFile.path);
            info.uploadedChunks++;
            info.progress = Math.round((info.uploadedChunks / info.totalChunks) * 100);
            if (info.uploadedChunks === info.totalChunks) {
                info.status = 'assembling';
                assembleChunks(uploadId).catch(() => {});
            }
            return res.status(200).json({ success: true, progress: info.progress, status: info.status });
        } catch (e) {
            return res.status(500).json({ message: 'server error', error: e.message });
        }
    },

    // Chunked upload: progress
    getUploadProgress: async (req, res) => {
        try {
            const { uploadId } = req.params;
            const info = uploadProgress.get(uploadId);
            if (!info) return res.status(404).json({ message: 'Upload not found' });
            return res.status(200).json({ success: true, progress: info.progress, status: info.status });
        } catch (e) {
            return res.status(500).json({ message: 'server error', error: e.message });
        }
    },
	// Create a new web series with a title
	createSeries: async (req, res) => {
		try {
			const { title } = req.body;
			if (!title) return res.status(400).json({ message: "title is required" });
			const series = await WebSeriesModel.create({ title });
			return res.status(201).json({ message: "created", series });
		} catch (error) {
			return res.status(500).json({ message: "server error", error: error.message });
		}
	},

	// List all series (basic fields only)
	listSeries: async (_req, res) => {
		try {
			const series = await WebSeriesModel.find({}, { title: 1, seasons: 1, createdAt: 1 }).sort({ createdAt: -1 });
			return res.status(200).json({ total: series.length, series });
		} catch (error) {
			return res.status(500).json({ message: "server error", error: error.message });
		}
	},

	// Get one series by id
	getSeries: async (req, res) => {
		try {
			const { id } = req.params;
			const series = await WebSeriesModel.findById(id);
			if (!series) return res.status(404).json({ message: "not found" });
			return res.status(200).json({ series });
		} catch (error) {
			return res.status(500).json({ message: "server error", error: error.message });
		}
	},

    // List episodes of a season
    listEpisodes: async (req, res) => {
        try {
            const { id, seasonNumber } = req.params;
            const series = await WebSeriesModel.findById(id);
            if (!series) return res.status(404).json({ message: 'series not found' });
            const season = series.seasons.find(s => s.seasonNumber === Number(seasonNumber));
            if (!season) return res.status(404).json({ message: 'season not found' });
            return res.status(200).json({ episodes: season.episodes || [] });
        } catch (error) {
            return res.status(500).json({ message: 'server error', error: error.message });
        }
    },

    // Get single episode
    getEpisode: async (req, res) => {
        try {
            const { id, seasonNumber, episodeNumber } = req.params;
            const series = await WebSeriesModel.findById(id);
            if (!series) return res.status(404).json({ message: 'series not found' });
            const season = series.seasons.find(s => s.seasonNumber === Number(seasonNumber));
            if (!season) return res.status(404).json({ message: 'season not found' });
            const episode = season.episodes.find(e => e.episodeNumber === Number(episodeNumber));
            if (!episode) return res.status(404).json({ message: 'episode not found' });
            return res.status(200).json({ episode });
        } catch (error) {
            return res.status(500).json({ message: 'server error', error: error.message });
        }
    },

    // Update episode with chunked upload (replace qualities optionally)
    updateEpisodeWithChunks: async (req, res) => {
        try {
            const { id, seasonNumber, episodeNumber } = req.params;
            const { uploadId720, uploadId1080 } = req.body;
            const up720 = uploadId720 ? uploadProgress.get(uploadId720) : null;
            const up1080 = uploadId1080 ? uploadProgress.get(uploadId1080) : null;
            if (uploadId720 && (!up720 || up720.status !== 'completed')) return res.status(400).json({ message: '720p not ready' });
            if (uploadId1080 && (!up1080 || up1080.status !== 'completed')) return res.status(400).json({ message: '1080p not ready' });

            const series = await WebSeriesModel.findById(id);
            if (!series) return res.status(404).json({ message: 'series not found' });
            const season = series.seasons.find(s => s.seasonNumber === Number(seasonNumber));
            if (!season) return res.status(404).json({ message: 'season not found' });
            const episode = season.episodes.find(e => e.episodeNumber === Number(episodeNumber));
            if (!episode) return res.status(404).json({ message: 'episode not found' });

            episode.qualities = { ...(episode.qualities || {}) };
            if (up720?.finalUrl) episode.qualities['720p'] = up720.finalUrl;
            if (up1080?.finalUrl) episode.qualities['1080p'] = up1080.finalUrl;
            await series.save();

            try { if (up720?.assembledPath) fs.unlinkSync(up720.assembledPath); } catch {}
            try { if (up1080?.assembledPath) fs.unlinkSync(up1080.assembledPath); } catch {}
            if (uploadId720) uploadProgress.delete(uploadId720);
            if (uploadId1080) uploadProgress.delete(uploadId1080);

            return res.status(200).json({ message: 'episode updated', episode });
        } catch (error) {
            return res.status(500).json({ message: 'server error', error: error.message });
        }
    },

	// Add a new season to a series
	addSeason: async (req, res) => {
		try {
			const { id } = req.params; // series id
			const { seasonNumber } = req.body;
			if (!seasonNumber) return res.status(400).json({ message: "seasonNumber is required" });
			const series = await WebSeriesModel.findById(id);
			if (!series) return res.status(404).json({ message: "series not found" });

			const exists = series.seasons?.some(s => s.seasonNumber === Number(seasonNumber));
			if (exists) return res.status(400).json({ message: "season already exists" });

			series.seasons.push({ seasonNumber: Number(seasonNumber), episodes: [] });
			await series.save();
			return res.status(200).json({ message: "season added", series });
		} catch (error) {
			return res.status(500).json({ message: "server error", error: error.message });
		}
	},

	// Add an episode to a given season
	addEpisode: async (req, res) => {
		try {
			const { id, seasonNumber } = req.params;
			const { video } = req.files || {};
			let videoUrl = {};
			if (video && video[0]) {
				const uploaded720 = await zataUpload(video[0].path, "webseries", "720p");
				videoUrl["720p"] = uploaded720; // absolute
				try { fs.unlinkSync(video[0].path); } catch {}
			}
			if (video && video[1]) {
				const uploaded1080 = await zataUpload(video[1].path, "webseries", "1080p");
				videoUrl["1080p"] = uploaded1080; // absolute
				try { fs.unlinkSync(video[1].path); } catch {}
			}

			const { episodeNumber } = req.body;
			if (!episodeNumber) return res.status(400).json({ message: "episodeNumber is required" });

			const series = await WebSeriesModel.findById(id);
			if (!series) return res.status(404).json({ message: "series not found" });

			const season = series.seasons.find(s => s.seasonNumber === Number(seasonNumber));
			if (!season) return res.status(404).json({ message: "season not found" });

			const epExists = season.episodes?.some(e => e.episodeNumber === Number(episodeNumber));
			if (epExists) return res.status(400).json({ message: "episode already exists" });

			season.episodes.push({ episodeNumber: Number(episodeNumber), qualities: videoUrl });
			await series.save();
			return res.status(200).json({ message: "episode added", series });
		} catch (error) {
			return res.status(500).json({ message: "server error", error: error.message });
		}
	},

    // Add episode via chunked upload
    addEpisodeWithChunks: async (req, res) => {
        try {
            const { id, seasonNumber } = req.params;
            const { uploadId720, uploadId1080, episodeNumber } = req.body;
            if (!episodeNumber) return res.status(400).json({ message: 'episodeNumber required' });

            const up720 = uploadId720 ? uploadProgress.get(uploadId720) : null;
            const up1080 = uploadId1080 ? uploadProgress.get(uploadId1080) : null;
            if (uploadId720 && (!up720 || up720.status !== 'completed')) return res.status(400).json({ message: '720p not ready' });
            if (uploadId1080 && (!up1080 || up1080.status !== 'completed')) return res.status(400).json({ message: '1080p not ready' });

            const series = await WebSeriesModel.findById(id);
            if (!series) return res.status(404).json({ message: 'series not found' });
            const season = series.seasons.find(s => s.seasonNumber === Number(seasonNumber));
            if (!season) return res.status(404).json({ message: 'season not found' });
            const epExists = season.episodes?.some(e => e.episodeNumber === Number(episodeNumber));
            if (epExists) return res.status(400).json({ message: 'episode already exists' });

            const qualities = {};
            if (up720?.finalUrl) qualities['720p'] = up720.finalUrl;
            if (up1080?.finalUrl) qualities['1080p'] = up1080.finalUrl;

            season.episodes.push({ episodeNumber: Number(episodeNumber), qualities });
            await series.save();

            // Cleanup assembled files and sessions
            try { if (up720?.assembledPath) fs.unlinkSync(up720.assembledPath); } catch {}
            try { if (up1080?.assembledPath) fs.unlinkSync(up1080.assembledPath); } catch {}
            if (uploadId720) uploadProgress.delete(uploadId720);
            if (uploadId1080) uploadProgress.delete(uploadId1080);

            return res.status(200).json({ message: 'episode added', series });
        } catch (error) {
            return res.status(500).json({ message: 'server error', error: error.message });
        }
    },
	deleteSeries: async (req, res) => {
		try {
			const { id } = req.params; // series id
			const deleted = await WebSeriesModel.findByIdAndDelete(id);
			if (!deleted) return res.status(404).json({ message: "series not found" });
			return res.status(200).json({ message: "series deleted", deleted });
		} catch (error) {
			return res.status(500).json({ message: "server error", error: error.message });
		}
	},

	// -------- Delete a specific season from series --------
	deleteSeason: async (req, res) => {
		try {
			const { id, seasonNumber } = req.params; // series id + season number
			const series = await WebSeriesModel.findById(id);
			if (!series) return res.status(404).json({ message: "series not found" });

			const seasonIndex = series.seasons.findIndex(s => s.seasonNumber === Number(seasonNumber));
			if (seasonIndex === -1) return res.status(404).json({ message: "season not found" });

			series.seasons.splice(seasonIndex, 1); // remove season
			await series.save();

			return res.status(200).json({ message: "season deleted", series });
		} catch (error) {
			return res.status(500).json({ message: "server error", error: error.message });
		}
	},

	// -------- Delete a specific episode from a season --------
	deleteEpisode: async (req, res) => {
		try {
			const { id, seasonNumber, episodeNumber } = req.params; // series id + season + episode
			const series = await WebSeriesModel.findById(id);
			if (!series) return res.status(404).json({ message: "series not found" });

			const season = series.seasons.find(s => s.seasonNumber === Number(seasonNumber));
			if (!season) return res.status(404).json({ message: "season not found" });

			const epIndex = season.episodes.findIndex(e => e.episodeNumber === Number(episodeNumber));
			if (epIndex === -1) return res.status(404).json({ message: "episode not found" });

			season.episodes.splice(epIndex, 1); // remove episode
			await series.save();

			return res.status(200).json({ message: "episode deleted", series });
		} catch (error) {
			return res.status(500).json({ message: "server error", error: error.message });
		}
	},
};



export default WebSeriesController;


