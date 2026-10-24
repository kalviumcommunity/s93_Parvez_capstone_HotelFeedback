

# Hotel Guest Feedback Intelligence Platform

## Mock UX Design

Design Link:
https://www.figma.com/design/e6D1ToP4ZW7YC3f9qeWo8Q/Untitled?node-id=0-1&t=l9PaTJgHLdO0gPsI-1


## Brief Description & Idea

### Problem Statement
Hotels receive guest feedback across fragmented external channels such as TripAdvisor, Google Reviews, Booking.com, and private post-stay surveys. Without a centralized system, operational teams face delayed responses, unaddressed guest grievances, lost revenue opportunities, and an inability to track cross-channel reputation metrics efficiently.

### Solution Overview
The **Hotel Guest Feedback Intelligence Platform** is an external multi-channel feedback aggregator and sentiment intelligence system designed for hotel operational teams. It automatically aggregates guest reviews from multiple external platforms into a unified dashboard, categorizes guest sentiment using automated text analysis, and alerts staff to urgent operational grievances.

### Key Features
* **Multi-Channel Review Aggregation:** Centralizes external reviews from Google, TripAdvisor, Booking.com, and custom post-stay surveys into a unified timeline.
* **Automated Sentiment Analysis:** Classifies reviews by sentiment score (Positive, Neutral, Negative) and operational tags (e.g., Housekeeping, Dining, Staff, Amenities).
* **Urgent Action Desk:** Escalates high-priority negative reviews into actionable tickets for hotel staff resolution.
* **Reputation Analytics Dashboard:** Visualizes cross-channel rating trends, department-level performance metrics, and sentiment distribution over time.
* **Response Management:** Allows hotel managers to draft and track response statuses (Pending, Responded, Escalated) for external reviews.

## Authentication

Create an account or sign in from the application using a username and password. Usernames are 3-32 characters and may contain letters, numbers, dots, underscores, and hyphens. Passwords must be at least 8 characters.

`POST /api/auth/register` creates an account, and `POST /api/auth/login` starts a 12-hour session. Both return an HS256-signed JWT bearer token. Set `JWT_SECRET` in `server/.env` to a private value of at least 32 bytes before starting the server. The server also stores a hash of each issued token so `POST /api/auth/logout` can revoke the current session. The client keeps the token for the current browser session and sends it with protected API requests. All other `/api` routes require a valid, unexpired bearer token.

### Google Sign-In Setup

Google sign-in uses Google Identity Services in the client and verifies the returned ID token on the server before creating an app session. Create an OAuth 2.0 Web application client in Google Cloud Console, and add the client application's origins (for local development, `http://localhost:5173`) to its authorized JavaScript origins.

Set the same OAuth client ID in both environment files:

```env
# server/.env
GOOGLE_CLIENT_ID=your-google-oauth-client-id
```

```env
# client/.env
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id
```

Restart the client and server after setting these values. Google sign-in is hidden until the client ID is configured. Google accounts are matched by verified email and use the same protected API and revocable session flow as password accounts. On success, the app shows the verified Google display name and email in the signed-in navbar; use **Sign out** to revoke the session and return to the authentication screen.

The sign-in flow uses Google Identity Services to obtain an ID token. The client sends that token to `POST /api/auth/google`; the server verifies its audience, issuer, expiry, and verified-email claim before creating or matching the user and issuing the app's own session token.

For a demo, configure the same OAuth client ID in both apps, start the API and client, choose **Continue with Google**, complete Google's consent/sign-in screen, show the profile in the navbar, then choose **Sign out**. Explain that Google proves the external identity while the server's own bearer token protects subsequent API requests.

---

## Day-by-Day Implementation Plan

### Week 1: Foundation & Setup
* **Day 1:** Initialize repository, structure project directories, and configure environment variables for Node.js, Express, and MongoDB Atlas.
* **Day 2:** Set up database schemas using Mongoose for `Reviews`, `Channels`, `Users`, and `ActionTickets`.
* **Day 3:** Build REST API endpoints for review CRUD operations and channel filtering (`/api/reviews`).
* **Day 4:** Create mock data generators to simulate incoming external reviews from TripAdvisor, Google, and Booking.com.
* **Day 5:** Setup backend authentication routes (JWT-based signup/login) and password hashing with `bcryptjs`.

### Week 2: Core Features & Logic
* **Day 6:** Implement server-side sentiment analysis and auto-tagging logic for incoming review text.
* **Day 7:** Initialize React frontend using Vite/CRA, setup react-router-dom, and establish the main layout and navigation bar.
* **Day 8:** Build the core **Unified Feedback Feed** component with filtering by channel, rating, and operational category.
* **Day 9:** Develop the **Reputation Analytics Dashboard** using Chart.js/Recharts to display sentiment breakdowns and average ratings.
* **Day 10:** Create the **Urgent Action Desk** interface for managing flagged negative reviews and assigning staff resolution statuses.

### Week 3: Refinement, Integration & Testing
* **Day 11:** Integrate frontend components with Express backend endpoints and handle API loading/error states cleanly.
* **Day 12:** Implement review response drafting tools allowing managers to mark reviews as "Responded" with recorded timestamps.
* **Day 13:** Add input validation across forms (Zod/Joi) and secure API endpoints with authentication middleware.
* **Day 14:** Perform full end-to-end testing across all user workflows, fix UI/UX bugs, and optimize database indexing.
* **Day 15:** Finalize application documentation, record deployment setup, and prepare the project demo.