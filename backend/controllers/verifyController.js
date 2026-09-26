import Registration from "../models/Registration.js";

const renderPage = ({ valid, participant, query }) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Xcelerate-2K26 Attendance Verification</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
            background: #090d16;
            color: #f1f5f9;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .card {
            max-width: 480px;
            width: 100%;
            background: #111827;
            border: 1px solid #1f2937;
            border-radius: 24px;
            overflow: hidden;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            text-align: center;
        }
        .header {
            padding: 32px 24px;
            background: ${valid ? "linear-gradient(135deg, #064e3b 0%, #065f46 100%)" : "linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)"};
        }
        .badge {
            display: inline-block;
            background: rgba(255, 255, 255, 0.2);
            color: #fff;
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            padding: 6px 14px;
            border-radius: 9999px;
            margin-bottom: 12px;
        }
        h1 { font-size: 22px; font-weight: 800; color: #fff; margin-bottom: 6px; }
        .body { padding: 32px 24px; }
        .detail-row {
            display: flex;
            justify-content: space-between;
            padding: 12px 0;
            border-bottom: 1px solid #1f2937;
            font-size: 14px;
        }
        .detail-row:last-child { border-bottom: none; }
        .label { color: #9ca3af; font-weight: 600; }
        .value { color: #f9fafb; font-weight: 700; text-align: right; }
        .footer {
            padding: 18px 24px;
            background: #0d131f;
            border-top: 1px solid #1f2937;
            font-size: 13px;
            color: #6b7280;
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="header">
            <div class="badge">${valid ? "VALID PASS ✓" : "NOT FOUND ✗"}</div>
            <h1>${valid ? "Attendee Verified" : "Invalid Token"}</h1>
            <p style="color: rgba(255, 255, 255, 0.8); font-size: 14px;">Xcelerate-2K26 &bull; SRKR ACM Chapter</p>
        </div>
        <div class="body">
            ${valid ? `
                <div class="detail-row">
                    <span class="label">Attendee Name</span>
                    <span class="value">${participant.name}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Reg Number</span>
                    <span class="value">${participant.registrationNumber}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Branch & Section</span>
                    <span class="value">${participant.branch} - Sec ${participant.section}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Category</span>
                    <span class="value">${participant.isAcmMember ? "ACM Body Member" : "Non-ACM Attendee"}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Pass Code</span>
                    <span class="value" style="font-family: monospace; color: #38bdf8;">${participant.qrToken || "ACM-MEMBER"}</span>
                </div>
            ` : `
                <p style="color: #ef4444; font-size: 15px; margin-bottom: 12px;">
                    No attendee record matches the scanned QR code or identifier:
                </p>
                <p style="font-family: monospace; color: #9ca3af; background: #1f2937; padding: 10px; border-radius: 8px;">
                    ${query}
                </p>
            `}
        </div>
        <div class="footer">
            SRKR ACM Student Chapter &bull; Technical Event Attendance
        </div>
    </div>
</body>
</html>
`;

export const verifyCertificate = async (req, res) => {
    try {
        const query = (req.params.aceId || req.params.token || req.query.token || "").trim();

        if (!query) {
            return res.status(400).send(renderPage({ valid: false, query: "None provided" }));
        }

        const participant = await Registration.findOne({
            $or: [
                { qrToken: query },
                { registrationNumber: query.toUpperCase() },
                { email: query.toLowerCase() },
            ],
        });

        if (!participant) {
            return res.status(404).send(renderPage({ valid: false, query }));
        }

        return res.send(renderPage({ valid: true, participant, query }));
    } catch (err) {
        console.error("Verification error:", err);
        return res.status(500).send("Internal server error during verification.");
    }
};
