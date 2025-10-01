// models/Movies.js
import mongoose from "mongoose";

const MoviesSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },

  thumbnail: {
    type: String,
    required: true
  },

  qualities: {
    "720p": { type: String },
    "1080p": { type: String }
  },

  isPremium: {
    type: Boolean,
    default: false
  },

  views: {
    type: Number,
    default: 0
  },

  ratings: [
    {
      name: {
        type: String,
        required: true
      },
      rating: {
        type: Number,
        min: 1,
        max: 5,
        required: true
      },
      comment: {
        type: String
      },
      country: {
        type: String
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }
  ]
});

export default mongoose.model("tbl_movies", MoviesSchema);
