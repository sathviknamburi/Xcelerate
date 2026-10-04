# Comprehensive Technical Audit & Architecture Review
**Project:** Xcelerate-2K26 Registration Portal (SRKR ACM Student Chapter)  
**Date:** March 2026 / Local Audit  
**Scope:** Backend (Node.js/Express/MongoDB), Frontend (React 19/Vite), Security, Performance, and Business Logic  

---

## 1. Executive Summary & Health Scorecard

The **Xcelerate-2K26** platform is a full-stack registration and attendee management application designed for a 2-day technical symposium organized by the SRKR ACM Student Chapter. The project features a modern responsive UI, multi-step registration workflow, UPI payment verification, QR attendance pass generation, and automated email dispatch via Brevo.

While the user interface design and styling are polished, this audit has uncovered **critical security vulnerabilities**, **database race conditions**, **architectural scalability bottlenecks**, and **functional disconnects between the published event schedule and the registration schema**.

### Overall System Health: `62 / 100 (Needs Remediation Before Production Launch)`

| Category | Score | Status | Primary Concern |
| :--- | :---: | :---: | :--- |
| **Security & Privacy** | **45 / 100** | 🔴 Critical | Reflected XSS, Public PII enumeration, and wildcard CORS |
| **Data Integrity & DB** | **58 / 100** | 🟠 High Risk | Missing unique DB indexes, concurrent race conditions, base64 image bloat |
| **Performance & Scale** | **65 / 100** | 🟡 Moderate | Blocking synchronous email dispatch during HTTP requests |
| **Business Logic** | **68 / 100** | 🟡 Moderate | Missing Day 2 workshop domain field; orphaned auth portal |
| **Frontend Architecture** | **74 / 100** | 🟢 Fair | Monolithic `App.jsx` (1,375 lines); production URL resolution bug |
| **Code Hygiene & Docs** | **60 / 100** | 🟡 Moderate | Stale dependencies (`pdf-lib`, `pngjs`) and outdated `README.md` |

---

## 2. Critical Security Vulnerabilities

### 2.1. Reflected Cross-Site Scripting (XSS) in Attendee Verification
- **File:** `backend/controllers/verifyController.js` (Lines 82, 105)
- **Severity:** 🔴 **CRITICAL**
- **Description:**  
  The endpoint `GET /verify/:aceId` takes user input directly from URL params (`req.params.aceId`) and query params (`req.query.token`), and interpolates it unescaped directly into an HTML string sent back to the browser via `res.send()`:
  ```javascript
  // Line 105:
  <p style="font-family: monospace; color: #9ca3af; background: #1f2937; padding: 10px; border-radius: 8px;">
      ${query}
  </p>
  ```
  Additionally, `${participant.name}` is rendered without HTML entity encoding.
- **Impact:** An attacker can craft a malicious link such as `https://<domain>/verify/<script>alert(document.cookie)</script>` or inject malicious iframes/redirects.
- **Remediation:**  
  Sanitize and HTML-encode any user input before interpolating it into HTML templates, or use a proper templating engine with automatic output escaping.

---

### 2.2. Public PII Enumeration & Attendance Pass Scraping
- **File:** `backend/controllers/verifyController.js` (Lines 125–131)
- **Severity:** 🔴 **CRITICAL**
- **Description:**  
  The verification query searches by QR token, registration number, OR email address:
  ```javascript
  const participant = await Registration.findOne({
      $or: [
          { qrToken: query },
          { registrationNumber: query.toUpperCase() },
          { email: query.toLowerCase() },
      ],
  });
  ```
  Because registration numbers follow a known sequential pattern (e.g. `23B91A0501`, `23B91A0502`), anyone can write a script to scrape every registered student's full name, branch, section, membership status, and private attendance QR pass token. Furthermore, this endpoint has **no rate limiter**.
- **Impact:** Complete exposure of student directory and forgery of attendance passes.
- **Remediation:**  
  1. Only allow verification via the cryptographically generated `qrToken` (never by public registration number or email).  
  2. Apply rate limiting (`express-rate-limit`) to the `/verify` route.  
  3. Require admin authentication for detailed attendee lookup.

---

