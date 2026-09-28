import { useState, useRef } from "react";
import { registerParticipant } from "./services/registrationApi";
import AsteroidsBackground from "./components/AsteroidsBackground";
import aceLogo from "./assets/ace-logo.png";
import { EVENT_DATA } from "./data/eventContent";
import "./index.css";

const BRANCH_OPTIONS = [
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

const SECTION_OPTIONS = ["A", "B", "C", "D", "E", "F"];

export default function App() {
    // Current Step in the Wizard: 1 = Student Info, 2 = ACM Membership, 3 = Payment & Pass
    const [currentStep, setCurrentStep] = useState(1);
    const [showEventModal, setShowEventModal] = useState(false);
    const [activeEventTab, setActiveEventTab] = useState("schedule");
    const [activeDayIndex, setActiveDayIndex] = useState(0);

    // Device Lock: check if this device has already submitted a response (Google Forms style)
    const [existingSubmission, setExistingSubmission] = useState(() => {
        try {
            const saved = localStorage.getItem("xcelerate_registered_pass");
            return saved ? JSON.parse(saved) : null;
        } catch {
            return null;
        }
    });

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        registrationNumber: "",
        branch: "",
        section: "",
        whatsappNumber: "",
        isAcmMember: false,
        acmGroupScreenshot: "",
        paymentScreenshot: "",
        utrId: "",
        declarationConfirmed: false,
    });

    const [previews, setPreviews] = useState({
        acmGroup: null, // { url, name, size }
        payment: null,  // { url, name, size }
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [successData, setSuccessData] = useState(null);

    const acmFileInputRef = useRef(null);
    const paymentFileInputRef = useRef(null);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        if (type === "checkbox") {
            setFormData((prev) => ({ ...prev, [name]: checked }));
        } else {
            setFormData((prev) => ({ ...prev, [name]: value }));
        }
        if (error) setError("");
    };

    const handleAcmToggle = (isMember) => {
        setFormData((prev) => ({
            ...prev,
            isAcmMember: isMember,
            acmGroupScreenshot: isMember ? prev.acmGroupScreenshot : "",
        }));
        if (!isMember) {
            setPreviews((prev) => ({ ...prev, acmGroup: null }));
            if (acmFileInputRef.current) acmFileInputRef.current.value = "";
        }
        if (error) setError("");
    };

    // Step 1 Validation -> Move to Step 2
    const handleNextFromStep1 = () => {
        setError("");

        if (!formData.name.trim()) {
            setError("Please enter your full name.");
            return;
        }

        const rawEmail = formData.email.trim();
        if (!rawEmail) {
            setError("Please enter your Gmail username or address.");
            return;
        }
        const emailUsername = rawEmail.toLowerCase().replace(/@.*$/, "").trim();
        if (!emailUsername) {
            setError("Please provide a valid Gmail username.");
            return;
        }

        if (!formData.registrationNumber.trim()) {
            setError("Please enter your College Registration Number.");
            return;
        }

        const cleanPhone = formData.whatsappNumber.trim();
        if (!/^[0-9]{10}$/.test(cleanPhone)) {
            setError("WhatsApp Number must be exactly 10 digits.");
            return;
        }

        if (!formData.branch) {
            setError("Please select your branch.");
            return;
        }

        if (!formData.section) {
            setError("Please select your section.");
            return;
        }

        setCurrentStep(2);
    };

    // Step 2 -> Move to Step 3
    const handleNextFromStep2 = () => {
        setError("");
        setCurrentStep(3);
    };

    // File selection for ACM WhatsApp Group Screenshot (Max 1MB)
    const handleAcmScreenshotChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 1 * 1024 * 1024) {
            setError(
                `ACM ID screenshot is too large (${(file.size / (1024 * 1024)).toFixed(2)} MB). Max limit is 1 MB. Please compress or take a smaller screenshot.`
            );
            if (acmFileInputRef.current) acmFileInputRef.current.value = "";
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result;
            setFormData((prev) => ({ ...prev, acmGroupScreenshot: base64 }));
            setPreviews((prev) => ({
                ...prev,
                acmGroup: {
                    url: base64,
                    name: file.name,
                    size: `${(file.size / 1024).toFixed(1)} KB`,
                },
            }));
            setError("");
        };
        reader.readAsDataURL(file);
    };

    // File selection for Payment Screenshot (Max 10MB)
    const handlePaymentScreenshotChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) {
            setError(
                `Payment screenshot is too large (${(file.size / (1024 * 1024)).toFixed(2)} MB). Max limit is 10 MB.`
            );
            if (paymentFileInputRef.current) paymentFileInputRef.current.value = "";
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result;
            setFormData((prev) => ({ ...prev, paymentScreenshot: base64 }));
            setPreviews((prev) => ({
                ...prev,
                payment: {
                    url: base64,
                    name: file.name,
                    size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
                },
            }));
            setError("");
        };
        reader.readAsDataURL(file);
    };

    const removeAcmScreenshot = (e) => {
        e.stopPropagation();
        setFormData((prev) => ({ ...prev, acmGroupScreenshot: "" }));
        setPreviews((prev) => ({ ...prev, acmGroup: null }));
        if (acmFileInputRef.current) acmFileInputRef.current.value = "";
    };

    const removePaymentScreenshot = (e) => {
        e.stopPropagation();
        setFormData((prev) => ({ ...prev, paymentScreenshot: "" }));
        setPreviews((prev) => ({ ...prev, payment: null }));
        if (paymentFileInputRef.current) paymentFileInputRef.current.value = "";
    };

    // Final Submission (Step 3)
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (formData.isAcmMember && !formData.acmGroupScreenshot) {
            setError("Please upload your ACM ID screenshot (Max 1MB).");
            return;
        }

        if (!formData.paymentScreenshot) {
            setError("Please upload your payment screenshot (Max 10MB).");
            return;
        }

        if (!formData.utrId.trim()) {
            setError("Please enter your Unique Transaction Reference (UTR) ID.");
            return;
        }

        if (!formData.declarationConfirmed) {
            setError("Please check the confirmation declaration to complete your registration.");
            return;
        }

        setLoading(true);

        try {
            const emailUsername = formData.email.trim().toLowerCase().replace(/@.*$/, "");
            const fullEmail = `${emailUsername}@gmail.com`;

            const payload = {
                ...formData,
                email: fullEmail,
                registrationNumber: formData.registrationNumber.trim().toUpperCase(),
                whatsappNumber: formData.whatsappNumber.trim(),
                utrId: formData.utrId.trim().toUpperCase(),
            };

            const response = await registerParticipant(payload);

            const submissionRecord = {
                name: formData.name,
                registrationNumber: payload.registrationNumber,
                branch: formData.branch,
                section: formData.section,
                isAcmMember: formData.isAcmMember,
                email: fullEmail,
                message: response.message,
                qrToken: response.registration?.qrToken,
                registeredAt: new Date().toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                }),
            };

            try {
                localStorage.setItem("xcelerate_registered_pass", JSON.stringify(submissionRecord));
            } catch (storageErr) {
                console.warn("Storage warning:", storageErr);
            }

            setExistingSubmission(submissionRecord);
            setSuccessData(submissionRecord);

            // Reset form
            setFormData({
                name: "",
                email: "",
                registrationNumber: "",
                branch: "",
                section: "",
                whatsappNumber: "",
                isAcmMember: false,
                acmGroupScreenshot: "",
                paymentScreenshot: "",
                utrId: "",
                declarationConfirmed: false,
            });
            setPreviews({ acmGroup: null, payment: null });
            setCurrentStep(1);
            if (acmFileInputRef.current) acmFileInputRef.current.value = "";
            if (paymentFileInputRef.current) paymentFileInputRef.current.value = "";
        } catch (err) {
            const msg =
                err.response?.data?.errors?.[0] ||
                err.response?.data?.message ||
                "Registration failed. Please check your inputs and network connection.";
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const renderTrackIcon = (id) => {
        switch (id) {
            case "ai-eng":
            case "ai":
                return (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="4" y="4" width="16" height="16" rx="2" />
                        <rect x="9" y="9" width="6" height="6" />
                        <line x1="9" y1="1" x2="9" y2="4" />
                        <line x1="15" y1="1" x2="15" y2="4" />
                        <line x1="9" y1="20" x2="9" y2="23" />
                        <line x1="15" y1="20" x2="15" y2="23" />
                        <line x1="20" y1="9" x2="23" y2="9" />
                        <line x1="20" y1="14" x2="23" y2="14" />
                        <line x1="1" y1="9" x2="4" y2="9" />
                        <line x1="1" y1="14" x2="4" y2="14" />
                    </svg>
                );
            case "aiml":
            case "ml":
                return (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="18" cy="5" r="3" />
                        <circle cx="6" cy="12" r="3" />
                        <circle cx="18" cy="19" r="3" />
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                    </svg>
                );
            case "iot-cyber":
            case "iot-security":
                return (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                );
            case "quantum":
                return (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="2" />
                        <ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(30 12 12)" />
                        <ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(-30 12 12)" />
                    </svg>
                );
            case "dsa":
                return (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="16 18 22 12 16 6" />
                        <polyline points="8 6 2 12 8 18" />
                    </svg>
                );
            case "software-dev":
                return (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                        <line x1="8" y1="21" x2="16" y2="21" />
                        <line x1="12" y1="17" x2="12" y2="21" />
                        <polyline points="7 10 9 12 7 14" />
                        <line x1="11" y1="12" x2="13" y2="12" />
                    </svg>
                );
            default:
                return (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>
                );
        }
    };

    const renderEventGuideBody = () => (
        <>
            {/* Overview Meta Strip */}
            <div className="event-overview-grid">
                <div className="event-info-chip">
                    <div className="event-info-chip-label">Event Format</div>
                    <div className="event-info-chip-val">{EVENT_DATA.meta.dates}</div>
                </div>
                <div className="event-info-chip">
                    <div className="event-info-chip-label">Daily Timings</div>
                    <div className="event-info-chip-val">{EVENT_DATA.meta.timing}</div>
                </div>
                <div className="event-info-chip">
                    <div className="event-info-chip-label">Campus Venue</div>
                    <div className="event-info-chip-val">{EVENT_DATA.meta.venue}</div>
                </div>
            </div>

            <div className="event-overview-desc">
                {EVENT_DATA.meta.description}
            </div>

            {/* Navigation Tabs */}
            <div className="event-tabs-bar">
                <button
                    type="button"
                    className={`event-tab-btn ${activeEventTab === "schedule" ? "active" : ""}`}
                    onClick={() => setActiveEventTab("schedule")}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    Schedule &amp; Domains
                </button>
                <button
                    type="button"
                    className={`event-tab-btn ${activeEventTab === "tracks" ? "active" : ""}`}
                    onClick={() => setActiveEventTab("tracks")}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                    Tracks &amp; Curriculum
                </button>
                <button
                    type="button"
                    className={`event-tab-btn ${activeEventTab === "perks" ? "active" : ""}`}
                    onClick={() => setActiveEventTab("perks")}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    Perks
                </button>
                <button
                    type="button"
                    className={`event-tab-btn ${activeEventTab === "faqs" ? "active" : ""}`}
                    onClick={() => setActiveEventTab("faqs")}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                    FAQs
                </button>
            </div>

            {/* TAB 1: SCHEDULE */}
            {activeEventTab === "schedule" && (
                <div>
                    <div className="day-switcher">
                        {EVENT_DATA.schedule.map((dayPlan, idx) => (
                            <button
                                key={dayPlan.day}
                                type="button"
                                className={`day-btn ${activeDayIndex === idx ? "active" : ""}`}
                                onClick={() => setActiveDayIndex(idx)}
                            >
                                {dayPlan.day}: {dayPlan.title}
                            </button>
                        ))}
                    </div>

                    {/* Day 2 Selectable Domain Workshop Highlight */}
                    {activeDayIndex === 1 && (
                        <div className="day2-domains-banner">
                            <div className="day2-banner-header">
                                <div className="day2-banner-title">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                    Day 2 Hands-on: Select 1 Domain
                                </div>
                                <span className="day2-banner-pill">Full-Day Lab</span>
                            </div>
                            <p className="day2-banner-desc">
                                On Day 2, students select 1 of the domains below for an intensive, dedicated full-day hands-on workshop:
                            </p>
                            <div className="day2-domains-grid">
                                {EVENT_DATA.day2Domains.map((dom) => (
                                    <div key={dom.id} className="day2-domain-card">
                                        <div className="day2-card-head">
                                            <div className="day2-card-title-group">
                                                <span className="day2-card-icon">
                                                    {renderTrackIcon(dom.id)}
                                                </span>
                                                <span className="day2-card-name">{dom.title}</span>
                                            </div>
                                            <span className="day2-card-tag">{dom.tag}</span>
                                        </div>
                                        <p className="day2-card-desc">{dom.desc}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="schedule-divider-badge">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>
                                Day 2 Schedule Timeline
                            </div>
                        </div>
                    )}

                    <div className="schedule-timeline">
                        {EVENT_DATA.schedule[activeDayIndex].sessions.map((session, sIdx) => (
                            <div key={sIdx} className="timeline-card">
                                <span className="timeline-time-badge">{session.time}</span>
                                <div className="timeline-body">
                                    <h4>{session.title}</h4>
                                    <p>{session.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB 2: TRACKS */}
            {activeEventTab === "tracks" && (
                <div className="tracks-details-grid">
                    <div className="schedule-divider-badge" style={{ margin: "0 0 4px" }}>
                        Day 1 &bull; Theory Curriculum (Morning &amp; Afternoon)
                    </div>
                    {EVENT_DATA.tracks.map((track) => (
                        <div key={track.id} className="track-detail-card">
                            <div className="track-detail-head">
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <span className="day2-card-icon">
                                        {renderTrackIcon(track.id)}
                                    </span>
                                    <span className="track-detail-title">{track.name}</span>
                                </div>
                                <span className="track-tag-pill">{track.tag}</span>
                            </div>
                            <p className="track-detail-desc">{track.summary}</p>
                        </div>
                    ))}

                    <div className="schedule-divider-badge" style={{ margin: "16px 0 4px" }}>
                        Day 2 &bull; Selectable Practical Domains (Pick 1 for All-Day Lab)
                    </div>
                    {EVENT_DATA.day2Domains.map((dom) => (
                        <div key={dom.id} className="track-detail-card">
                            <div className="track-detail-head">
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <span className="day2-card-icon">
                                        {renderTrackIcon(dom.id)}
                                    </span>
                                    <span className="track-detail-title">{dom.title}</span>
                                </div>
                                <span className="day2-banner-pill">{dom.tag}</span>
                            </div>
                            <p className="track-detail-desc">{dom.desc}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* TAB 3: PERKS */}
            {activeEventTab === "perks" && (
                <div className="perks-grid">
                    {EVENT_DATA.perks.map((perk, pIdx) => (
                        <div key={pIdx} className="perk-card">
                            <div className="perk-card-title">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                {perk.title}
                            </div>
                            <p>{perk.description}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* TAB 4: FAQS */}
            {activeEventTab === "faqs" && (
                <div className="faqs-list">
                    {EVENT_DATA.faqs.map((faq, fIdx) => (
                        <div key={fIdx} className="faq-card">
                            <h4>{faq.q}</h4>
                            <p>{faq.a}</p>
                        </div>
                    ))}
                </div>
            )}
        </>
    );

    return (
        <div className="app">
            <AsteroidsBackground />

            {/* HEADER */}
            <header className="site-header">
                <div className="header-inner">
                    <div className="brand">
                        <img src={aceLogo} alt="ACM Logo" className="header-logo" />
                        <div className="brand-text">
                            <strong>SRKR ACM CHAPTER</strong>
                            <span>STUDENT CHAPTER &bull; SRKR ENGINEERING COLLEGE</span>
                        </div>
                    </div>

                    <div className="header-event-badge">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                        Xcelerate-2K26
                    </div>
                </div>
            </header>

            {/* MAIN CONTENT */}
            <main className="main-content">
                {/* HERO BANNER */}
                <section className="hero-wrapper">
                    <div className="hero-pill-badge">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                        SRKR ACM Student Chapter Presents
                    </div>

                    <h1 className="hero-main-title">
                        Xcelerate-2K26
                    </h1>

                    <div className="hero-tagline-motto">
                        <span>Engage</span>
                        <span className="dot" />
                        <span>Explore</span>
                        <span className="dot" />
                        <span>Evolve</span>
                    </div>

                    <p className="hero-lead-text">
                        A 2-day technical symposium by SRKR ACM. Day 1 covers core theory, followed by a dedicated full-day hands-on workshop in your chosen domain on Day 2.
                    </p>

                    <div className="hero-meta-strip">
                        <div className="hero-meta-item">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                            2-Day Event
                        </div>
                        <div className="hero-meta-item">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                            SRKR ACM Chapter
                        </div>
                        <div className="hero-meta-item">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg>
                            SRKR Engineering College
                        </div>
                    </div>

                    <div className="hero-tracks-section">
                        <div className="hero-tracks-label">Core Tracks &amp; Domains</div>
                        <div className="hero-tracks-grid">
                            {EVENT_DATA.tracks.map((track) => (
                                <button
                                    key={track.id}
                                    type="button"
                                    className="hero-track-card"
                                    onClick={() => {
                                        setActiveEventTab("tracks");
                                        setShowEventModal(true);
                                    }}
                                    title="Click to view track curriculum"
                                >
                                    <span className="track-icon-box">
                                        {renderTrackIcon(track.id)}
                                    </span>
                                    {track.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="hero-action-buttons">
                        <button
                            type="button"
                            className="hero-details-trigger-btn"
                            onClick={() => {
                                setActiveEventTab("schedule");
                                setShowEventModal(true);
                            }}
                        >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                            View Event Guide &amp; Schedule
                        </button>
                    </div>

                    <div className="hero-scroll-cue">
                        <span>Register in 3 Quick Steps Below</span>
                        <svg className="cue-arrow-down" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </div>
                </section>

                {/* PROGRESSIVE FORM CONTAINER */}
                <section className="form-section">
                    <div className="registration-card">
                        {existingSubmission ? (
                            <div className="already-submitted-container">
                                <div className="submitted-status-icon">
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8">
                                        <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                </div>

                                <div className="submitted-status-badge">
                                    Registration Recorded
                                </div>

                                <h2 className="submitted-heading">
                                    You’ve already registered for Xcelerate-2K26!
                                </h2>

                                <p className="submitted-desc">
                                    Your response has already been submitted and confirmed from this device. Here is your official pass summary:
                                </p>

                                <div className="submitted-receipt-card">
                                    <div className="submitted-receipt-row">
                                        <span className="submitted-label">Attendee Name</span>
                                        <span className="submitted-val">{existingSubmission.name}</span>
                                    </div>
                                    <div className="submitted-receipt-row">
                                        <span className="submitted-label">Registration Number</span>
                                        <span className="submitted-val">{existingSubmission.registrationNumber}</span>
                                    </div>
                                    <div className="submitted-receipt-row">
                                        <span className="submitted-label">Branch &amp; Section</span>
                                        <span className="submitted-val">{existingSubmission.branch} - Sec {existingSubmission.section}</span>
                                    </div>
                                    <div className="submitted-receipt-row">
                                        <span className="submitted-label">Category</span>
                                        <span className="submitted-val">
                                            {existingSubmission.isAcmMember ? "ACM Body Member (2025–2029)" : "Regular Participant"}
                                        </span>
                                    </div>
                                    {existingSubmission.qrToken && (
                                        <div className="submitted-receipt-row">
                                            <span className="submitted-label">Attendance Pass</span>
                                            <span className="submitted-token-code">{existingSubmission.qrToken}</span>
                                        </div>
                                    )}
                                    <div className="submitted-receipt-row">
                                        <span className="submitted-label">Email Confirmation</span>
                                        <span className="submitted-val">{existingSubmission.email}</span>
                                    </div>
                                </div>

                                <div className="submitted-notice-box">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                                    <div>
                                        {existingSubmission.isAcmMember ? (
                                            <span>
                                                Your confirmation email has been dispatched to <strong>{existingSubmission.email}</strong>.
                                            </span>
                                        ) : (
                                            <span>
                                                Your personalized <strong>Attendance QR Code</strong> has been sent to <strong>{existingSubmission.email}</strong>. Please present it on both days of the event.
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* STEPPER PROGRESS BAR */}
                                <div className="stepper-nav">
                            <div className="stepper-line-bg" />
                            <div
                                className="stepper-line-progress"
                                style={{
                                    width: currentStep === 1 ? "0%" : currentStep === 2 ? "50%" : "92%",
                                }}
                            />

                            {/* NODE 1 */}
                            <button
                                type="button"
                                className={`step-node ${currentStep === 1 ? "active" : currentStep > 1 ? "completed" : ""}`}
                                onClick={() => currentStep > 1 && setCurrentStep(1)}
                            >
                                <div className="step-bubble">
                                    {currentStep > 1 ? (
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                    ) : (
                                        "1"
                                    )}
                                </div>
                                <span className="step-title">Student Info</span>
                            </button>

                            {/* NODE 2 */}
                            <button
                                type="button"
                                className={`step-node ${currentStep === 2 ? "active" : currentStep > 2 ? "completed" : ""}`}
                                onClick={() => currentStep > 2 && setCurrentStep(2)}
                                disabled={currentStep < 2}
                            >
                                <div className="step-bubble">
                                    {currentStep > 2 ? (
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                    ) : (
                                        "2"
                                    )}
                                </div>
                                <span className="step-title">Membership</span>
                            </button>

                            {/* NODE 3 */}
                            <button
                                type="button"
                                className={`step-node ${currentStep === 3 ? "active" : ""}`}
                                disabled={currentStep < 3}
                            >
                                <div className="step-bubble">3</div>
                                <span className="step-title">Payment &amp; Pass</span>
                            </button>
                        </div>

                        {/* ========================================================
                            SECTION 1: STUDENT DETAILS
                        ======================================================== */}
                        {currentStep === 1 && (
                            <div className="step-pane">
                                <div className="step-header-box">
                                    <span className="step-header-tag">Step 01 of 03</span>
                                    <h3 className="step-header-title">Student Academic Information</h3>
                                    <p className="step-header-desc">
                                        Please provide your genuine details as recorded in college.
                                    </p>
                                </div>

                                {/* 1. FULL NAME */}
                                <div className="field">
                                    <label>
                                        <svg className="field-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                        Full Name <span className="req-star">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        placeholder="e.g. Gopala Krishna Saketh"
                                        required
                                    />
                                </div>

                                {/* 2. EMAIL (CONCAT @gmail.com) */}
                                <div className="field">
                                    <label>
                                        <svg className="field-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                                        Gmail Address <span className="req-star">*</span>
                                    </label>
                                    <div className="email-input-wrapper">
                                        <input
                                            type="text"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleChange}
                                            placeholder="Enter your Gmail username"
                                            required
                                        />
                                        <span className="gmail-suffix">@gmail.com</span>
                                    </div>
                                    <span style={{ fontSize: "12px", color: "#64748b", marginTop: "4px", display: "block" }}>
                                        Event pass and confirmation will be delivered to this Gmail address.
                                    </span>
                                </div>

                                {/* 3. REGISTRATION NUMBER & 6. WHATSAPP (2 COLUMNS) */}
                                <div className="grid-2-col">
                                    <div className="field">
                                        <label>
                                            <svg className="field-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="16" rx="2"></rect><line x1="7" y1="8" x2="17" y2="8"></line><line x1="7" y1="12" x2="17" y2="12"></line><line x1="7" y1="16" x2="13" y2="16"></line></svg>
                                            Registration Number <span className="req-star">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="registrationNumber"
                                            value={formData.registrationNumber}
                                            onChange={handleChange}
                                            placeholder="e.g. 23B91A05XX"
                                            style={{ textTransform: "uppercase" }}
                                            required
                                        />
                                    </div>

                                    <div className="field">
                                        <label>
                                            <svg className="field-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                            WhatsApp Number <span className="req-star">*</span>
                                        </label>
                                        <input
                                            type="tel"
                                            name="whatsappNumber"
                                            value={formData.whatsappNumber}
                                            onChange={handleChange}
                                            placeholder="10-digit mobile number"
                                            pattern="[0-9]{10}"
                                            maxLength="10"
                                            required
                                        />
                                    </div>
                                </div>

                                {/* 4. BRANCH & 5. SECTION (2 COLUMNS) */}
                                <div className="grid-2-col">
                                    <div className="field">
                                        <label>
                                            <svg className="field-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"></path><path d="M6 12v5c3 3 9 3 12 0v-5"></path></svg>
                                            Branch <span className="req-star">*</span>
                                        </label>
                                        <select
                                            name="branch"
                                            value={formData.branch}
                                            onChange={handleChange}
                                            required
                                        >
                                            <option value="">Select Branch</option>
                                            {BRANCH_OPTIONS.map((branch) => (
                                                <option key={branch} value={branch}>
                                                    {branch}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="field">
                                        <label>
                                            <svg className="field-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
                                            Section <span className="req-star">*</span>
                                        </label>
                                        <select
                                            name="section"
                                            value={formData.section}
                                            onChange={handleChange}
                                            required
                                        >
                                            <option value="">Select Section</option>
                                            {SECTION_OPTIONS.map((sec) => (
                                                <option key={sec} value={sec}>
                                                    Section {sec}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* ERROR NOTIFICATION */}
                                {error && (
                                    <div className="error-message" style={{ margin: "16px 0 8px" }}>
                                        {error}
                                    </div>
                                )}

                                {/* STEP 1 ACTION BUTTON */}
                                <div className="step-nav-row">
                                    <button
                                        type="button"
                                        className="btn-nav-next"
                                        onClick={handleNextFromStep1}
                                    >
                                        Continue to Chapter Status
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ========================================================
                            SECTION 2: ACM BODY MEMBERSHIP SELECTION
                        ======================================================== */}
                        {currentStep === 2 && (
                            <div className="step-pane">
                                <div className="step-header-box">
                                    <span className="step-header-tag">Step 02 of 03</span>
                                    <h3 className="step-header-title">ACM Chapter Membership</h3>
                                    <p className="step-header-desc">
                                        Select whether you are a registered ACM Council Member or a General Attendee.
                                    </p>
                                </div>

                                <div className="field">
                                    <label style={{ fontSize: "14px", marginBottom: "12px" }}>
                                        Are you an active ACM Body Member? <span className="req-star">*</span>
                                    </label>
                                    <div className="acm-member-select-grid">
                                        <div
                                            className={`acm-member-card ${!formData.isAcmMember ? "active" : ""}`}
                                            onClick={() => handleAcmToggle(false)}
                                        >
                                            <input
                                                type="radio"
                                                name="isAcmMember"
                                                checked={!formData.isAcmMember}
                                                onChange={() => handleAcmToggle(false)}
                                            />
                                            <div className="acm-card-body">
                                                <h4>No, Regular Participant</h4>
                                                <p>I am attending the two-day symposium (A personalized Attendance QR pass will be emailed to you).</p>
                                            </div>
                                        </div>

                                        <div
                                            className={`acm-member-card ${formData.isAcmMember ? "active" : ""}`}
                                            onClick={() => handleAcmToggle(true)}
                                        >
                                            <input
                                                type="radio"
                                                name="isAcmMember"
                                                checked={formData.isAcmMember}
                                                onChange={() => handleAcmToggle(true)}
                                            />
                                            <div className="acm-card-body">
                                                <h4>Yes, ACM Body Member</h4>
                                                <p>Batch 2025–2029 (Requires your assigned ACM ID screenshot verification).</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {error && (
                                    <div className="error-message" style={{ margin: "16px 0 8px" }}>
                                        {error}
                                    </div>
                                )}

                                {/* STEP 2 BUTTONS */}
                                <div className="step-nav-row">
                                    <button
                                        type="button"
                                        className="btn-nav-back"
                                        onClick={() => {
                                            setError("");
                                            setCurrentStep(1);
                                        }}
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
                                        Back to Info
                                    </button>

                                    <button
                                        type="button"
                                        className="btn-nav-next"
                                        onClick={handleNextFromStep2}
                                    >
                                        Continue to Payment &amp; Pass
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ========================================================
                            SECTION 3: PAYMENT, PROOF & DECLARATION
                        ======================================================== */}
                        {currentStep === 3 && (
                            <form onSubmit={handleSubmit} noValidate className="step-pane">
                                <div className="step-header-box">
                                    <span className="step-header-tag">Step 03 of 03</span>
                                    <h3 className="step-header-title">Registration Payment &amp; Confirmation</h3>
                                    <p className="step-header-desc">
                                        Scan the QR code, upload payment proof, and complete your registration.
                                    </p>
                                </div>

                                {/* 1. PAYMENT QR CARD (FOR BOTH YES & NO) */}
                                <div className="payment-qr-card">
                                    <h4 style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a", marginBottom: "4px" }}>
                                        Scan &amp; Pay via UPI
                                    </h4>
                                    <p style={{ fontSize: "13px", color: "#64748b", marginBottom: "8px" }}>
                                        Google Pay &bull; PhonePe &bull; Paytm &bull; BHIM
                                    </p>

                                    <div className="qr-placeholder-box">
                                        <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                                            <rect x="3" y="3" width="7" height="7"></rect>
                                            <rect x="14" y="3" width="7" height="7"></rect>
                                            <rect x="14" y="14" width="7" height="7"></rect>
                                            <rect x="3" y="14" width="7" height="7"></rect>
                                            <line x1="7" y1="17" x2="7" y2="17.01"></line>
                                            <line x1="17" y1="7" x2="17" y2="7.01"></line>
                                        </svg>
                                        <span className="qr-placeholder-text">PAYMENT QR CODE</span>
                                        <span style={{ fontSize: "10px", color: "#94a3b8", marginTop: "2px" }}>[Placeholder]</span>
                                    </div>

                                    <div className="upi-id-badge">
                                        UPI ID: srkr.acm@upi
                                    </div>
                                    <p style={{ fontSize: "12px", color: "#64748b", marginTop: "8px" }}>
                                        Make payment, copy the 12-digit UTR ID, and upload the transaction screenshot below.
                                    </p>
                                </div>

                                {/* 2. IF ACM MEMBER: ACM ID SCREENSHOT (MAX 1MB) */}
                                {formData.isAcmMember && (
                                    <div className="file-upload-block">
                                        <label>
                                            <span>
                                                ACM ID <span className="req-star">*</span>
                                            </span>
                                            <span className="file-size-badge">Max 1 MB</span>
                                        </label>

                                        <input
                                            type="file"
                                            accept="image/png, image/jpeg, image/jpg, image/webp"
                                            ref={acmFileInputRef}
                                            style={{ display: "none" }}
                                            onChange={handleAcmScreenshotChange}
                                        />

                                        {!previews.acmGroup ? (
                                            <div
                                                className="file-dropzone"
                                                onClick={() => acmFileInputRef.current?.click()}
                                            >
                                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                                <div className="file-dropzone-prompt">
                                                    <strong>Click to upload</strong> or drag &amp; drop ACM ID screenshot
                                                </div>
                                                <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                                                    PNG, JPG or WEBP (Max 1 MB)
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="file-preview-card">
                                                <img src={previews.acmGroup.url} alt="ACM ID Screenshot Preview" className="preview-thumb" />
                                                <div className="preview-meta">
                                                    <div className="preview-name">{previews.acmGroup.name}</div>
                                                    <div className="preview-size">{previews.acmGroup.size} &bull; Ready</div>
                                                </div>
                                                <button type="button" className="preview-remove-btn" onClick={removeAcmScreenshot}>
                                                    Remove
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* 3. PAYMENT SCREENSHOT (MAX 10MB) - FOR BOTH */}
                                <div className="file-upload-block">
                                    <label>
                                        <span>
                                            Payment Transaction Screenshot <span className="req-star">*</span>
                                        </span>
                                        <span className="file-size-badge">Max 10 MB</span>
                                    </label>

                                    <input
                                        type="file"
                                        accept="image/png, image/jpeg, image/jpg, image/webp"
                                        ref={paymentFileInputRef}
                                        style={{ display: "none" }}
                                        onChange={handlePaymentScreenshotChange}
                                    />

                                    {!previews.payment ? (
                                        <div
                                            className="file-dropzone"
                                            onClick={() => paymentFileInputRef.current?.click()}
                                        >
                                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                                            <div className="file-dropzone-prompt">
                                                <strong>Click to upload</strong> or drag &amp; drop Payment Screenshot
                                            </div>
                                            <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                                                PNG, JPG or WEBP (Max 10 MB)
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="file-preview-card">
                                            <img src={previews.payment.url} alt="Payment Screenshot Preview" className="preview-thumb" />
                                            <div className="preview-meta">
                                                <div className="preview-name">{previews.payment.name}</div>
                                                <div className="preview-size">{previews.payment.size} &bull; Ready</div>
                                            </div>
                                            <button type="button" className="preview-remove-btn" onClick={removePaymentScreenshot}>
                                                Remove
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* 4. UNIQUE TRANSACTION REFERENCE (UTR) ID */}
                                <div className="field" style={{ marginTop: "18px" }}>
                                    <label>
                                        <svg className="field-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
                                        Unique Transaction Reference (UTR) ID <span className="req-star">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="utrId"
                                        value={formData.utrId}
                                        onChange={handleChange}
                                        placeholder="e.g. 4028XXXXXXXX or UPI Reference Number"
                                        style={{ textTransform: "uppercase" }}
                                        required
                                    />
                                </div>

                                {/* 5. DECLARATION CHECKBOX */}
                                <div className="declaration-container">
                                    <label className="declaration-label">
                                        <input
                                            type="checkbox"
                                            name="declarationConfirmed"
                                            checked={formData.declarationConfirmed}
                                            onChange={handleChange}
                                            required
                                        />
                                        <span>
                                            {formData.isAcmMember
                                                ? "I confirm that I am an active ACM Body Member (2025–2029) and the submitted details, ACM ID screenshot, and payment proof are genuine."
                                                : "I confirm that the details provided, registration information, and payment screenshot are genuine and authentic."}
                                        </span>
                                    </label>
                                </div>

                                {/* ERROR BANNER */}
                                {error && (
                                    <div className="error-message" style={{ margin: "16px 0 8px" }}>
                                        {error}
                                    </div>
                                )}

                                {/* STEP 3 ACTION BUTTONS */}
                                <div className="step-nav-row">
                                    <button
                                        type="button"
                                        className="btn-nav-back"
                                        onClick={() => {
                                            setError("");
                                            setCurrentStep(2);
                                        }}
                                        disabled={loading}
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
                                        Back to Status
                                    </button>

                                    <button
                                        type="submit"
                                        className="btn-nav-next"
                                        disabled={loading}
                                        style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", boxShadow: "0 4px 16px rgba(22, 163, 74, 0.4)" }}
                                    >
                                        {loading ? (
                                            <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                <span style={{ width: "16px", height: "16px", border: "2px solid #ffffff", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
                                                Processing...
                                            </span>
                                        ) : (
                                            <>
                                                Complete Registration
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        )}
                            </>
                        )}
                    </div>
                </section>

                {/* EVENT GUIDE & SYMPOSIUM DETAILS */}
                <section className="event-guide-section" id="event-guide">
                    <div className="event-guide-card">
                        <div className="event-guide-header">
                            <span className="event-guide-badge">Symposium Guide</span>
                            <h2 className="event-guide-title">Event Schedule &amp; Domains</h2>
                            <p className="event-guide-subtitle">
                                Day 1 theory sessions &bull; Day 2 dedicated full-day domain workshop.
                            </p>
                        </div>
                        {renderEventGuideBody()}
                    </div>
                </section>
            </main>

            {/* EVENT GUIDE MODAL */}
            {showEventModal && (
                <div className="event-modal-backdrop" onClick={() => setShowEventModal(false)}>
                    <div className="event-modal-card" onClick={(e) => e.stopPropagation()}>
                        <div className="event-modal-header">
                            <div>
                                <span className="event-guide-badge">Event Guide</span>
                                <h3 style={{ fontSize: "20px", fontWeight: "800", color: "#0f172a", margin: "4px 0 0" }}>
                                    Xcelerate-2K26 Schedule &amp; Domains
                                </h3>
                            </div>
                            <button
                                type="button"
                                className="event-modal-close-btn"
                                onClick={() => setShowEventModal(false)}
                                title="Close Guide"
                                aria-label="Close Guide"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                        {renderEventGuideBody()}
                    </div>
                </div>
            )}

            {/* SUCCESS CONFIRMATION MODAL */}
            {successData && (
                <div className="success-modal-backdrop">
                    <div className="success-modal-card">
                        <div className="success-icon-badge">
                            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                        </div>

                        <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#0f172a", marginBottom: "8px" }}>
                            Registration Successful!
                        </h2>

                        <p style={{ fontSize: "14px", color: "#64748b", margin: "0 0 16px" }}>
                            Welcome to <strong>Xcelerate-2K26</strong>!
                        </p>

                        <div className="success-receipt-details">
                            <div className="receipt-row">
                                <span className="receipt-label">Student Name</span>
                                <span className="receipt-val">{successData.name}</span>
                            </div>
                            <div className="receipt-row">
                                <span className="receipt-label">Reg Number</span>
                                <span className="receipt-val">{successData.registrationNumber}</span>
                            </div>
                            <div className="receipt-row">
                                <span className="receipt-label">Branch &amp; Section</span>
                                <span className="receipt-val">{successData.branch} - Sec {successData.section}</span>
                            </div>
                            <div className="receipt-row">
                                <span className="receipt-label">Category</span>
                                <span className="receipt-val">
                                    {successData.isAcmMember ? "ACM Body Member (2025–2029)" : "Regular Attendee"}
                                </span>
                            </div>
                            {successData.qrToken && (
                                <div className="receipt-row">
                                    <span className="receipt-label">Attendance Pass</span>
                                    <span className="receipt-val" style={{ color: "#2563eb", fontFamily: "monospace" }}>
                                        {successData.qrToken}
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className="success-email-notice">
                            {successData.isAcmMember ? (
                                <span>
                                    Confirmation email has been dispatched to <strong>{successData.email}</strong>.
                                </span>
                            ) : (
                                <span>
                                    Your personalized <strong>Attendance QR Code</strong> has been generated and sent to <strong>{successData.email}</strong> for scanning on both days.
                                </span>
                            )}
                        </div>

                        <button
                            type="button"
                            className="success-modal-btn"
                            onClick={() => setSuccessData(null)}
                        >
                            Close &amp; View Pass
                        </button>
                    </div>
                </div>
            )}

            {/* SITE FOOTER */}
            <footer className="site-footer">
                <div className="footer-inner">
                    <p style={{ fontSize: "13px", color: "#64748b" }}>
                        &copy; 2026 SRKR ACM Student Chapter &bull; SRKR Engineering College (Autonomous)
                    </p>
                </div>
            </footer>
        </div>
    );
}
