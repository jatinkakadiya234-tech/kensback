import nodemailer from "nodemailer"
import dotenv from 'dotenv'
dotenv.config()

const Transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});
export default Transporter