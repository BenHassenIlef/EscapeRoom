# The Room Escape Game Website

A modern multi-page style website for an escape game business in Tunis, including a player-facing booking experience and an admin dashboard.

## Overview

This project is a front-end website built with HTML, CSS, and vanilla JavaScript.

The public site includes:

- A cinematic home page with immersive visuals
- Scenario browsing (6 escape room themes)
- Detailed scenario pages with difficulty, player range, and success rate
- Pricing section by team size
- Booking flow with date/time slots and a reservation modal
- Contact and location information with Google Maps integration
- Multilingual interface (French, English, Arabic with RTL support)

The admin side includes:

- Secure login screen
- Reservation management
- Admin account management
- Waiver and KPI/report views
- PDF report export support (jsPDF)

## Tech Stack

- HTML5
- CSS3 (custom responsive styling)
- Vanilla JavaScript
- Browser localStorage for client-side data persistence

## Project Structure

- `index.html`: Main public website (home, scenarios, pricing, booking, contact)
- `admin.html`: Admin dashboard and management interface
- `img/`: Visual assets used by the website
- `server.js`: Canonical backend entrypoint for this workspace
- `escape - Copie/`: Duplicate backup copy of the project; keep it unchanged unless you explicitly want a mirrored copy

## How to Run Locally

1. Clone or download this repository.
2. Open `index.html` in your browser for the public website.
3. Open `admin.html` in your browser for the admin dashboard.
4. Run `npm start` from the workspace root if you want the backend and admin APIs.

Because this is a static project, no package installation or build step is required.

Note:

- The nested `escape - Copie/` folder is a duplicate workspace copy kept for reference.
- Use the root files as the source of truth when editing or running the app.

## Email Sending Setup

The admin dashboard can send reservation emails through the backend, but Gmail requires an App Password.

Set these environment variables before starting the server:

- `EMAIL_USER`: the Gmail address that will send the emails
- `EMAIL_PASS`: a Google App Password, not your normal Gmail password
- `EMAIL_FROM`: optional sender display name/address, for example `"The Room Escape Game" <your_email@gmail.com>`

Important:

- Enable 2-step verification on the Gmail account first.
- Then create an App Password in Google Account settings.
- If you use the normal account password, Gmail will reject the login with `535-5.7.8`.

## Admin Access (Default)

- Email: admin@gmail.com
- Password: admin

Use these credentials only for local/demo usage and change them for production scenarios.
