# MedQueue — Hospital Queue Management System

A modern, intelligent queue management system built with **Node.js**, **Express**, **Socket.io**, **Google Sheets API**, and **Tailwind CSS**.
Patients can queue online, receive real-time email notifications, and track their position — all without downloading an app.

Crafted by **[Stephen William G. De Jesus](https://www.facebook.com/stephenwilliam.dejesus.5/)** as a project for the **Technopreneurship Expo (2nd Year College)**, this system demonstrates full-stack development, real-time communication, API integration, and responsive design — built with a real hospital workflow in mind.

🌐 **Live Demo:** [MedQueue Application](https://medqueue-4kdf.onrender.com)
📱 **Landing Page:** [MedQueue Landing Page](https://bogiiiie.github.io/MedQueueLandingPage/)

---

## ✨ Features

### 🏥 For Patients
- **Online Queue Generation** – Get a queue number from anywhere, no app download required
- **Real-Time Position Tracking** – See your exact position in line and estimated wait time
- **Email Notifications** – Get confirmation and turn alerts via email using EmailJS (free tier)
- **QR Code Check-In** – Digital queue card with scannable QR code for quick verification
- **PDF Queue Card** – Download and save your queue card as PDF
- **Live Display Board** – Watch real-time queue updates on hospital display screens

> **Note on SMS:** SMS notifications were explored using Semaphore (Philippine SMS gateway) but were removed from the final build due to cost. EmailJS was chosen instead as it provides reliable email notifications completely free of charge.

### 👩‍⚕️ For Hospital Staff
- **Counter Dashboard** – Dedicated dashboard for each service counter
- **Call Next Patient** – One-click to call the next patient in line
- **Complete/Skip** – Mark patients as completed or no-show
- **Manual Entry** – Search and verify patients by queue number
- **QR Code Scanner** – Scan patient QR codes for instant verification
- **Real-Time Updates** – Live queue updates via Socket.io
- **Open/Close Counter** – Toggle counter availability for patient assignment
- **End-of-Day Database Reset** – Counter staff can clear the Google Sheet at end of day without needing the IT department

### 🏥 For Hospital Administrators
- **Multi-Department Support** – General Medicine, Pediatrics, Cardiology, Orthopedics, Emergency
- **Multi-Counter System** – Each department can have multiple service counters
- **Real-Time Analytics** – Live queue statistics and patient flow monitoring
- **Google Sheets Integration** – All data stored in an accessible Google Spreadsheet; staff can manage records directly without IT involvement
- **Staff Management** – Separate login system for staff members
- **Department Prefixes** – Unique queue numbers per department (e.g. `CARD001`, `GEN001`)

---

## 🖥️ How to Use

### For Patients
1. **Visit the Website** – Go to the MedQueue application
2. **Select Department** – Choose your needed department
3. **Enter Details** – Provide your name, email, and mobile number
4. **Get Queue Number** – Receive your unique queue number instantly
5. **Download Queue Card** – Save your QR code for check-in
6. **Wait for Notification** – Receive an email when it's almost your turn
7. **Proceed to Counter** – Show your QR code when called

### For Staff
1. **Login** – Use staff credentials to access the counter dashboard
2. **View Queue** – See all patients assigned to your counter
3. **Call Next** – Click to call the next waiting patient
4. **Complete/Skip** – Mark patient status after consultation
5. **Verify Patients** – Scan QR codes or manually search queue numbers
6. **Close Counter** – Temporarily stop new patient assignments
7. **End of Day** – Clear the Google Sheet directly to reset for the next day

---

## 🛠️ Built With

| Technology | Purpose |
|---|---|
| [Node.js](https://nodejs.org/) | JavaScript runtime for backend server |
| [Express.js](https://expressjs.com/) | Web framework for RESTful APIs |
| [Socket.io](https://socket.io/) | Real-time bidirectional communication |
| [Google Sheets API](https://developers.google.com/sheets) | Cloud-based data storage — editable directly by staff |
| [Tailwind CSS](https://tailwindcss.com/) | Utility-first styling framework |
| [EmailJS](https://www.emailjs.com/) | Free email notification service (no backend required) |
| [QRCode.js](https://github.com/davidshimjs/qrcodejs) | QR code generation |
| [jsPDF](https://github.com/parallax/jsPDF) | PDF queue card generation |
| [Html5-QRCode](https://github.com/mebjas/html5-qrcode) | QR code scanner |

> **Semaphore SMS** was initially integrated for Philippine SMS notifications but was removed from the final build due to per-message costs. EmailJS handles all patient notifications for free.

---

## 📁 Project Structure

```
MedQueue/
├── server.js                    # Express server entry point
├── sheets.js                    # Google Sheets API integration
├── sms.js                       # Semaphore SMS integration (unused in final build)
├── routes/
│   ├── auth.js                  # Authentication endpoints
│   └── queue.js                 # Queue management endpoints
├── js/
│   ├── auth-check.js            # Staff authentication handler
│   ├── counter.js               # Counter dashboard logic
│   ├── display.js               # Live display board logic
│   ├── generate-queue-form.js   # Queue generation logic
│   ├── index-header.js          # Header and navigation logic
│   ├── page-switcher.js         # Page navigation handler
│   ├── staff-login.js           # Staff login logic
│   └── status.js                # Queue status page logic
├── src/
│   └── output.css               # Compiled Tailwind CSS
├── index.html                   # Main queue generator page
├── counter-dashboard.html       # Staff counter dashboard
├── live-display.html            # Public live display board
├── queue-status.html            # Patient queue status page
├── staff-login.html             # Staff login page
├── package.json                 # Dependencies and scripts
└── render.yaml                  # Render deployment configuration
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm (v9 or higher)
- Google Cloud account (for Sheets API)
- EmailJS account (for email notifications)

### Installation

```bash
git clone https://github.com/bogiiiie/MedQueue.git
cd MedQueue
npm install
```

### Environment Variables

Create a `.env` file in the root directory:

```env
GOOGLE_SHEET_ID=your_google_sheet_id
GOOGLE_CREDENTIALS=your_google_credentials_json
SESSION_SECRET=your_session_secret
PORT=3000
```

### Running the App

```bash
# Development
npm run dev

# Production
npm start
```

Then open `http://localhost:3000` in your browser.

---

## 🗄️ Google Sheets Setup

The app uses three sheet tabs. Since everything is stored in a plain Google Spreadsheet, counter staff can clear records at the end of each day by simply deleting rows — no IT department or technical knowledge needed.

**Queues** — patient queue data:

| Column | Description |
|---|---|
| `id` | Auto-incremented row ID |
| `queue_number` | Unique queue number (e.g. `GEN001`) |
| `patient_name` | Full name of patient |
| `mobile_number` | Philippine mobile number |
| `email` | Patient email address |
| `department` | Assigned department |
| `assigned_counter` | Counter number (numeric) |
| `counter` | Counter label (e.g. `Counter 1`) |
| `status` | `Waiting` / `Serving` / `Completed` / `Skipped` |
| `created_at` | Timestamp of queue creation |

**Staff** — staff credentials:

| Column | Description |
|---|---|
| `username` | Staff login username |
| `password` | Staff login password |
| `name` | Staff full name |
| `counter` | Assigned counter number |
| `department` | Assigned department |

**Counter_Status** — counter open/closed state:

| Column | Description |
|---|---|
| `counter_number` | Counter number |
| `status` | `open` / `closed` |
| `last_updated` | Timestamp of last status change |

---

## 📡 API Endpoints

### Queue Routes `/api/queue`

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/generate` | Generate a new queue number |
| `GET` | `/list` | Get all queues (optional `?dept=` filter) |
| `GET` | `/status` | Get single queue status `?queue=GEN001` |
| `PATCH` | `/update` | Update queue status (`call_next`, `complete`, `skip`) |
| `GET` | `/counter-status` | Get counter open/closed status |
| `POST` | `/counter-status` | Update counter open/closed status |

### Auth Routes `/api/auth`

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/login` | Staff login |
| `POST` | `/logout` | Staff logout |
| `GET` | `/check` | Check authentication status |

---

## 🔄 Commit History

| Commit | Description |
|---|---|
| First | Initial project setup and core queue generation |
| Second | Staff login, counter dashboard, and Socket.io integration |
| Third | Email notifications and QR code features |
| Fourth | Bug fixes, loader UX, department filtering, and toast notifications |
| Fifth | Fix avg wait time by dept, live display dept filtering, and show all queue records |

---

## 📄 License

This project is for educational and portfolio purposes, originally built for the **Technopreneurship Expo (2nd Year College)**.
Built with ❤️ by [Stephen William G. De Jesus](https://www.facebook.com/stephenwilliam.dejesus.5/)