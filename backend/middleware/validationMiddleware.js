import Joi from "joi";

const BRANCHES = [
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
];

const SECTIONS = ["A", "B", "C", "D", "E", "F"];

// Approx max base64 size helpers
// Base64 is ~1.33x the original binary size
const MAX_1MB_BASE64_LENGTH = Math.ceil(1 * 1024 * 1024 * 1.37);
const MAX_10MB_BASE64_LENGTH = Math.ceil(10 * 1024 * 1024 * 1.37);

const registrationSchema = Joi.object({
    name: Joi.string()
        .trim()
        .min(2)
        .max(100)
        .required()
        .messages({
            "string.empty": "Name is required.",
            "string.min": "Name must contain at least 2 characters.",
            "string.max": "Name cannot exceed 100 characters.",
            "any.required": "Name is required.",
        }),

    email: Joi.string()
        .trim()
        .lowercase()
        .custom((value, helpers) => {
            if (value.includes("@")) {
                if (value.endsWith("@gmail.com")) {
                    return value;
                }
                return helpers.error("string.gmailOnly");
            }
            return `${value}@gmail.com`;
        })
        .pattern(/^[a-zA-Z0-9._%+-]+@gmail\.com$/)
        .required()
        .messages({
            "string.empty": "Gmail address is required.",
            "string.gmailOnly": "Only @gmail.com addresses are allowed.",
            "string.pattern.base": "Please provide a valid Gmail address.",
            "any.required": "Gmail address is required.",
        }),

    registrationNumber: Joi.string()
        .trim()
        .uppercase()
        .min(3)
        .max(20)
        .required()
        .messages({
            "string.empty": "Registration number is required.",
            "any.required": "Registration number is required.",
        }),

    branch: Joi.string()
        .valid(...BRANCHES)
        .required()
        .messages({
            "any.only": `Branch must be one of: ${BRANCHES.join(", ")}.`,
            "any.required": "Branch is required.",
        }),

    section: Joi.string()
        .valid(...SECTIONS)
        .required()
        .messages({
            "any.only": `Section must be one of: ${SECTIONS.join(", ")}.`,
            "any.required": "Section is required.",
        }),

    whatsappNumber: Joi.string()
        .trim()
        .pattern(/^[0-9]{10}$/)
        .required()
        .messages({
            "string.empty": "WhatsApp number is required.",
            "string.pattern.base": "WhatsApp number must contain exactly 10 digits.",
            "any.required": "WhatsApp number is required.",
        }),

    isAcmMember: Joi.boolean()
        .required()
        .messages({
            "any.required": "Please indicate if you are an ACM Body Member.",
        }),

    acmGroupScreenshot: Joi.string()
        .allow("", null)
        .when("isAcmMember", {
            is: true,
            then: Joi.string()
                .required()
                .max(MAX_1MB_BASE64_LENGTH)
                .messages({
                    "string.empty": "ACM WhatsApp group screenshot is required for ACM Body Members.",
                    "string.max": "ACM WhatsApp group screenshot exceeds 1MB limit.",
                    "any.required": "ACM WhatsApp group screenshot is required for ACM Body Members.",
                }),
            otherwise: Joi.string().allow("", null).optional(),
        }),

    paymentScreenshot: Joi.string()
        .required()
        .max(MAX_10MB_BASE64_LENGTH)
        .messages({
            "string.empty": "Payment screenshot is required.",
            "string.max": "Payment screenshot exceeds 10MB limit.",
            "any.required": "Payment screenshot is required.",
        }),

    utrId: Joi.string()
        .trim()
        .uppercase()
        .min(4)
        .max(50)
        .required()
        .messages({
            "string.empty": "UTR / Transaction Reference ID is required.",
            "any.required": "UTR / Transaction Reference ID is required.",
        }),

    declarationConfirmed: Joi.boolean()
        .valid(true)
        .required()
        .messages({
            "any.only": "You must confirm the declaration to proceed.",
            "any.required": "You must confirm the declaration to proceed.",
        }),
});

export const validateRegistration = (req, res, next) => {
    // Normalize branch case
    if (typeof req.body.branch === "string") {
        const inputBranch = req.body.branch.trim();
        const matched = BRANCHES.find(
            (b) => b.toLowerCase() === inputBranch.toLowerCase()
        );
        if (matched) {
            req.body.branch = matched;
        }
    }

    // Normalize section case
    if (typeof req.body.section === "string") {
        req.body.section = req.body.section.trim().toUpperCase();
    }

    // Coerce isAcmMember if passed as string "Yes"/"No" or "true"/"false"
    if (typeof req.body.isAcmMember === "string") {
        const val = req.body.isAcmMember.trim().toLowerCase();
        req.body.isAcmMember = val === "yes" || val === "true";
    }

    // Coerce declarationConfirmed if passed as string
    if (typeof req.body.declarationConfirmed === "string") {
        req.body.declarationConfirmed = req.body.declarationConfirmed === "true";
    }

    const { error, value } = registrationSchema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
    });

    if (error) {
        return res.status(400).json({
            success: false,
            message: "Validation failed.",
            errors: error.details.map((detail) => detail.message),
        });
    }

    req.body = value;
    next();
};