### 2.3. Insecure Wildcard CORS Configuration with Credentials Enabled
- **File:** `backend/app.js` (Lines 24–52)
- **Severity:** 🟠 **HIGH**
- **Description:**  
  In `app.js`, `isAllowedOrigin` has an unconditional fallback:
  ```javascript
  const isAllowedOrigin = (origin) => {
      // ...
      return true; // For student registration API, allow incoming registration requests
  };
  ```
  And in `corsOptions`:
  ```javascript
  const corsOptions = {
      origin: (origin, callback) => {
          if (isAllowedOrigin(origin)) {
              return callback(null, true);
          }
          return callback(null, true); // Always true
      },
      credentials: true, // Vulnerable when combined with reflection
  };
  ```
  Express CORS reflects the requesting `Origin` back into `Access-Control-Allow-Origin` while setting `Access-Control-Allow-Credentials: true`.
- **Impact:** Any malicious website visited by an admin or user can perform cross-site credentialed requests against the backend.
- **Remediation:**  
  Strictly validate against an explicit whitelist of allowed origins (`FRONTEND_URL` in `.env`), and return `callback(new Error('Not allowed by CORS'))` when an unknown origin is detected.

---

### 2.4. Hardcoded Fallback Secret in Session Token Generation
- **File:** `backend/controllers/authController.js` (Line 3)
- **Severity:** 🟠 **HIGH**
- **Description:**  
  ```javascript
  const getSecret = () => process.env.AUTH_SECRET || "ace_freshers_default_auth_key_2026";
  ```
  If `AUTH_SECRET` is omitted from the deployment environment, tokens are signed using a predictable publicly visible string. Anyone reading the repository or default keys can forge valid admin session tokens.
- **Remediation:**  
  Remove the fallback. Fail fast on server startup if `AUTH_SECRET` is not set.

---

## 3. Database & Data Integrity Audit

### 3.1. Missing Database-Level Unique Indexes (Concurrency Race Condition)
- **File:** `backend/models/Registration.js` vs `backend/services/registrationService.js`
- **Severity:** 🟠 **HIGH**
- **Description:**  
  In `models/Registration.js`:
  - `registrationNumber`: defined with `{ index: true }`, but **NOT** `{ unique: true }`.
  - `utrId`: defined with **NO index and NO unique constraint**.
  - Only `email` and `qrToken` have unique constraints.
  
  In `services/registrationService.js` (Lines 37–58), the system relies on an application-level `findOne()` check before calling `Registration.create()`. Under concurrent traffic (e.g. students registering simultaneously at a desk or sharing a UTR transaction ID), two requests will pass `findOne()` at the exact same millisecond and both will be inserted into the database.
- **Remediation:**  
  Add `unique: true` to `registrationNumber` and `utrId` in `registrationSchema`:
  ```javascript
  registrationNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
  },
  utrId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
  }
  ```

---

### 3.2. Base64 Image Storage Inside MongoDB Documents (16MB BSON Limit Risk)
- **File:** `backend/models/Registration.js` (Lines 66–69) & `backend/app.js` (Line 54)
- **Severity:** 🟠 **HIGH**
- **Description:**  
  The application accepts up to 10MB payment screenshots and 1MB ACM ID screenshots as raw base64 data URLs inside JSON (`express.json({ limit: "25mb" })`) and saves them directly as string fields in MongoDB documents.
  - Storing multi-megabyte base64 strings directly in MongoDB documents bloats document sizes dramatically.
  - Base64 encoding inflates binary file size by ~33% (a 10MB image becomes ~13.7MB of string data). If both screenshots are uploaded near max limits, the document can exceed MongoDB's strict **16MB BSON document limit**, causing registration writes to fail.
  - It severely degrades database RAM cache (WiredTiger buffer cache), slows down queries, and inflates backup sizes.
- **Remediation:**  
  Offload image uploads to an object store (Cloudinary, AWS S3, or Supabase Storage) and store only the secure image URLs in the MongoDB document.

---

### 3.3. Stale Schema References in Error Middleware
- **File:** `backend/middleware/errorMiddleware.js` (Lines 24–34)
- **Severity:** 🟡 **MEDIUM**
- **Description:**  
  The MongoDB duplicate key handler (`error.code === 11000`) checks for fields `duplicateField === "phone"` and `duplicateField === "aceId"`.
  However, in the active schema, the field is named `whatsappNumber`, and `aceId` has been replaced by `qrToken` and `registrationNumber`. If a duplicate error occurs for these fields, the user receives an improper generic message instead of a friendly validation message.

---

## 4. Performance & Scalability Bottlenecks

