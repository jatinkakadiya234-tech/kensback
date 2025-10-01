// config/cloudinaryConfig.js
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: "dywemgp0i",
  api_key: "458126744165737",
  api_secret: "VPLlYH1W6GhYiZigjrtO8AS4HBI",
});

async function claudUplode(path) {
  const img = await cloudinary.uploader.upload(path);
  return img;
}

export default claudUplode;
