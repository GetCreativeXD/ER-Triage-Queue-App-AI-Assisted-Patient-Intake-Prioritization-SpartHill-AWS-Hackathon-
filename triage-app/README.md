# ER Triage — native app (Capacitor)

A native iOS/Android app for ER triage staff, built with
[Capacitor](https://capacitorjs.com/). It wraps a small web UI (in `www/`) in a
real installable app and talks to the same Express backend that serves the
patient intake website.

## What it does

- **Check-in QR tab** — shows a QR code the staff member holds up on their
  phone. A patient scans it with their phone camera and it opens the intake
  **website** on the patient's own phone. The QR encodes the patient-site URL
  returned by the backend's `GET /api/patient-url`.
- **Queue tab** — a live priority queue showing each patient's **4-digit
  patient number** and **first + last name**, color-coded by priority. Tapping a
  patient opens a detail card with the AI summary, intake answers, one-tap
  **Accept** priority, a **Sort patients** control (re-sorts by setting a
  priority), and short status actions (Call now / Start care / Recheck / Finish
  / Away).
- **Settings** (gear icon) — set the backend server address (the machine running
  `npm start` in the project root). Defaults to `http://10.0.2.2:3001`, which is
  the Android emulator's alias for the host's `localhost`. On a real device, use
  the host machine's LAN IP, e.g. `http://192.168.1.50:3001`.

## Structure

```
triage-app/
├── capacitor.config.json   # App id, name, and web dir (www/)
├── package.json            # Capacitor CLI + platform deps
└── www/                    # The web UI bundled into the native app
    ├── index.html
    ├── css/app.css
    └── js/
        ├── app.js          # Tabs, queue, QR, settings
        ├── api.js          # Backend REST client (configurable base URL)
        └── qrcode.js       # Vendored QR generator (davidshimjs/qrcodejs, MIT)
```

## Build & run

Requires Node 18+. For Android you also need Android Studio + a JDK; for iOS you
need macOS + Xcode.

```powershell
# From triage-app/
npm install

# Add a native platform (creates android/ or ios/)
npx cap add android
#   or: npx cap add ios

# Copy the web assets into the native project
npx cap sync

# Open the native IDE to run on a device/emulator
npx cap open android
#   or: npx cap open ios
```

Start the backend first (from the project root): `npm start`. Then set the
server address in the app's Settings so it can reach the API.

> The `www/` UI is plain HTML/CSS/JS with no build step, so you can also open
> `www/index.html` in a desktop browser to preview the UI during development
> (set the server URL to `http://localhost:3001`).

## Attribution

The QR generator in `www/js/qrcode.js` is the MIT-licensed
[qrcodejs](https://github.com/davidshimjs/qrcodejs) library by davidshimjs,
vendored locally so the app needs no network to render the QR code.
