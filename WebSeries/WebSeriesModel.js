import mongoose from "mongoose";

const { Schema } = mongoose;

// Minimal episode: only episode number and video URL
const EpisodeSchema = new Schema(
	{
		episodeNumber: { type: Number, required: true, min: 1 },
		qualities: {
			"720p": { type: String, required: true, trim: true },
			"1080p": { type: String, required: true, trim: true },
		},
	},
	{ _id: false}
);

// Minimal season: season number and list of episodes
const SeasonSchema = new Schema(
	{
		seasonNumber: { type: Number, required: true, min: 1 },
		episodes: { type: [EpisodeSchema], default: [] },
	},
	{ _id: false }
);

// Minimal web series: title and seasons only
const WebSeriesSchema = new Schema(
	{
		title: { type: String, required: true, trim: true },
		seasons: { type: [SeasonSchema], default: [] },
	},
	{ timestamps: true }
);

const WebSeriesModel = mongoose.models.WebSeries || mongoose.model("WebSeries", WebSeriesSchema);

export default WebSeriesModel;


