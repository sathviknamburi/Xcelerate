import mongoose from "mongoose";

const registrationSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true,
        },
        registrationNumber: {
            type: String,
            required: true,
            trim: true,
            uppercase: true,
            index: true,
        },
        branch: {
            type: String,
            required: true,
            enum: [
                "CSE",
                "AIML",
                "CIC",
                "IT",
                "AIDS",
                "CSBS",
                "CSIT",
                "CSD",
                "ECE",
                "EEE",
                "Mechanical",
                "Civil",
            ],
            trim: true,
        },
        section: {
            type: String,
            required: true,
            enum: ["A", "B", "C", "D", "E", "F"],
            trim: true,
        },
        whatsappNumber: {
            type: String,
            required: true,
            trim: true,
        },
        isAcmMember: {
            type: Boolean,
            required: true,
            default: false,
        },
        // Only required if isAcmMember === true (max 1MB)
        acmGroupScreenshot: {
            type: String,
            default: null,
        },
        // Required for all (max 10MB)
        paymentScreenshot: {
            type: String,
            required: true,
        },
        // Unique Transaction Reference (UTR) ID
        utrId: {
            type: String,
            required: true,
            trim: true,
        },
        declarationConfirmed: {
            type: Boolean,
            required: true,
            default: true,
        },
        // Unique attendance token generated for non-ACM attendees to scan QR code
        qrToken: {
            type: String,
            unique: true,
            sparse: true,
            trim: true,
        },
        emailStatus: {
            type: String,
            enum: ["Pending", "Sent", "Failed"],
            default: "Pending",
        },
        registeredAt: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true,
    }
);

const Registration = mongoose.model("Registration", registrationSchema);

export default Registration;