### 4.1. Synchronous Blocking Email Delivery in the Registration Request Cycle
- **File:** `backend/services/registrationService.js` (Lines 82–96) & `backend/services/emailService.js` (Lines 267–280)
- **Severity:** 🟠 **HIGH**
- **Description:**  
  When a participant submits the form, the backend halts the HTTP request and awaits `sendRegistrationEmailWithRetry()`:
  - If Brevo experiences latency or an attempt fails, it retries up to 3 times with progressive delays (`1000ms`, `2000ms`).
  - The client's HTTP request hangs for 10–30+ seconds.
  - If deployed on serverless infrastructure (e.g. Vercel, Render free tier, AWS Lambda), the request will hit the gateway timeout (10s or 15s), causing the user's browser to display a failure error even though the record was already committed to the database.
- **Remediation:**  
  Decouple email sending from the registration transaction. Save the registration record with `emailStatus: "Pending"`, return the HTTP 201 response immediately, and trigger the email dispatch asynchronously in the background (or via a lightweight message queue / worker).

---

### 4.2. In-Memory Rate Limiting in Multi-Instance Environments
- **File:** `backend/routes/registerRoutes.js` (Line 14) & `backend/routes/authRoutes.js` (Line 11)
- **Severity:** 🟡 **MEDIUM**
- **Description:**  
  `express-rate-limit` is configured with default in-memory storage. If the backend is deployed on multiple server instances, clustered with PM2, or deployed on serverless containers, rate limiting is not shared across instances.
- **Remediation:**  
  Use `rate-limit-redis` or a shared memory store for production multi-replica deployments.

---

## 5. Business Logic & Functional Discrepancies

### 5.1. Missing Day 2 Hands-on Workshop Domain Selection Field
- **File:** `frontend/src/App.jsx`, `backend/models/Registration.js`, `backend/middleware/validationMiddleware.js`
- **Severity:** 🟠 **HIGH**
- **Description:**  
  The event schedule and guide (`eventContent.js`, hero banner, modal) heavily advertise:
  > *"Day 2 is a dedicated, full-day practical workshop where students select and work exclusively in 1 domain (AI/ML, Software Development, IoT & Cybersecurity, Quantum Computing)."*
  
  However, **neither the registration form in `App.jsx`, nor the Joi schema, nor the Mongoose model has a field for students to select their chosen Day 2 domain!**
- **Impact:** The event organizers will have no record of which domain lab each participant intends to attend, making lab capacity planning and seat allocation impossible.
- **Remediation:**  
  Add a `selectedDomain` field to Step 1 or Step 2 of `App.jsx`, validate it against `EVENT_DATA.day2Domains` in `validationMiddleware.js`, and store it in `Registration.js`.

---

### 5.2. Orphaned Authentication Flow
- **File:** `frontend/src/components/LoginPage.jsx` vs `frontend/src/App.jsx`
- **Severity:** 🟡 **MEDIUM**
- **Description:**  
  The backend implements an access code authentication system (`/api/auth/login`, `/api/auth/verify-session`). The frontend has a complete `LoginPage.jsx` component. However, `LoginPage.jsx` is **never imported or rendered** anywhere in `App.jsx` or `main.jsx`.
- **Impact:** The registration portal is completely open to the public without the passcode gatekeeper that was designed for it.
- **Remediation:**  
  Either integrate `LoginPage` in `App.jsx` so unauthenticated visitors must provide the pass code before accessing the registration form, or remove the dead authentication code if the portal is intended to be public.

---

### 5.3. Device-Locking via LocalStorage without "Register Another" Escape Hatch
- **File:** `frontend/src/App.jsx` (Lines 33–40, 680–745)
- **Severity:** 🟡 **MEDIUM**
- **Description:**  
  Once a student registers on a device, a record is stored in `localStorage.getItem("xcelerate_registered_pass")`. When this key exists, `App.jsx` replaces the registration form with an *"You’ve already registered"* card.
  In college environments, students frequently use a shared laptop, campus lab machine, or registration desk terminal to register friends. With the current implementation, any subsequent student is locked out unless they open dev tools to clear localStorage or switch to incognito mode.
- **Remediation:**  
  Add a clear button on the pass card: *"Register Another Participant"*, which resets the active view without deleting the prior pass copy.

---

### 5.4. Hardcoded `@gmail.com` Domain Restriction
- **File:** `backend/middleware/validationMiddleware.js` (Lines 41–56) & `frontend/src/App.jsx` (Line 846)
- **Severity:** 🟡 **MEDIUM**
- **Description:**  
  The validation middleware strictly permits only `@gmail.com` addresses. Any student attempting to use a college email (e.g. `@srkr.ac.in`) or other domains (Outlook, iCloud, Yahoo) is rejected.
- **Remediation:**  
  If intentional, ensure clear messaging is shown. If institutional or other standard email providers should be accepted, allow standard RFC 5322 email patterns.

---

## 6. Frontend Architecture & Client-Side Issues

