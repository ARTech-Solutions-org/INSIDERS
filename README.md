<div align="center">
  <img src="./readme-assets/insiders-logo-white.png" alt="INSIDERS Logo" width="200" />
</div>

## Table of Contents
- [Introduction](#introduction)
- [The Problem It Solves](#the-problem-it-solves)
- [Real-World Use Cases](#real-world-use-cases)
- [Who Uses It](#who-uses-it)
- [Key Features In Detail](#key-features-in-detail)
- [The Financial & Rating Engine](#the-financial--rating-engine)
- [How It Works (User Journey)](#how-it-works-user-journey)
- [Branding & Technology](#branding--technology)

---

## Introduction
Welcome to **INSIDERS** — a premier, end-to-end event staffing and usher management platform designed to command the crowd with efficiency, transparency, and elegance. Whether you are an event organizer looking to coordinate hundreds of staff members, or an usher seeking your next high-profile assignment, INSIDERS provides a seamless, digital-first experience tailored to the dynamic needs of the modern events industry.

## The Problem It Solves
Historically, managing event staff manually has been chaotic. Relying on fragmented WhatsApp groups, endless spreadsheets, paper sign-in sheets, and manual payroll calculations often leads to miscommunication, fraudulent attendance, and severe operational friction. 

**INSIDERS eliminates this friction by providing:**
- **Centralized Communication:** No more scattered messages; all assignments, updates, and broadcasts happen natively within the app.
- **Absolute Accountability:** GPS-verified check-ins ensure staff are physically present at the venue, completely eradicating "ghost" attendance.
- **Automated Payroll & Ratings:** The system automatically calculates deductions for tardiness and tracks financial ledgers with zero human error.
- **Smart Staffing:** Admins can filter staff based on physical traits, language proficiency, and past performance ratings, eliminating the guesswork in hiring.

## Real-World Use Cases
INSIDERS is built to scale across various types of events:
- **Massive Tech Conferences:** Coordinating 200+ ushers across different halls, ensuring everyone is at their designated zone (e.g., VIP Registration, Main Stage).
- **Exclusive VIP Gatherings:** Filtering ushers to only select those who speak specific foreign languages or have a verified "VIP Handling" skill badge.
- **Concerts & Festivals:** Utilizing the broadcast feature to instantly notify all staff of schedule changes, gate closures, or emergency procedures in real-time.

---

## Who Uses It

### 📱 Ushers (Mobile App)
The frontline ambassadors of any event. Through the dedicated mobile application (available as a sleek Progressive Web App), ushers can:
- **Onboard Seamlessly:** Register, submit national identification documents, and await admin approval.
- **Manage a Rich Profile:** Update their availability calendar and highlight unique skills (e.g., spoken languages, height, specialized experience).
- **Handle Assignments:** Receive instant push notifications for new event assignments and accept or decline them on the spot.
- **Log Attendance Safely:** Check in and out of events using strict location-based GPS verification.
- **Track Finances & Performance:** Monitor their current digital wallet balance, view detailed transaction history, and check their performance ratings for past events.

### 💻 Admins & Organizers (Admin Dashboard)
The control center for event managers. Through the comprehensive web-based admin panel, organizers can:
- **Plan Complex Events:** Create new events, set precise geographical locations (Geo-fencing) via an interactive map, and define strict staffing budgets.
- **Assign Staff Intelligently:** Browse the usher database, filter by specific skills or high ratings, and assign them directly to events.
- **Monitor Live Status:** Track real-time attendance, identifying exactly who has arrived, who is late, and who missed their checkout.
- **Manage Users & Approvals:** Review pending usher applications, verify uploaded documents, and approve or suspend accounts.
- **Communicate Instantly:** Send targeted broadcast push notifications to specific groups or all active ushers.
- *(Super Admins)* **Financial Oversight:** Oversee system-wide payouts, modify base pay, and track budget utilization to the last penny.

---

## Key Features In Detail

### 1. Usher Registration & Approval Workflow
A strict and streamlined onboarding process. Ushers sign up and must complete their profile by uploading an ID and a professional headshot. Admins then review these pending applications in a dedicated queue, ensuring only verified and qualified staff join the platform.
<br/>
<img src="./readme-assets/account-approval.png" alt="Account Approval Screen" width="600" />

### 2. Smart Event Assignments & Waitlists
Admins can select ushers for upcoming events based on smart filters (availability, rating, specific skills). Once assigned, ushers receive an instant push notification and must confirm their attendance. If an usher declines or drops out, admins can quickly tap into the waitlist to find immediate replacements.
<br/>
<img src="./readme-assets/event-assignment.png" alt="Event Assignment Screen" width="600" />

### 3. GPS-Verified Check-in/Check-out
To guarantee punctuality and attendance, ushers use the app to check in and out of their shifts. The system strictly verifies their GPS coordinates against the event's designated location radius (e.g., within 500 meters of the venue). If they are outside the radius, the check-in button is disabled.
<br/>
<img src="./readme-assets/checkin-screen.png" alt="Check-in Screen" width="600" />

### 4. Comprehensive Profile & Skills Engine
Ushers act as their own digital resume. They can add specific skills, physical traits (like height), and spoken languages. They also maintain a personal calendar, marking days they are unavailable, which prevents admins from accidentally assigning them to conflicting shifts.
<br/>
<img src="./readme-assets/profile-skills.png" alt="Profile and Skills" width="600" />

### 5. Live Admin Command Dashboard
A high-level command center displaying active events, pending approvals, and overall system health. Organizers can dive into specific events to monitor budget usage and staff attendance in real-time, instantly spotting anomalies like a "Missed Checkout."
<br/>
<img src="./readme-assets/admin-dashboard.png" alt="Admin Dashboard" width="600" />

### 6. Real-Time Broadcasts & Communications
When last-minute changes happen, admins can push broadcast messages that instantly notify the relevant ushers on their mobile devices (via native push notifications), ensuring everyone is on the same page without relying on external chat apps.
<br/>
<img src="./readme-assets/broadcasts-screen.png" alt="Broadcasts Screen" width="600" />

### 7. Audit Log & Accountability
Every critical action on the platform—from an admin approving an account, assigning an usher, to modifying a budget—is recorded in a secure, immutable audit log. This guarantees complete transparency and operational accountability across the entire management team.
<br/>
<img src="./readme-assets/audit-log.png" alt="Audit Log" width="600" />

---

## The Financial & Rating Engine

INSIDERS treats reliability as a measurable metric. We have built a proprietary engine that connects an usher's performance directly to their reputation and payout.

### Automated Ratings & Feedback
Quality control is built-in. After an event, the system calculates an **Auto-Rating** based on the usher's punctuality. 
- Arriving perfectly on time yields a 5-star rating.
- Every minute of delay automatically deducts a fraction of a star.
- Admins and clients can also provide manual reviews, which are averaged with the auto-rating to create a final, transparent score. 

<img src="./readme-assets/ratings-feedback.png" alt="Ratings Screen" width="600" />

### Financial Ledgers & Payouts
The platform handles the math. Every completed event automatically adds the agreed-upon pay (minus any automated deductions for being late) to the usher's digital wallet. 
- **Admin Overrides:** Admins can manually override a payout if an usher worked extra hours or took on a harder role.
- **Payout Processing:** When an usher requests their money, or when the agency distributes cash/transfers, admins log the transaction in the system, keeping the ledger perfectly balanced.

---

## How It Works (User Journey)

### The Usher's Journey
1. **Onboarding:** Sarah downloads the INSIDERS app, creates an account, and uploads her national ID and a professional headshot.
2. **Verification:** An admin reviews her profile, verifies her documents, and approves her account to join the roster.
3. **Getting Booked:** Sarah fills out her profile (fluent in French, 170cm, Registration expert) and marks her available days. She soon receives a push notification: *"You've been assigned to the Global Tech Summit!"*
4. **The Event:** On the day of the event, Sarah arrives at the venue and taps **Check In** on her app. The app verifies her GPS location confirms she is on-site, and logs her exact arrival time.
5. **Wrapping Up:** When her shift ends, she taps **Check Out**. Later that week, she checks her app to see her 5-star rating (since she was perfectly on time) and her updated financial balance ready for payout.

### The Admin's Journey
1. **Planning:** Ahmed is organizing a large conference. He logs into the Admin Dashboard, creates the "Global Tech Summit" event, pins the exact venue coordinates on the interactive map, and assigns a strict total budget.
2. **Staffing:** He opens the event dashboard and uses the smart filters to find 50 available ushers with high ratings and specific language skills. He assigns them with one click.
3. **Live Monitoring:** On the day of the summit, Ahmed watches the dashboard as ushers check in. He notices two ushers are running 15 minutes late and easily reassigns a backup usher from the waitlist to cover the gap.
4. **Post-Event:** After a successful event, Ahmed reviews the system's automated punctuality deductions (latecomers automatically lose a portion of their rating and pay), finalizes the performance reviews, and processes the financial payouts with a single click.

---

## Branding & Technology
INSIDERS is built around a sleek, premium, and minimalistic visual identity. The platform heavily utilizes a striking contrast of deep blacks and sharp whites, accented with bold typography and subtle animations. This design language reflects our core philosophy: professionalism, authority, and elegance.

Under the hood, INSIDERS leverages modern **Progressive Web App (PWA)** technology, allowing ushers to install the app directly on their phones without going through app stores, while still receiving native-level push notifications and GPS access.

<img src="./readme-assets/branding-overview.png" alt="INSIDERS Visual Identity" width="600" />
