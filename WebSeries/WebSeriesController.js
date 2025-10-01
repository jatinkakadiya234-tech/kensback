import WebSeriesModel from "./WebSeriesModel.js";
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
const WebSeriesController = {
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
			const { video } = req.files;
			const [video720p, video1080p] = await Promise.all([
				zataUpload(video[0].path, "webseries", "720p"),
				zataUpload(video[1].path, "webseries", "1080p"),
			]);
			
			const videoUrl = {
				"720p": "https://"+video720p,
				"1080p": "https://"+video1080p,
			};
			

			fs.unlinkSync(video[0].path);
			fs.unlinkSync(video[1].path);

			const { episodeNumber } = req.body;
			if (!episodeNumber || !videoUrl) return res.status(400).json({ message: "episodeNumber and videoUrl are required" });

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


