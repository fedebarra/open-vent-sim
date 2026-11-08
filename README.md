# Open Vent Sim 3.0

**A free, open-source simulator of ICU ventilator, anaesthesia machine and high-flow oxygen — with an instructor console that runs on your classroom's own network.**

🇮🇹 [Versione italiana](README.it.md) · 📅 Version 3.0.0 — released 8 November 2026 · MIT licence

<p align="center"><img src="docs/screenshots/10-regia-live-en.png" width="820" alt="The instructor console showing a learner's ventilator live"></p>

> ⚠️ **For education only.** Not a medical device. Never use it for clinical decisions.

---

## Contents

1. [What it does](#1-what-it-does)
2. [What you need](#2-what-you-need)
3. [Download and install (5 minutes)](#3-download-and-install)
4. [Running a class, step by step](#4-running-a-class-step-by-step)
5. [Using it on your own](#5-using-it-on-your-own)
6. [The instructor console in detail](#6-the-instructor-console-in-detail)
7. [The session log](#7-the-session-log)
8. [Troubleshooting](#8-troubleshooting)
9. [What's new in 3.0](#9-whats-new-in-30)
10. [For developers](#10-for-developers)

---

## 1. What it does

- **Three machines in one**: anaesthesia workstation, ICU ventilator (invasive and non-invasive) and high-flow oxygen.
- **Real waveforms**: pressure, flow and volume come from a lung model with PEEP-dependent compliance, auto-PEEP, patient effort and asynchronies.
- **Instructor console**: from one computer (or tablet) you see every learner's ventilator live and change the patient: clinical picture, mechanics, vital signs, asynchronies, timed events.
- **Session log** for the debriefing: who did what and when, with parameter trends. Prints to PDF.
- **Guided tour** for people who have never touched a ventilator.
- **No internet, no accounts**: it runs on your room's local network. No data leaves the room.
- English and Italian.

## 2. What you need

| Who | What |
|---|---|
| **Instructor** | A **Windows 10/11** or **Mac** (macOS 11 or later) computer. |
| **Learners** | A Windows/Mac computer with the app, **or** any tablet/phone with a browser (Safari, Chrome…). Nothing to install on tablets. |
| **Network** | Everyone on the **same Wi-Fi** (or the same router). Internet is **not** needed. |

> 💡 Many hospital and university Wi-Fi networks **isolate devices** from each other, so the console cannot see the learners. If that happens, use a small router of your own or a phone hotspot (see [§8](#8-troubleshooting)).

## 3. Download and install

Go to **[Releases](https://github.com/fedebarra/open-vent-sim/releases/latest)** and download the right file:

| Your computer | File |
|---|---|
| Windows | `OpenVentSim-3.0.0-win-x64.exe` (installer) — or `OpenVentSim-3.0.0-portable.exe` (no install, just run it) |
| Mac with Apple chip (M1, M2, M3, M4…) | `OpenVentSim-3.0.0-mac-arm64.dmg` |
| Mac with Intel processor | `OpenVentSim-3.0.0-mac-x64.dmg` |

> If the `.dmg` won't open, download the `.zip` with the same name: double-click to extract, then drag **Open Vent Sim** into Applications.

> Not sure which Mac? Apple menu  → **About This Mac**. "Chip Apple M…" → `arm64`; "Processor Intel" → `x64`.

### Windows

1. Double-click the `.exe`.
2. A blue **"Windows protected your PC"** box appears: normal for free unsigned programs. Click **More info** → **Run anyway**.
3. Next, Next, Finish. **Open Vent Sim** is on your desktop.
4. **The first time you open the Instructor console**, Windows asks about network access: tick **Private networks** (and **Public** if the classroom network is marked public) and click **Allow access**. Without this, learners can't connect.

### Mac

1. Open the `.dmg` and **drag Open Vent Sim into Applications**.
2. Double-click it in Applications. macOS says it **cannot verify the developer**: click **Done** (not "Move to Bin").
3. Open **System Settings → Privacy & Security**, scroll down, click **Open Anyway** next to "Open Vent Sim was blocked", and confirm with your password.
4. From now on it opens normally. If asked to accept incoming connections, click **Allow**.

## 4. Running a class, step by step

### Instructor

**1.** Open Open Vent Sim and choose **Instructor**.

<p align="center"><img src="docs/screenshots/01-launcher-en.png" width="640" alt="Choose Instructor, Ventilator or On my own"></p>

**2.** The console opens. On the left is everything the learners need: **QR code**, **address** and the **4-digit PIN** (top right, in yellow). The PIN changes every time.

<p align="center"><img src="docs/screenshots/02-regia-empty-en.png" width="820" alt="Empty console with QR, address and PIN"></p>

Keep this window open for the whole class: **closing it disconnects the room**.

### Learners

Any of these works:

- **Tablet or phone** → scan the **QR code** with the camera. The simulator opens already connected.
- **PC with the app** → open Open Vent Sim, choose **Ventilator**, click the instructor that appears. If none appears, type the address shown on your screen (e.g. `192.168.1.20:8787`).
- **PC without the app** → type the address in a browser (e.g. `http://192.168.1.20:8787`).

<p align="center"><img src="docs/screenshots/05-find-instructor-en.png" width="560" alt="The app finds the instructor on the network"></p>

If asked for a **PIN**, they type the 4 digits shown on the console:

<p align="center"><img src="docs/screenshots/03-join-pin-en.png" width="560" alt="PIN screen"></p>

A dot appears bottom-left: **green "Connected to instructor"** means all good.

### The learner switches the machine on

1. Choose the machine.

<p align="center"><img src="docs/screenshots/04-start-en.png" width="640" alt="Start screen"></p>

2. For the ICU, choose **invasive** or **non-invasive**, then confirm weight and clinical picture.

<p align="center"><img src="docs/screenshots/06-icu-choice-en.png" width="420" alt="Invasive or NIV"> <img src="docs/screenshots/07-patient-en.png" width="420" alt="Patient data"></p>

3. Open the **STANDBY** drawer (left) and press **START VENTILATION**.

<p align="center"><img src="docs/screenshots/08-standby-drawer-en.png" width="640" alt="Standby drawer"></p>

<p align="center"><img src="docs/screenshots/09-icu-running-en.png" width="820" alt="Ventilator running"></p>

From now on you see it on the console, waveforms included, and each action appears in the log on the right.

## 5. Using it on your own

Open the app and choose **On my own**, or open the simulator in a browser and click **Use without instructor**. The start screen has a **Guided tour** button that walks a learner through their first ventilation.

<p align="center"><img src="docs/screenshots/20-tour-en.png" width="640" alt="Guided tour"></p>

| Anaesthesia | Non-invasive | High flow |
|---|---|---|
| <img src="docs/screenshots/17-anesthesia-en.png" width="280"> | <img src="docs/screenshots/18-niv-en.png" width="280"> | <img src="docs/screenshots/19-highflow-en.png" width="280"> |

## 6. The instructor console in detail

At the top choose **where commands go**: *this ventilator* (selected on the left) or *all ventilators*.

| Tab | What you do |
|---|---|
| **Patient** | One-click clinical pictures (Normal, COPD, ARDS, COVID, Anaphylaxis, Pulmonary oedema, Pneumonia, Fibroscopy); compliance, resistance, effort, secretions; SpO₂, EtCO₂, heart rate, mean arterial pressure. With **"Change over"** the change happens gradually (30 s – 5 min) instead of at once. |
| **Asynchronies** | Ineffective effort, double cycling, reverse triggering, flow starvation, premature/delayed cycling, auto-triggering, with the share of breaths affected. Learners only see the **waveforms**, never the name: spotting it is their job. |
| **Lung** | Recruitability and chest-wall compliance: compliance now depends on PEEP. Start the **recruitment manoeuvre**. |
| **Machine** | Mode, settings, start/standby, silence alarms, inspiratory and expiratory holds: applied as if the learner touched them (logged as instructor actions). |
| **Events** | Ready-made events (bronchospasm, mucus plug, pneumothorax, desaturation, hypercapnia, induction, waking up, NMB reversal…). Fire now or build a timed **sequence**; save it to a file for next time. |

<p align="center"><img src="docs/screenshots/11-regia-async-en.png" width="820" alt="Asynchronies tab"></p>

<p align="center"><img src="docs/screenshots/12-learner-asynchrony-en.png" width="640" alt="The learner sees ineffective efforts on the waveforms"></p>

<p align="center"><img src="docs/screenshots/15-regia-events-en.png" width="820" alt="Events and sequence"></p>

**Console on a tablet.** In the left panel open "Open the console on a tablet" and scan the QR with **your** tablet to walk around the room with the console in hand. Don't show it to learners: it gives full control.

## 7. The session log

1. On the console press **● Record session**. Learners' ventilators show **● REC**.
2. Run the class.
3. Press **■ Stop recording**: the log opens.

<p align="center"><img src="docs/screenshots/16-registro-en.png" width="820" alt="Session log"></p>

- **Session sheet**: title, learners' names, debriefing notes.
- **Parameters**: SpO₂, EtCO₂, Ppeak, PEEP, VTe, rate, FiO₂ and HR over time. Toggle the coloured pills; ticks at the top mark the actions.
- **Actions**: minute by minute (0:00 = start of recording), grouped as *Ventilator*, *Patient*, *Alarms* and *Instructor*. Several turns of the same knob within a minute become one line; click it to expand.
- **Print / PDF**, **Save log** (`.json`, reopen later with "Open saved log") and **CSV** for Excel.

The log survives closing and reopening the console.

## 8. Troubleshooting

| Problem | Fix |
|---|---|
| Learner **can't find the instructor** or the QR doesn't open | Check they're on the **same Wi-Fi** (not the "guest" network). On Windows you must have clicked **Allow access** the first time (§3); if you denied it: *Control Panel → Windows Defender Firewall → Allow an app* → tick Open Vent Sim. |
| Works on a PC but not on phones | The Wi-Fi isolates devices ("client isolation"), common in hospitals. Use your own router or a **phone hotspot** and connect everyone to it, console included. |
| "Wrong PIN" | The PIN changes at every start of the console: use the one shown now, top right. |
| The bottom dot turns **orange** ("Network lost – reconnecting…") | Do nothing: it reconnects by itself when the network is back, and the ventilator keeps running. |
| "Opened in another window" | The same ventilator is open in two tabs: close one. |
| The address changed since last time | Normal, it depends on the router. Always use what the console shows **today**. |
| Port 8787 is busy | The console moves to the next one (8788, 8789…) by itself: the right address is always the one on screen. |
| Mac says the app is "damaged" | Open Terminal, type `xattr -cr "/Applications/Open Vent Sim.app"`, then reopen. |
| I want the old (2.x) interface | In the browser, add `?legacy=1` to the address (stand-alone only). |

## 9. What's new in 3.0

*8 November 2026*

- **Instructor console over the local network**: built-in server, QR, PIN, automatic discovery, automatic reconnection, many ventilators at once, console on a tablet.
- **New screens and engine** from Sim Scenario Creator: one layout for anaesthesia, invasive ICU and NIV, plus high flow. PEEP-dependent compliance, auto-PEEP, patient effort and seven asynchronies, recruitment manoeuvre, consumables, humidifier.
- **Session log** in the Scenario Creator style, started from the console, printable to PDF.
- **Guided tour** (familiarisation), English and Italian.
- **Desktop app** for Windows and Mac; works **offline** (React and Tailwind used to come from external CDNs).
- Redesigned start screen with original icons.
- Language follows the system and is remembered.

## 10. For developers

```bash
git clone https://github.com/fedebarra/open-vent-sim.git
cd open-vent-sim
npm install
npm run dev            # development, http://localhost:3000 (simulator only)
npm run server         # build + classroom server on the LAN (port 8787)
npm run desktop        # Electron app
npm test               # unit + server tests
npm run test:e2e       # end-to-end (console + learners in two browsers)
npm run screenshots    # regenerate every image in this README
npm run dist:mac       # .dmg installer   (npm run dist:win for Windows)
```

- `device/`: ventilator engine and screens (from Sim Scenario Creator; original names kept so they stay diff-able).
- `remote/`: console, link, session log. `server/ovs-server.mjs`: HTTP + WebSocket server and UDP beacon on the LAN. `electron/`: desktop app. `tour/`: guided tour.
- Releases build themselves on GitHub Actions when a `v*` tag is pushed.

**Development requires** Node.js 20 or later.

---

### Acknowledgements

Developed at Università del Piemonte Orientale, Novara, Italy. Clinical team: F.L. Barra MD, E. Moro MD, L. Carenzo MD, A. Costa MD, G. Rodella RN, R. Vaschetto MD PhD. Technical facilitators: S. Ricci PhD, J. Travenec MSc. Thanks to all the Anaesthesiology residents who gave feedback.

**Support:** [Issues](https://github.com/fedebarra/open-vent-sim/issues) · federico.barra@med.uniupo.it

**Licence:** MIT. Icons are original drawings made for this project.