### 6.1. Broken API URL Fallback in Production Deployments
- **File:** `frontend/src/services/registrationApi.js` (Lines 14–22) & `frontend/src/services/authApi.js` (Lines 9–17)
- **Severity:** 🟠 **HIGH**
- **Description:**  
  ```javascript
  if (typeof window !== "undefined" && window.location && window.location.hostname) {
      const hostname = window.location.hostname;
      if (hostname !== "localhost" && hostname !== "127.0.0.1") {
          return `http://${hostname}:5000/api`;
      }
  }
  ```
  If `VITE_API_URL` is omitted in production (e.g. on Vercel or Netlify), `hostname` will be `my-portal.vercel.app`. The client will attempt to send HTTP API requests to `http://my-portal.vercel.app:5000/api`, triggering **Mixed Content (HTTPS -> HTTP) blocked by browsers** and connection timeouts.
- **Remediation:**  
  Only fall back to `http://${hostname}:5000/api` if `hostname` matches a local private IP address (`192.168.*`, `10.*`, `172.*`). For production, default to `""` (relative paths) or mandate `VITE_API_URL`.

---

### 6.2. Monolithic Component Structure & CSS File Size
- **File:** `frontend/src/App.jsx` (1,375 lines, 76 KB) & `frontend/src/index.css` (114 KB)
- **Severity:** 🟡 **MEDIUM**
- **Description:**  
  `App.jsx` houses the Hero banner, the 3-step registration wizard, the complete event guide modal, the success modal, the already-registered pass card, and all track SVG icons.
- **Remediation:**  
  Decompose `App.jsx` into modular components:
  - `components/HeroBanner.jsx`
  - `components/EventGuideModal.jsx`
  - `components/RegistrationWizard/Step1Info.jsx`
  - `components/RegistrationWizard/Step2Membership.jsx`
  - `components/RegistrationWizard/Step3Payment.jsx`
  - `components/RegistrationReceipt.jsx`

---

## 7. Code Hygiene & Outdated Artifacts

### 7.1. Dead Backend Dependencies
- **File:** `backend/package.json` (Lines 22–23)
- **Description:**  
  `pdf-lib` and `pngjs` are installed in `dependencies`. These were used in an older version of the portal for certificate generation, but are no longer imported anywhere in `backend/`.
- **Remediation:**  
  Run `npm uninstall pdf-lib pngjs` in `backend/` to reduce bundle and installation overhead.

### 7.2. Outdated Documentation (`README.md`)
- **File:** `README.md`
- **Description:**  
  The root `README.md` references features from an earlier iteration:
  - *"Atomic ACE ID Allocation (`26ACEA001`, `26ACEB001`)"*
  - *"Dynamic Certificate Generation with PDF signatures"*
  - Non-existent directories: `signatures/`, `templates/`, `models/AceIdConfig.js`, `models/OneTimeLink.js`.
- **Remediation:**  
  Update `README.md` to reflect the active Xcelerate-2K26 architecture (QR token generation, 2-day symposium structure, and Brevo notification pipeline).

---

## 8. Prioritized Remediation Roadmap

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PRIORITY ACTION PLAN                            │
└────────────────────────────────────────────────────────────────────────┘

  🔴 PHASE 1: IMMEDIATE CRITICAL FIXES (Must fix before public access)
  ├── 1. Fix Reflected XSS in verifyController.js (Escape query / attendee data)
  ├── 2. Restrict verification lookup strictly to qrToken (Stop PII enumeration)
  ├── 3. Enforce strict CORS whitelist in app.js
  ├── 4. Add unique indexes to registrationNumber and utrId in Registration.js
  └── 5. Remove hardcoded fallback auth secret in authController.js

  🟠 PHASE 2: FUNCTIONAL & ARCHITECTURAL IMPROVEMENTS
  ├── 6. Add Day 2 Practical Workshop Domain selection field to form & schema
  ├── 7. Make email delivery asynchronous (Don't block registration HTTP response)
  ├── 8. Offload image uploads to Cloudinary/S3 instead of raw base64 in MongoDB
  ├── 9. Add "Register Another Attendee" button on the local pass screen
  └── 10. Fix getBaseUrl() hostname fallback logic for production deployments

  🟡 PHASE 3: CODE QUALITY & REFACTORING
  ├── 11. Modularize App.jsx into discrete sub-components
  ├── 12. Clarify/Hook up or remove the orphaned LoginPage and auth routes
  ├── 13. Uninstall unused dependencies (pdf-lib, pngjs)
  └── 14. Update README.md to match the active codebase
```
