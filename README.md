# 🔐 The Room — Escape Game Website

> A modern multi-page website for an escape game business in **Tunis** 🇹🇳 — featuring an immersive player-facing booking experience and a complete admin dashboard.

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white)
![Status](https://img.shields.io/badge/Status-Active-success?style=flat)

---

## 📌 Overview

**The Room** is a front-end website built with HTML, CSS, and vanilla JavaScript, paired with a lightweight Node.js backend for reservations and email notifications.

### 🌐 Public Website
- 🎬 **Cinematic home page** with immersive visuals
- 🧩 **Scenario browsing** — 6 unique escape room themes
- 📋 **Detailed scenario pages** with difficulty, player range & success rate
- 💰 **Pricing section** by team size
- 📅 **Booking flow** with date/time slots and a reservation modal
- 📍 **Contact & location** with Google Maps integration
- 🌍 **Multilingual interface** — French, English & Arabic (RTL support)

### 🛠️ Admin Dashboard
- 🔑 Secure login screen
- 📆 Reservation management
- 👥 Admin account management
- 📝 Waiver and KPI/report views
- 📄 PDF report export (jsPDF)

---

## 💻 Tech Stack

| Layer | Technology |
|---|---|
| Structure | HTML5 |
| Styling | CSS3 — custom responsive design |
| Logic | Vanilla JavaScript |
| Persistence | Browser `localStorage` (client-side) |
| Backend | Node.js (`server.js`) — reservations & email APIs |
| Reports | jsPDF |

---

## 📁 Project Structure

```
├── index.html        # Main public website (home, scenarios, pricing, booking, contact)
├── admin.html        # Admin dashboard and management interface
├── server.js         # Canonical backend entrypoint for this workspace
├── img/              # Visual assets used by the website
└── escape - Copie/   # Duplicate backup copy — keep unchanged (reference only)
```

> ⚠️ **Note:** Use the root files as the source of truth when editing or running the app. The nested `escape - Copie/` folder is only a mirrored reference copy.

---

## 🚀 How to Run Locally

1. **Clone** or download this repository
```bash
   git clone https://github.com/your-username/the-room-escape-game.git
```
2. Open `index.html` in your browser → **public website**
3. Open `admin.html` in your browser → **admin dashboard**
4. *(Optional)* Run the backend for reservations & admin APIs:
```bash
   npm start
```

✅ Because the front-end is static, **no package installation or build step is required** to browse the site.

---

## 📧 Email Sending Setup

The admin dashboard can send reservation emails through the backend. Gmail requires an **App Password** (not your normal password).

**Set these environment variables before starting the server:**

| Variable | Description |
|---|---|
| `EMAIL_USER` | The Gmail address that will send the emails |
| `EMAIL_PASS` | A **Google App Password** — *not* your normal Gmail password |
| `EMAIL_FROM` | *(Optional)* Sender display name, e.g. `"The Room Escape Game" <your_email@gmail.com>` |

> ⚠️ **Important:**
> 1. Enable **2-step verification** on the Gmail account first
> 2. Then create an **App Password** in Google Account settings
> 3. Using the normal account password will fail with error `535-5.7.8`

---

## 🔑 Admin Access (Default — Demo Only)

| Field | Value |
|---|---|
| Email | `admin@gmail.com` |
| Password | `admin` |

> 🚨 These credentials are for **local/demo usage only** — always change them before any production deployment.

---

## 📸 Preview

<!-- Ajoute ici des captures d'écran du site :-->
<img src="img/Capture d'écran 2026-06-12 164703.png" alt="Home Page" width="800"/>
![Booking Flow](img/screenshot-booking.png)
![Admin Dashboard](img/screenshot-admin.png)

---

## 👩‍💻 Author

**Ilef BEN HASSEN** — Data Science & AI Engineer

[![Gmail](https://img.shields.io/badge/Gmail-benhassenilef20%40gmail.com-D14836?style=flat&logo=gmail&logoColor=white)](mailto:benhassenilef20@gmail.com)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-ilef--ben--hassen-0A66C2?style=flat&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/ilef-ben-hassen)

---

<div align="center">
  <em>🗝️ Can you escape in time?</em>
</div>
