import { registerUser } from "../services/registrationService.js";

export const register = async (req, res, next) => {
    try {
        const result = await registerUser(req.body);

        let message;
        if (result.emailStatus === "Sent") {
            message = result.isAcmMember
                ? "Registration successful! Confirmation email has been sent."
                : "Registration successful! Confirmation email with your Attendance QR Code has been sent.";
        } else {
            message = "Registration recorded successfully! Our team will verify your payment and details.";
        }

        res.status(201).json({
            success: true,
            message,
            registration: {
                id: result.id,
                name: result.name,
                email: result.email,
                registrationNumber: result.registrationNumber,
                branch: result.branch,
                section: result.section,
                isAcmMember: result.isAcmMember,
                qrToken: result.qrToken,
            },
            emailStatus: result.emailStatus,
        });
    } catch (error) {
        next(error);
    }
};
