import crypto from "crypto";
import Registration from "../models/Registration.js";
import { sendRegistrationEmailWithRetry } from "./emailService.js";

const formatTitleCase = (str) => {
    if (!str) return "";
    return String(str)
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
};

export const registerUser = async (data) => {
    const {
        name: rawName,
        email: rawEmail,
        registrationNumber: rawRegNo,
        branch,
        section,
        whatsappNumber,
        isAcmMember = false,
        acmGroupScreenshot = null,
        paymentScreenshot,
        utrId: rawUtrId,
        declarationConfirmed = true,
    } = data;

    const name = formatTitleCase(rawName);
    const email = String(rawEmail).trim().toLowerCase();
    const registrationNumber = String(rawRegNo).trim().toUpperCase();
    const utrId = String(rawUtrId).trim().toUpperCase();

    // Check duplicate email
    const existingEmail = await Registration.findOne({ email });
    if (existingEmail) {
        const error = new Error("This email is already registered for Xcelerate-2K26.");
        error.statusCode = 409;
        throw error;
    }

    // Check duplicate registration number
    const existingReg = await Registration.findOne({ registrationNumber });
    if (existingReg) {
        const error = new Error(`Registration Number ${registrationNumber} is already registered.`);
        error.statusCode = 409;
        throw error;
    }

    // Check duplicate UTR ID
    const existingUtr = await Registration.findOne({ utrId });
    if (existingUtr) {
        const error = new Error(`UTR / Transaction Reference ${utrId} has already been submitted.`);
        error.statusCode = 409;
        throw error;
    }

    // Generate unique attendance QR token for non-ACM attendees
    let qrToken = null;
    if (!isAcmMember) {
        qrToken = `XCEL-${registrationNumber}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    }

    // Create registration record
    const registration = await Registration.create({
        name,
        email,
        registrationNumber,
        branch,
        section,
        whatsappNumber,
        isAcmMember,
        acmGroupScreenshot: isAcmMember ? acmGroupScreenshot : null,
        paymentScreenshot,
        utrId,
        declarationConfirmed: Boolean(declarationConfirmed),
        qrToken,
    });

    // Send confirmation email via Brevo
    try {
        const sent = await sendRegistrationEmailWithRetry({
            name,
            email,
            isAcmMember,
            qrToken,
            registrationNumber,
            branch,
        });
        registration.emailStatus = sent ? "Sent" : "Failed";
    } catch (emailError) {
        console.error(`Email dispatch failed for ${email}:`, emailError.message);
        registration.emailStatus = "Failed";
    }

    await registration.save();

    return {
        id: registration._id,
        name: registration.name,
        email: registration.email,
        registrationNumber: registration.registrationNumber,
        branch: registration.branch,
        section: registration.section,
        isAcmMember: registration.isAcmMember,
        qrToken: registration.qrToken,
        emailStatus: registration.emailStatus,
    };
};
