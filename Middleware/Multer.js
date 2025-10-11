// middleware/upload.js
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

// __dirname workaround for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const uploadsDir_Video = path.join(__dirname, "../uploads/videos");
const uploadsDir_Img = path.join(__dirname, "../uploads/images");
const uploadsDir_Other = path.join(__dirname, "../uploads/others");

// Storage setup
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (file.fieldname === "video") {
      cb(null, uploadsDir_Video);
    } else if (file.fieldname === "image") {
      cb(null, uploadsDir_Img);
    } else {
      cb(null, uploadsDir_Other);
    }
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

// File filter
const fileFilter = (req, file, cb) => {
  if (file.fieldname === "video") {
    // ફક્ત વિડિઓ ફાઇલ્સ સ્વીકારો
    if (file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error("ફક્ત વિડિઓ ફાઇલ્સ અપલોડ કરી શકો છો!"), false);
    }
  } else if (
    file.fieldname === "image" ||
    file.fieldname === "cast" ||
    file.fieldname === "musicprofil" ||
    file.fieldname === "Directorprofil"
  ) {
    // ફક્ત ઇમેજ ફાઇલ્સ સ્વીકારો
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("ફક્ત ઇમેજ ફાઇલ્સ અપલોડ કરી શકો છો!"), false);
    }
  } else {
    cb(new Error("અમાન્ય ફાઇલ ફીલ્ડ!"), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 * 1024 } // 10 GB
});

export default upload;
