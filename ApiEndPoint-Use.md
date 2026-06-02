# FIXO API Endpoints — Complete Reference

> All API calls use a base URL configured in the axios instance.
> Authentication is via **Bearer Token** in the `Authorization` header.
> Token is automatically attached by the axios interceptor after login.

---

## Base URL

```
[Server API URL] (e.g. https://api.fixo.in/api)
```

---

## Table of Contents

1. [Authentication Endpoints](#1-authentication)
2. [Customer Endpoints](#2-customer)
3. [Worker Endpoints](#3-worker)
4. [Admin Endpoints](#4-admin)
5. [Push Notification Endpoints](#5-push-notifications-shared)
6. [Quick Reference Table](#6-quick-reference-table)

---

## 1. Authentication

> These endpoints are shared — used by all three roles.

---

### Customer Auth

---

#### `POST /auth/customer/register`
**Purpose:** Register a new customer account

**Request Body:**
```json
{
  "fullName": "John Doe",
  "email": "john@example.com",
  "phone": "9876543210",
  "password": "StrongPass@123"
}
```

**Response:**
```json
{
  "accessToken": "eyJ...",
  "role": "customer",
  "user": { "_id": "...", "fullName": "John Doe", "email": "...", "phone": "..." }
}
```

**Used on:** `/register` page

---

#### `POST /auth/customer/login`
**Purpose:** Login existing customer

**Request Body:**
```json
{
  "identifier": "john@example.com",
  "password": "StrongPass@123"
}
```

> `identifier` accepts email or phone number

**Response:**
```json
{
  "accessToken": "eyJ...",
  "role": "customer",
  "user": { "_id": "...", "fullName": "...", "email": "...", "phone": "..." }
}
```

**Used on:** `/login` page

---

#### `POST /auth/customer/google`
**Purpose:** Sign in or sign up with Google account

**Request Body:**
```json
{
  "credential": "google_id_token_here"
}
```

**Response (existing user):**
```json
{
  "accessToken": "eyJ...",
  "role": "customer",
  "user": { ... }
}
```

**Response (new Google user, no phone yet):**
```json
{
  "needsPhone": true,
  "googleData": {
    "googleId": "...",
    "fullName": "...",
    "email": "...",
    "profileImage": "..."
  }
}
```

**Used on:** `/login` and `/register` pages (Google button)

---

#### `POST /auth/customer/google/complete`
**Purpose:** Complete Google registration by adding a phone number

**Request Body:**
```json
{
  "googleId": "...",
  "fullName": "John Doe",
  "email": "john@gmail.com",
  "phone": "9876543210",
  "profileImage": "https://...",
  "credential": "google_id_token"
}
```

**Response:**
```json
{
  "accessToken": "eyJ...",
  "role": "customer",
  "user": { ... }
}
```

**Used on:** `/register` page (Google phone completion step)

---

### Worker Auth

---

#### `POST /auth/worker/register`
**Purpose:** Register a new worker account with Aadhaar documents

**Request Format:** `multipart/form-data`

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| fullName | string | Worker's full name |
| phone | string | 10-digit phone number |
| email | string | Email address |
| password | string | Strong password |
| aadhaarFront | file | Front photo of Aadhaar card |
| aadhaarBack | file | Back photo of Aadhaar card |

**Response:**
```json
{
  "accessToken": "eyJ...",
  "role": "worker",
  "worker": { "_id": "...", "fullName": "...", "accountStatus": "test" }
}
```

**Used on:** `/worker/register` page

---

#### `POST /auth/worker/login`
**Purpose:** Login existing worker

**Request Body:**
```json
{
  "phone": "9876543210",
  "password": "Pass@123"
}
```

**Response:**
```json
{
  "accessToken": "eyJ...",
  "role": "worker",
  "worker": { "_id": "...", "accountStatus": "live", "profileCompleted": true }
}
```

**Used on:** `/worker/login` page

---

#### `POST /auth/worker/google`
**Purpose:** Sign in worker with Google

**Request Body:**
```json
{ "credential": "google_id_token" }
```

**Response:** Same pattern as customer Google auth (needsPhone if new user)

**Used on:** `/worker/login` and `/worker/register`

---

#### `POST /auth/worker/google/register`
**Purpose:** Complete worker Google registration with documents

**Request Format:** `multipart/form-data` (same fields as worker register + Google data)

**Used on:** `/worker/register` page

---

### Admin Auth

---

#### `POST /auth/admin/login`
**Purpose:** Admin login

**Request Body:**
```json
{
  "email": "admin@fixo.in",
  "password": "AdminPass@123"
}
```

**Response:**
```json
{
  "accessToken": "eyJ...",
  "role": "admin",
  "admin": { "_id": "...", "email": "..." }
}
```

**Used on:** `/admin/login` page

---

### General Auth

---

#### `GET /auth/me`
**Purpose:** Fetch the currently logged-in user's full profile

**Headers:** `Authorization: Bearer <token>`

**Response (customer):**
```json
{
  "role": "customer",
  "user": { "_id": "...", "fullName": "...", "email": "...", "phone": "..." }
}
```

**Response (worker):**
```json
{
  "role": "worker",
  "worker": { "_id": "...", "fullName": "...", "accountStatus": "live", "profileCompleted": true }
}
```

**Used on:** Every page load (session refresh/restore)

---

#### `POST /auth/refresh`
**Purpose:** Refresh the access token using a refresh token stored in cookies

**Request Body:** None (refresh token read from cookie automatically)

**Response:**
```json
{
  "accessToken": "new_token_here"
}
```

**Used on:** Auto-called when access token expires

---

#### `POST /auth/logout`
**Purpose:** Logout and invalidate session

**Response:** `{ "success": true }`

**Used on:** Logout button (all roles)

---

#### `POST /auth/forgot-password`
**Purpose:** Request a password reset link (email) or OTP (phone)

**Request Body:**
```json
{
  "identifier": "john@example.com",
  "role": "customer"
}
```
> `role` can be `"customer"` or `"worker"`
> `identifier` can be email (sends reset link) or phone number (sends OTP)

**Response:** `{ "success": true, "message": "Reset link/OTP sent" }`

**Used on:** `/forgot-password` and `/worker/forgot-password`

---

#### `POST /auth/verify-otp`
**Purpose:** Verify OTP for phone-based password reset

**Request Body:**
```json
{
  "phone": "9876543210",
  "otp": "123456"
}
```

**Response:**
```json
{ "resetToken": "temp_token_for_password_reset" }
```

**Used on:** Forgot password OTP step

---

#### `POST /auth/reset-password`
**Purpose:** Set a new password after verification

**Request Body:**
```json
{
  "token": "reset_token_here",
  "password": "NewPass@123"
}
```

**Response:** `{ "success": true }`

**Used on:** `/reset-password` page

---

## 2. Customer

> All endpoints require customer to be logged in.

---

### Service Discovery

---

#### `GET /customer/categories`
**Purpose:** Fetch all available service categories

**Response:**
```json
[
  {
    "_id": "...",
    "name": "Electrical",
    "slug": "electrical",
    "image": "https://...",
    "description": "...",
    "priceStartsFrom": 300,
    "isActive": true
  }
]
```

**Used on:** Services page (`/services`) and booking creation (`/bookings/new`)

---

#### `GET /customer/categories/{slug}`
**Purpose:** Get full detail of a specific service category

**URL Param:** `slug` — e.g., `electrical`, `plumbing`

**Response:**
```json
{
  "name": "Electrical",
  "slug": "electrical",
  "description": "Full description...",
  "services": ["Wiring", "Fan installation", "Switchboard repair"],
  "faqs": [{ "question": "...", "answer": "..." }],
  "highlights": ["...", "..."],
  "priceStartsFrom": 300
}
```

**Used on:** Service detail page (`/services/[slug]`)

---

#### `GET /customer/banners`
**Purpose:** Fetch promotional banners for the carousel on services page

**Response:**
```json
[
  {
    "_id": "...",
    "imageUrl": "https://...",
    "ctaText": "Book Now",
    "ctaUrl": "/services/electrical",
    "order": 1,
    "isActive": true
  }
]
```

**Used on:** Services page (`/services`)

---

#### `GET /booking/workers/availability-summary`
**Purpose:** Check how many workers are available in a given area before creating a booking

**Query Params:**
| Param | Type | Example |
|-------|------|---------|
| category | string | `electrical` |
| latitude | number | `28.6139` |
| longitude | number | `77.2090` |

**Response:**
```json
{
  "total": 5,
  "active": 3,
  "inactive": 2
}
```

**Used on:** Booking creation page (`/bookings/new`)

---

### Bookings

---

#### `POST /booking`
**Purpose:** Create a new service booking

**Request Format:** `multipart/form-data`

**Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| category | string | Yes | Category ID |
| workDescription | string | Yes | Text description of work |
| latitude | number | Yes | Customer's latitude |
| longitude | number | Yes | Customer's longitude |
| address | string | Yes | Human-readable address |
| timeSlot | string | Yes | `anytime` / `morning` / `afternoon` / `evening` |
| voiceNote | file | No | Audio file of voice description |
| voiceDurationSec | number | No | Duration of voice note in seconds |
| voiceLanguage | string | No | `hindi` / `english` |
| voiceTranscript | string | No | Auto-transcribed text of voice note |

**Response:**
```json
{
  "booking": {
    "_id": "...",
    "status": "finding_workers",
    "category": { "name": "Electrical", "slug": "electrical" },
    "workDescription": "Fix wiring in bedroom",
    "address": "...",
    "createdAt": "2026-05-28T10:00:00Z"
  }
}
```

**Used on:** Create booking page (`/bookings/new`)

---

#### `GET /customer/bookings`
**Purpose:** List all bookings for the logged-in customer

**Query Params:**
| Param | Type | Description |
|-------|------|-------------|
| status | string | Optional — filter by status (e.g., `in_progress`, `completed`) |

**Response:**
```json
[
  {
    "_id": "...",
    "status": "bids_received",
    "category": { "name": "Plumbing" },
    "workDescription": "...",
    "createdAt": "...",
    "bidsCount": 3,
    "amount": 500
  }
]
```

**Used on:** Bookings list page (`/bookings`)

---

#### `GET /customer/bookings/{id}`
**Purpose:** Get full detail of a single booking

**URL Param:** `id` — booking ID

**Response:**
```json
{
  "_id": "...",
  "status": "in_progress",
  "workDescription": "...",
  "address": "...",
  "timeSlot": "morning",
  "amount": 600,
  "paymentMethod": "online",
  "paymentStatus": "paid",
  "assignedWorker": {
    "_id": "...",
    "fullName": "Ramesh Kumar",
    "phone": "9876543210",
    "rating": 4.7,
    "profileImage": "https://..."
  },
  "completionCode": null,
  "createdAt": "..."
}
```

**Used on:** Booking detail page (`/bookings/[id]`)

---

#### `GET /booking/{bookingId}/bids`
**Purpose:** Fetch all worker bids on a specific booking

**Response:**
```json
[
  {
    "_id": "...",
    "worker": {
      "_id": "...",
      "fullName": "Ramesh Kumar",
      "rating": 4.8,
      "totalJobs": 52,
      "profileImage": "https://..."
    },
    "priceOffered": 550,
    "createdAt": "..."
  }
]
```

**Used on:** Booking detail page — bids section

---

#### `POST /booking/{bookingId}/bids/{bidId}/counter`
**Purpose:** Customer sends a counter offer to negotiate price with a worker

**URL Params:** `bookingId`, `bidId`

**Request Body:**
```json
{
  "amount": 450,
  "message": "Can you do it for ₹450?"
}
```
> `amount` is required. `message` is optional.
> Only valid when `negotiationStatus` is `none`, `worker_offered`, or `declined`.
> Maximum 10 negotiation rounds per bid.

**Response:**
```json
{
  "message": "Counter offer sent",
  "bid": {
    "_id": "...",
    "priceOffered": 500,
    "negotiationStatus": "customer_offered",
    "negotiations": [
      { "by": "customer", "amount": 450, "message": "Can you do it for ₹450?", "createdAt": "..." }
    ]
  }
}
```

> Worker is notified via Socket.IO (`booking:bid-negotiation`) and push notification.

**Used on:** Booking detail page — Counter button in bid negotiation modal

---

#### `POST /booking/{bookingId}/bids/{bidId}/accept`
**Purpose:** Accept a specific worker's bid

**URL Params:** `bookingId`, `bidId`

**Response:**
```json
{
  "booking": { "_id": "...", "status": "worker_accepted", "assignedWorker": { ... } }
}
```

**Used on:** Booking detail page — "Accept" button on a bid

---

#### `POST /booking/{bookingId}/payment`
**Purpose:** Initiate payment for a booking

**Request Body:**
```json
{ "method": "online" }
```
> `method` is either `"online"` or `"cash"`

**Response (online):**
```json
{
  "orderId": "order_razorpay_id",
  "amount": 60000,
  "currency": "INR",
  "keyId": "rzp_live_xxxxx"
}
```

**Response (cash):**
```json
{
  "booking": { "_id": "...", "status": "payment_done", "paymentMethod": "cash" }
}
```

**Used on:** Booking detail page — "Pay Now" button

---

#### `POST /booking/{bookingId}/payment/verify`
**Purpose:** Verify Razorpay payment after checkout completes

**Request Body:**
```json
{
  "razorpay_payment_id": "pay_xxx",
  "razorpay_order_id": "order_xxx",
  "razorpay_signature": "signature_hash"
}
```

**Response:**
```json
{
  "booking": { "_id": "...", "status": "payment_done" }
}
```

**Used on:** Booking detail page — called automatically after Razorpay checkout

---

#### `POST /booking/{bookingId}/payment/reconcile`
**Purpose:** Check and reconcile payment status if webhook was missed

**Request Body:**
```json
{ "razorpay_order_id": "order_xxx" }
```

**Response:**
```json
{
  "status": "paid",
  "booking": { "status": "payment_done" }
}
```

**Used on:** Booking detail page — called when payment status is uncertain

---

#### `POST /customer/bookings/{bookingId}/reveal-completion-code`
**Purpose:** Reveal the 4-digit completion PIN to the customer

**Request Body:** None

**Response:**
```json
{ "completionCode": "4821" }
```

**Used on:** Booking detail page — "Reveal Completion Code" button

---

#### `POST /customer/bookings/{bookingId}/cancel`
**Purpose:** Cancel a booking

**Request Body:**
```json
{ "reason": "Worker not responding" }
```

**Response:**
```json
{ "booking": { "_id": "...", "status": "cancelled" } }
```

**Used on:** Booking detail page — Cancel button

---

#### `POST /customer/bookings/{bookingId}/review`
**Purpose:** Submit a star rating and review for a completed booking

**Request Body:**
```json
{
  "rating": 5,
  "feedback": "Excellent work, very professional!"
}
```

**Response:**
```json
{ "success": true, "review": { "rating": 5, "feedback": "..." } }
```

**Used on:** Booking detail page — after completion

---

#### `POST /customer/bookings/{bookingId}/refund-details`
**Purpose:** Submit bank/UPI details for a refund request

**Request Body:**
```json
{
  "bankAccountNumber": "123456789012",
  "ifscCode": "HDFC0001234",
  "bankName": "HDFC Bank",
  "holderName": "John Doe"
}
```
> OR UPI: `{ "upiId": "john@upi" }`

**Response:**
```json
{ "success": true, "message": "Refund request submitted" }
```

**Used on:** Booking detail page — refund section after cancellation

---

### Customer Profile & Account

---

#### `PUT /customer/profile`
**Purpose:** Update customer profile details

**Request Format:** `multipart/form-data`

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| fullName | string | Updated name |
| bio | string | Short bio |
| image | file | Profile photo |

**Response:**
```json
{ "user": { "_id": "...", "fullName": "...", "bio": "...", "profileImage": "https://..." } }
```

**Used on:** Profile page (`/profile`)

---

#### `GET /customer/transactions`
**Purpose:** Fetch payment transaction history

**Response:**
```json
[
  {
    "_id": "...",
    "type": "booking_payment",
    "amount": 600,
    "paymentMethod": "online",
    "status": "paid",
    "booking": { "category": "Electrical", "workDescription": "..." },
    "createdAt": "..."
  }
]
```

**Used on:** Transactions page (`/transactions`)

---

### Customer Notifications

---

#### `GET /customer/notifications`
**Purpose:** Fetch all notifications for customer

**Response:**
```json
[
  {
    "_id": "...",
    "title": "New bid received",
    "message": "Worker Ramesh submitted a bid of ₹500",
    "type": "bid_submitted",
    "isRead": false,
    "createdAt": "..."
  }
]
```

**Used on:** Notifications page (`/notifications`)

---

#### `PATCH /customer/notifications/{id}/read`
**Purpose:** Mark a single notification as read

**Response:** `{ "success": true }`

---

#### `PATCH /customer/notifications/read-all`
**Purpose:** Mark all notifications as read

**Response:** `{ "success": true }`

---

#### `DELETE /customer/notifications/{id}`
**Purpose:** Delete a single notification

**Response:** `{ "success": true }`

---

### Customer Help & Support

---

#### `GET /customer/chatbot-qa`
**Purpose:** Fetch FAQ answers for the help center

**Response:**
```json
[
  {
    "_id": "...",
    "category": "booking_help",
    "question": "How do I cancel a booking?",
    "answer": "Go to your booking detail and click Cancel..."
  }
]
```

**Used on:** Help & Support page (`/help-support`)

---

#### `GET /customer/help-tickets`
**Purpose:** List customer's support tickets

**Query Params:**
| Param | Type | Description |
|-------|------|-------------|
| q | string | Search term |
| status | string | `open` / `resolved` |

**Response:**
```json
[
  {
    "_id": "...",
    "category": "payment_issue",
    "message": "I was charged twice...",
    "status": "open",
    "createdAt": "..."
  }
]
```

---

#### `GET /customer/help-tickets/{id}`
**Purpose:** Get full conversation thread of a ticket

**Response:**
```json
{
  "_id": "...",
  "category": "payment_issue",
  "status": "open",
  "messages": [
    { "from": "customer", "message": "I was charged twice", "createdAt": "..." },
    { "from": "admin", "message": "We are looking into this", "createdAt": "..." }
  ]
}
```

---

#### `POST /customer/help-tickets`
**Purpose:** Create a new support ticket

**Request Body:**
```json
{
  "category": "payment_issue",
  "message": "I was charged but booking was not confirmed",
  "phoneNumber": "9876543210"
}
```

**Response:**
```json
{ "ticket": { "_id": "...", "status": "open" } }
```

---

#### `POST /customer/help-tickets/{id}/message`
**Purpose:** Send a follow-up message on an existing ticket

**Request Body:**
```json
{ "message": "Still waiting for resolution..." }
```

**Response:**
```json
{ "ticket": { "_id": "...", "messages": [...] } }
```

---

#### `POST /customer/help-tickets/{id}/escalate`
**Purpose:** Escalate a ticket for urgent attention

**Request Body:**
```json
{ "phoneNumber": "9876543210" }
```

**Response:** `{ "success": true }`

---

## 3. Worker

> All endpoints require worker to be logged in.

---

### Worker Profile

---

#### `GET /worker/profile`
**Purpose:** Fetch worker's own profile data

**Response:**
```json
{
  "_id": "...",
  "fullName": "Ramesh Kumar",
  "phone": "9876543210",
  "email": "ramesh@example.com",
  "bio": "5 years experience in electrical work",
  "categories": ["electrical", "ac-repair"],
  "profileImage": "https://...",
  "accountStatus": "live",
  "profileCompleted": true,
  "location": { "lat": 28.61, "lng": 77.20, "address": "..." },
  "bankDetails": { "bankName": "...", "accountNumber": "...", "ifscCode": "..." },
  "rating": 4.7,
  "totalJobs": 52
}
```

**Used on:** Worker dashboard and settings pages

---

#### `POST /worker/complete-profile`
**Purpose:** Submit profile completion data (after registration)

**Request Format:** `multipart/form-data`

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| bio | string | Work experience / skills |
| categories | array | Selected work categories |
| profileImage | file | Profile photo |
| latitude | number | Work area latitude |
| longitude | number | Work area longitude |
| address | string | Work area address |
| bankHolderName | string | Bank account holder name |
| bankName | string | Bank name |
| accountNumber | string | Account number |
| ifscCode | string | IFSC code |

**Response:**
```json
{ "worker": { "_id": "...", "profileCompleted": true } }
```

**Used on:** Complete profile page (`/worker/complete-profile`)

---

#### `PUT /worker/profile`
**Purpose:** Update worker profile (bio, categories, phone)

**Request Body:**
```json
{
  "bio": "Updated bio text",
  "categories": ["electrical", "plumbing"],
  "regularPhone": "9876543210"
}
```
> Can send any one or combination of these fields

**Response:**
```json
{ "worker": { "_id": "...", "bio": "...", "categories": [...] } }
```

**Used on:** Worker settings page (`/worker/settings`)

---

### Worker Dashboard

---

#### `GET /worker/dashboard`
**Purpose:** Fetch all dashboard metrics and stats

**Response:**
```json
{
  "stats": {
    "totalJobs": 52,
    "rating": 4.7,
    "totalEarnings": 25000,
    "walletBalance": 3500,
    "todayEarnings": 600,
    "weekEarnings": 3200,
    "lastWeekEarnings": 2800,
    "cashEarnings": 8000,
    "onlineEarnings": 17000
  },
  "activeBookings": [
    { "_id": "...", "status": "in_progress", "category": "Electrical", "amount": 600 }
  ],
  "recentReviews": [
    { "rating": 5, "feedback": "Great work!", "customerName": "...", "createdAt": "..." }
  ],
  "dailyEarnings": [
    { "date": "2026-05-27", "amount": 600 }
  ],
  "monthlyEarnings": [
    { "month": "May 2026", "amount": 12500 }
  ]
}
```

**Used on:** Worker dashboard (`/worker/dashboard`)

---

#### `PUT /worker/toggle-active`
**Purpose:** Toggle worker online/offline availability status

**Request Body:** None

**Response:**
```json
{ "isActive": true }
```

**Used on:** Worker dashboard — Online/Offline toggle switch

---

#### `PUT /worker/location`
**Purpose:** Update worker's current GPS location

**Request Body:**
```json
{
  "latitude": 28.6139,
  "longitude": 77.2090,
  "address": "Connaught Place, New Delhi"
}
```

**Response:** `{ "success": true }`

**Used on:** Worker dashboard (continuous location sync during active jobs)

---

### Work Requests & Job Management

---

#### `GET /worker/work-requests`
**Purpose:** Fetch list of available bookings to bid on

**Response:**
```json
{
  "available": [
    {
      "_id": "...",
      "status": "finding_workers",
      "category": { "name": "Electrical", "slug": "electrical" },
      "workDescription": "Fix lights in kitchen",
      "address": "Lajpat Nagar, Delhi",
      "timeSlot": "morning",
      "estimatedAmount": 500,
      "voiceNoteUrl": "https://...",
      "createdAt": "..."
    }
  ],
  "active": [...],
  "completed": [...]
}
```

**Used on:** Work requests page (`/worker/work-requests`)

---

#### `GET /worker/work-requests/{bookingId}`
**Purpose:** Fetch full detail of a specific booking/job

**Response:**
```json
{
  "_id": "...",
  "status": "worker_accepted",
  "workDescription": "Fix lights in kitchen",
  "address": "123, Main Street, Delhi",
  "latitude": 28.61,
  "longitude": 77.20,
  "timeSlot": "morning",
  "amount": 550,
  "customer": { "fullName": "John Doe", "phone": "9876543210", "rating": 4.5 },
  "voiceNoteUrl": "https://...",
  "myBid": { "priceOffered": 550, "status": "accepted" }
}
```

**Used on:** Work request detail page (`/worker/work-requests/[id]`)

---

#### `POST /worker/work-requests/{bookingId}/bid`
**Purpose:** Submit a price bid on an available booking

**Request Body:**
```json
{ "priceOffered": 550 }
```

**Response:**
```json
{
  "bid": { "_id": "...", "priceOffered": 550, "status": "pending" }
}
```

**Used on:** Work request detail page — "Submit Bid" button

---

#### `POST /worker/booking/{bookingId}/bids/{bidId}/negotiate-respond`
**Purpose:** Worker responds to customer's counter offer — accept, counter, or decline

**URL Params:** `bookingId`, `bidId`

**Request Body:**
```json
{
  "action": "counter",
  "amount": 480,
  "message": "Best I can do is ₹480"
}
```
> `action` is required: `accept` | `counter` | `decline`
> `amount` is required only when `action = counter`
> `message` is optional
> Only valid when `negotiationStatus === 'customer_offered'`

**Response:**
```json
{
  "message": "Response sent",
  "bid": {
    "_id": "...",
    "negotiationStatus": "worker_offered",
    "negotiations": [
      { "by": "customer", "amount": 450, "message": "Can you do ₹450?", "createdAt": "..." },
      { "by": "worker", "amount": 480, "message": "Best I can do is ₹480", "createdAt": "..." }
    ],
    "agreedAmount": null
  }
}
```

> When `action = accept`: `negotiationStatus` → `agreed`, `agreedAmount` is set.
> When `action = counter`: `negotiationStatus` → `worker_offered`.
> When `action = decline`: `negotiationStatus` → `declined`.
> Customer is notified via Socket.IO (`booking:bid-negotiation`) in real-time.

**Used on:** Worker work-requests list page (inline) and work-request detail page

---

#### `POST /worker/booking/{bookingId}/approve`
**Purpose:** Approve a booking after customer accepts the bid

**Request Body:** None

**Response:**
```json
{ "booking": { "_id": "...", "status": "worker_approved" } }
```

**Used on:** Work requests active tab — "Approve Booking" button

---

#### `POST /worker/booking/{bookingId}/request-completion-code`
**Purpose:** Request the customer to reveal the completion PIN

**Request Body:** None

**Response:**
```json
{ "success": true, "message": "Customer notified to reveal completion code" }
```

**Used on:** Work request detail — "Request Completion Code" button

---

#### `POST /worker/booking/{bookingId}/complete`
**Purpose:** Mark the job as completed by entering the PIN received from customer

**Request Body:**
```json
{ "pin": "4821" }
```

**Response:**
```json
{
  "booking": { "_id": "...", "status": "completed" },
  "earning": { "amount": 440, "type": "worker_earning" }
}
```

**Used on:** Work request detail — PIN entry and "Complete Job" button

---

#### `POST /worker/booking/{bookingId}/cancel`
**Purpose:** Cancel a booking as worker (before completion)

**Request Body:**
```json
{ "reason": "Unable to reach location due to emergency" }
```

**Response:**
```json
{ "booking": { "_id": "...", "status": "cancelled" } }
```

---

### Worker Funds & Wallet

---

#### `GET /worker/funds`
**Purpose:** Fetch complete wallet and financial summary

**Response:**
```json
{
  "balance": 3500,
  "totalEarnings": 25000,
  "totalCommission": 5000,
  "cashEarnings": 8000,
  "onlineEarnings": 17000,
  "duesPending": 300,
  "daysOverdue": 5,
  "isOverdue": false,
  "withdrawalDisabled": false,
  "bankDetails": {
    "bankName": "HDFC Bank",
    "accountNumber": "XXXX1234",
    "ifscCode": "HDFC0001234",
    "holderName": "Ramesh Kumar"
  }
}
```

**Used on:** Worker funds page (`/worker/funds`)

---

#### `POST /worker/withdraw`
**Purpose:** Initiate a withdrawal request

**Request Body:**
```json
{ "amount": 2000 }
```

**Response:**
```json
{
  "orderId": "order_razorpay_id",
  "amount": 200000,
  "currency": "INR"
}
```
> Opens Razorpay checkout for withdrawal fee/confirmation

**Used on:** Worker funds page — "Withdraw" button

---

#### `GET /worker/withdrawals`
**Purpose:** Fetch withdrawal request history

**Response:**
```json
[
  {
    "_id": "...",
    "amount": 2000,
    "status": "completed",
    "bankDetails": { "bankName": "HDFC", "accountNumber": "XXXX1234" },
    "createdAt": "...",
    "completedAt": "..."
  }
]
```

**Used on:** Worker funds page — Withdrawals tab

---

#### `GET /worker/wallet/transactions`
**Purpose:** Fetch detailed wallet transaction ledger

**Response:**
```json
[
  {
    "_id": "...",
    "type": "worker_earning",
    "amount": 550,
    "description": "Earning from Electrical job",
    "createdAt": "..."
  },
  {
    "_id": "...",
    "type": "commission_deducted",
    "amount": -110,
    "description": "20% platform commission",
    "createdAt": "..."
  }
]
```

**Used on:** Worker funds page — All Transactions tab

---

#### `PUT /worker/bank-details`
**Purpose:** Add or update bank account details

**Request Body:**
```json
{
  "holderName": "Ramesh Kumar",
  "bankName": "HDFC Bank",
  "accountNumber": "123456789012",
  "ifscCode": "HDFC0001234"
}
```

**Response:**
```json
{ "worker": { "_id": "...", "bankDetails": { ... } } }
```

**Used on:** Worker funds page — Bank Details section

---

### Worker Dues

---

#### `POST /worker/dues/pay`
**Purpose:** Pay pending dues via Razorpay

**Request Body:** None

**Response:**
```json
{
  "orderId": "order_razorpay_id",
  "amount": 30000,
  "currency": "INR"
}
```

**Used on:** Worker funds page — "Pay Dues" button

---

#### `POST /worker/dues/verify`
**Purpose:** Verify Razorpay dues payment

**Request Body:**
```json
{
  "razorpay_payment_id": "pay_xxx",
  "razorpay_order_id": "order_xxx",
  "razorpay_signature": "signature_hash"
}
```

**Response:** `{ "success": true }`

---

#### `POST /worker/dues/pay-wallet`
**Purpose:** Pay dues by deducting from wallet balance

**Request Body:** None

**Response:**
```json
{ "success": true, "newBalance": 2900, "duesPending": 0 }
```

**Used on:** Worker funds page — "Deduct from Wallet" button

---

### Worker eKYC

---

#### `POST /worker/ekyc/re-request`
**Purpose:** Re-request eKYC verification after rejection (with new documents)

**Request Format:** `multipart/form-data`

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| aadhaarFront | file | New Aadhaar front photo |
| aadhaarBack | file | New Aadhaar back photo |

**Response:**
```json
{ "worker": { "_id": "...", "accountStatus": "ekyc_pending" } }
```

**Used on:** Worker eKYC page (`/worker/ekyc`)

---

### Worker Notifications

---

#### `GET /worker/notifications`
**Purpose:** Fetch worker's notifications

**Response:** Same structure as customer notifications

**Used on:** Worker notifications page + complete-profile page (checks for admin availability notification)

---

#### `PATCH /worker/notifications/{id}/read`
**Purpose:** Mark a notification as read

---

#### `PATCH /worker/notifications/read-all`
**Purpose:** Mark all notifications as read

---

#### `DELETE /worker/notifications/{id}`
**Purpose:** Delete a notification

---

### Worker Help & Support

---

#### `GET /worker/chatbot-qa`
**Purpose:** Fetch FAQ answers for worker help center

---

#### `GET /worker/help-tickets`
**Purpose:** List worker's support tickets (params: `q`, `status`)

---

#### `GET /worker/help-tickets/{id}`
**Purpose:** Get full ticket conversation thread

---

#### `POST /worker/help-tickets`
**Purpose:** Create a new support ticket

**Request Body:**
```json
{
  "category": "payment_issue",
  "message": "My earning was not credited",
  "phoneNumber": "9876543210"
}
```

---

#### `POST /worker/help-tickets/{id}/message`
**Purpose:** Send a follow-up message on a ticket

**Request Body:** `{ "message": "Any update on this?" }`

---

#### `POST /worker/help-tickets/{id}/escalate`
**Purpose:** Escalate ticket urgency

**Request Body:** `{ "phoneNumber": "9876543210" }`

---

## 4. Admin

> All endpoints require admin to be logged in.

---

### Admin Dashboard

---

#### `GET /admin/dashboard`
**Purpose:** Fetch all KPI metrics and chart data

**Response:**
```json
{
  "totalCustomers": 1250,
  "activeWorkers": 48,
  "pendingEkyc": 5,
  "pendingWithdrawals": 8,
  "openTickets": 12,
  "todayJobsCompleted": 23,
  "monthlyProfit": 45000,
  "revenueChart": [
    { "date": "2026-05-28", "revenue": 8500 }
  ],
  "bookingStatusChart": {
    "completed": 450, "in_progress": 12, "cancelled": 38, "finding_workers": 20
  },
  "paymentMethodChart": { "online": 280, "cash": 170 },
  "workerStatusChart": { "live": 48, "pending": 5, "rejected": 3 },
  "topCategories": [
    { "name": "Electrical", "revenue": 18000, "bookings": 120 }
  ]
}
```

**Used on:** Admin dashboard (`/admin/dashboard`)

---

### eKYC Verification

---

#### `GET /admin/ekyc/pending`
**Purpose:** Fetch all workers waiting for eKYC verification

**Response:**
```json
[
  {
    "_id": "...",
    "fullName": "Ramesh Kumar",
    "phone": "9876543210",
    "aadhaarFront": "https://...",
    "aadhaarBack": "https://...",
    "accountStatus": "ekyc_pending",
    "registeredAt": "..."
  }
]
```

**Used on:** Admin eKYC page (`/admin/ekyc`)

---

#### `POST /admin/ekyc/{id}/approve`
**Purpose:** Approve worker's eKYC — makes account Live

**Request Body:** None

**Response:**
```json
{ "worker": { "_id": "...", "accountStatus": "live" } }
```

**Used on:** Admin eKYC page — "Approve" button

---

#### `POST /admin/ekyc/{id}/reject`
**Purpose:** Reject worker's eKYC with a reason

**Request Body:**
```json
{ "reason": "Aadhaar photo is blurry, please re-upload" }
```

**Response:**
```json
{ "worker": { "_id": "...", "accountStatus": "rejected", "rejectionReason": "..." } }
```

**Used on:** Admin eKYC page — "Reject" button

---

#### `POST /admin/ekyc/{workerId}/video-result`
**Purpose:** Submit result of the video KYC call

**Request Body:**
```json
{
  "result": "completed",
  "notes": "Documents verified successfully"
}
```
> `result` can be `"completed"` or `"incomplete"`

**Response:**
```json
{ "worker": { "accountStatus": "ekyc_done" } }
```

**Used on:** Admin eKYC page — after video call ends

---

#### `POST /admin/ekyc/{workerId}/capture`
**Purpose:** Save a photo captured during the video KYC call

**Request Body:**
```json
{ "imageData": "data:image/png;base64,..." }
```
> Base64 encoded image captured from the video stream

**Response:**
```json
{ "success": true, "captureUrl": "https://..." }
```

**Used on:** Admin eKYC page — "Capture" button during video call

---

### Withdrawals

---

#### `GET /admin/withdrawals`
**Purpose:** Fetch all withdrawal requests

**Response:**
```json
{
  "pending": [
    {
      "_id": "...",
      "worker": { "fullName": "Ramesh Kumar", "phone": "..." },
      "amount": 2000,
      "bankDetails": { "bankName": "HDFC", "accountNumber": "XXXX1234", "ifscCode": "HDFC0001234" },
      "status": "pending",
      "requestedAt": "..."
    }
  ],
  "history": [
    { "_id": "...", "amount": 1500, "status": "completed", "completedAt": "..." }
  ]
}
```

**Used on:** Admin withdrawals page (`/admin/withdrawals`)

---

#### `POST /admin/withdrawals/{id}/complete`
**Purpose:** Mark a withdrawal as completed (after manual bank transfer)

**Request Body:** None

**Response:**
```json
{ "withdrawal": { "_id": "...", "status": "completed" } }
```

---

#### `POST /admin/withdrawals/{id}/decline`
**Purpose:** Decline a withdrawal request

**Request Body:**
```json
{ "reason": "Incorrect bank account number provided" }
```

**Response:**
```json
{ "withdrawal": { "_id": "...", "status": "declined" } }
```

---

### Refunds

---

#### `POST /admin/refunds/{id}/process`
**Purpose:** Approve and process a customer refund

**Request Body:** None

**Response:**
```json
{ "refund": { "_id": "...", "status": "processed" } }
```

**Used on:** Admin refunds page (`/admin/refunds`)

---

#### `POST /admin/refunds/{id}/reject`
**Purpose:** Reject a customer refund request

**Request Body:**
```json
{ "reason": "Service was fully completed as per agreement" }
```

**Response:**
```json
{ "refund": { "_id": "...", "status": "rejected" } }
```

---

### Worker Dues

---

#### `GET /admin/worker-dues`
**Purpose:** Fetch all workers with pending dues

**Response:**
```json
{
  "workersWithDues": [
    {
      "_id": "...",
      "fullName": "Ramesh Kumar",
      "phone": "9876543210",
      "dues": 300,
      "duesPending": 300,
      "duesCollectedTotal": 100,
      "daysSinceDues": 15,
      "isOverdue": true,
      "balance": 3500
    }
  ],
  "workersPaidDues": [...],
  "totalCollected": 5000,
  "overdueCount": 3
}
```

**Used on:** Worker dues page (`/admin/worker-dues`)

---

#### `GET /admin/cash-payments`
**Purpose:** Fetch all completed cash bookings and surcharge details

**Response:**
```json
{
  "cashBookings": [
    {
      "_id": "...",
      "customer": { "fullName": "...", "phone": "..." },
      "assignedWorker": { "fullName": "...", "dues": 100 },
      "amount": 600,
      "cashSurcharge": 100,
      "updatedAt": "..."
    }
  ]
}
```

**Used on:** Worker dues page — Cash Jobs tab

---

#### `POST /admin/worker-dues/{workerId}/notify`
**Purpose:** Send a dues reminder notification to a specific worker

**Request Body:** None

**Response:** `{ "success": true }`

**Used on:** Worker dues page — "Notify" button

---

### Categories

---

#### `GET /admin/categories`
**Purpose:** Fetch all service categories

**Response:**
```json
[
  {
    "_id": "...",
    "name": "Electrical",
    "slug": "electrical",
    "description": "...",
    "priceStartsFrom": 300,
    "image": "https://...",
    "isActive": true,
    "order": 1
  }
]
```

---

#### `POST /admin/categories`
**Purpose:** Create a new service category

**Request Format:** `multipart/form-data`

**Fields:** name, description, tagline, priceStartsFrom, image (file), order, services (JSON array), faqs (JSON array)

**Response:** `{ "category": { "_id": "...", "name": "..." } }`

---

#### `PUT /admin/categories/{id}`
**Purpose:** Update an existing category

**Request Format:** `multipart/form-data` (same fields, all optional)

**Response:** `{ "category": { "_id": "...", ... } }`

---

#### `DELETE /admin/categories/{id}`
**Purpose:** Delete a category

**Response:** `{ "success": true }`

---

#### `PUT /admin/categories/{id}/details`
**Purpose:** Update category's rich details (services list, FAQs, highlights)

**Request Body:**
```json
{
  "services": ["Basic wiring", "Fan installation"],
  "faqs": [{ "question": "...", "answer": "..." }],
  "highlights": ["Fast service", "Verified experts"]
}
```

**Used on:** Admin category detail page (`/admin/categories/[id]/details`)

---

### Workers Management

---

#### `GET /admin/workers`
**Purpose:** List all workers with search and filter

**Query Params:**
| Param | Type | Description |
|-------|------|-------------|
| q | string | Search by name or phone |
| status | string | Filter by account status |
| page | number | Pagination |

**Response:**
```json
{
  "workers": [
    {
      "_id": "...",
      "fullName": "...",
      "phone": "...",
      "accountStatus": "live",
      "rating": 4.7,
      "totalJobs": 52
    }
  ],
  "total": 150
}
```

**Used on:** Admin workers list (`/admin/workers`)

---

#### `GET /admin/workers/{id}`
**Purpose:** Get complete worker profile and history

**Response:**
```json
{
  "_id": "...",
  "fullName": "Ramesh Kumar",
  "phone": "9876543210",
  "email": "...",
  "bio": "...",
  "accountStatus": "live",
  "categories": ["electrical"],
  "aadhaarFront": "https://...",
  "aadhaarBack": "https://...",
  "profileImage": "https://...",
  "rating": 4.7,
  "totalJobs": 52,
  "totalEarnings": 25000,
  "totalCommission": 5000,
  "bankDetails": { ... },
  "eKycHistory": [{ "status": "approved", "date": "..." }],
  "recentBookings": [...]
}
```

**Used on:** Admin worker detail page (`/admin/workers/[id]`)

---

### Customers Management

---

#### `GET /admin/customers`
**Purpose:** List all customers

**Response:**
```json
[
  {
    "_id": "...",
    "fullName": "John Doe",
    "email": "...",
    "phone": "...",
    "totalBookings": 8,
    "registeredAt": "..."
  }
]
```

**Used on:** Admin customers page (`/admin/customers`)

---

### Commissions

---

#### `GET /admin/commissions`
**Purpose:** Fetch commission configuration and history

**Response:**
```json
{
  "commissionRate": 20,
  "cashSurcharge": 100,
  "totalCommissionCollected": 45000,
  "records": [
    {
      "_id": "...",
      "worker": { "fullName": "..." },
      "booking": { "_id": "...", "amount": 600 },
      "commissionAmount": 120,
      "createdAt": "..."
    }
  ]
}
```

**Used on:** Admin commissions page (`/admin/commissions`)

---

### Chatbot / FAQ Management

---

#### `GET /admin/chatbot-qa`
**Purpose:** Fetch all FAQ entries in the knowledge base

**Response:**
```json
[
  { "_id": "...", "category": "booking_help", "question": "...", "answer": "..." }
]
```

---

#### `POST /admin/chatbot-qa`
**Purpose:** Create a new FAQ entry

**Request Body:**
```json
{
  "category": "payment_help",
  "question": "How do I get a refund?",
  "answer": "Go to your booking and click Request Refund..."
}
```

---

#### `PUT /admin/chatbot-qa/{id}`
**Purpose:** Update an FAQ entry

**Request Body:** Same as create (any fields)

---

#### `DELETE /admin/chatbot-qa/{id}`
**Purpose:** Delete an FAQ entry

---

### Admin Help & Support Tickets

---

#### `GET /admin/help-tickets`
**Purpose:** List all support tickets from customers and workers

**Query Params:** `q` (search), `status` (`open` / `resolved`)

**Response:**
```json
[
  {
    "_id": "...",
    "from": "customer",
    "category": "payment_issue",
    "status": "open",
    "user": { "fullName": "John Doe", "phone": "..." },
    "lastMessage": "...",
    "createdAt": "..."
  }
]
```

---

#### `POST /admin/help-tickets/{id}/reply`
**Purpose:** Send a reply to a customer or worker on their ticket

**Request Body:**
```json
{ "message": "We have processed your refund, please allow 3-5 business days." }
```

**Response:**
```json
{ "ticket": { "_id": "...", "messages": [...] } }
```

---

#### `POST /admin/help-tickets/{id}/resolve`
**Purpose:** Mark a ticket as resolved

**Request Body:** None

**Response:** `{ "ticket": { "status": "resolved" } }`

---

### Admin Notifications

---

#### `GET /admin/notifications`
**Purpose:** Fetch admin's notifications

---

#### `PATCH /admin/notifications/{id}/read`
**Purpose:** Mark a notification as read

---

#### `PATCH /admin/notifications/read-all`
**Purpose:** Mark all notifications as read

---

#### `DELETE /admin/notifications/{id}`
**Purpose:** Delete a notification

---

## 5. Push Notifications (Shared)

> These endpoints handle push notification registration for all roles.
> Called automatically by the app — no manual action needed.

---

#### `GET /notifications/push/config`
**Purpose:** Fetch VAPID public key for web push subscription

**Response:**
```json
{ "publicKey": "BHn38W..." }
```

---

#### `POST /notifications/push/subscribe`
**Purpose:** Subscribe browser to web push notifications

**Request Body:**
```json
{
  "subscription": {
    "endpoint": "https://fcm.googleapis.com/...",
    "keys": { "p256dh": "...", "auth": "..." }
  }
}
```

---

#### `POST /notifications/push/unsubscribe`
**Purpose:** Unsubscribe browser from web push

**Request Body:**
```json
{ "endpoint": "https://fcm.googleapis.com/..." }
```

---

#### `POST /notifications/push/unsubscribe-all`
**Purpose:** Remove all push subscriptions for the user (called on logout)

---

#### `POST /notifications/mobile/register`
**Purpose:** Register mobile device push token (for Capacitor/Android app)

**Request Body:**
```json
{
  "token": "fcm_device_token_here",
  "platform": "android"
}
```

---

#### `POST /notifications/mobile/unregister`
**Purpose:** Unregister a specific mobile push token

**Request Body:**
```json
{ "token": "fcm_device_token_here" }
```

---

#### `POST /notifications/mobile/unregister-all`
**Purpose:** Remove all mobile push tokens for the user (called on logout)

---

## 6. Quick Reference Table

### Auth Endpoints

| Method | Endpoint | Who Uses | Purpose |
|--------|----------|----------|---------|
| POST | `/auth/customer/register` | Customer | Register new customer |
| POST | `/auth/customer/login` | Customer | Customer login |
| POST | `/auth/customer/google` | Customer | Google login/signup |
| POST | `/auth/customer/google/complete` | Customer | Add phone to Google signup |
| POST | `/auth/worker/register` | Worker | Register with Aadhaar |
| POST | `/auth/worker/login` | Worker | Worker login |
| POST | `/auth/worker/google` | Worker | Worker Google login |
| POST | `/auth/worker/google/register` | Worker | Worker Google registration |
| POST | `/auth/admin/login` | Admin | Admin login |
| GET | `/auth/me` | All | Get current user |
| POST | `/auth/refresh` | All | Refresh access token |
| POST | `/auth/logout` | All | Logout |
| POST | `/auth/forgot-password` | Customer/Worker | Request password reset |
| POST | `/auth/verify-otp` | Customer/Worker | Verify OTP |
| POST | `/auth/reset-password` | Customer/Worker | Set new password |

---

### Customer Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/customer/categories` | List service categories |
| GET | `/customer/categories/{slug}` | Category detail |
| GET | `/customer/banners` | Promo banners |
| GET | `/booking/workers/availability-summary` | Check worker availability |
| POST | `/booking` | Create new booking |
| GET | `/customer/bookings` | List my bookings |
| GET | `/customer/bookings/{id}` | Booking detail |
| GET | `/booking/{bookingId}/bids` | Get bids on booking |
| POST | `/booking/{bookingId}/bids/{bidId}/accept` | Accept a bid |
| POST | `/booking/{bookingId}/bids/{bidId}/counter` | Customer sends counter offer (negotiation) |
| POST | `/booking/{bookingId}/payment` | Start payment |
| POST | `/booking/{bookingId}/payment/verify` | Verify Razorpay payment |
| POST | `/booking/{bookingId}/payment/reconcile` | Reconcile payment status |
| POST | `/customer/bookings/{id}/reveal-completion-code` | Reveal completion PIN |
| POST | `/customer/bookings/{id}/cancel` | Cancel booking |
| POST | `/customer/bookings/{id}/review` | Submit review |
| POST | `/customer/bookings/{id}/refund-details` | Submit refund bank info |
| PUT | `/customer/profile` | Update profile |
| GET | `/customer/transactions` | Payment history |
| GET | `/customer/notifications` | Get notifications |
| PATCH | `/customer/notifications/{id}/read` | Mark notification read |
| PATCH | `/customer/notifications/read-all` | Mark all read |
| DELETE | `/customer/notifications/{id}` | Delete notification |
| GET | `/customer/chatbot-qa` | Get FAQs |
| GET | `/customer/help-tickets` | List support tickets |
| GET | `/customer/help-tickets/{id}` | Ticket detail |
| POST | `/customer/help-tickets` | Create ticket |
| POST | `/customer/help-tickets/{id}/message` | Reply to ticket |
| POST | `/customer/help-tickets/{id}/escalate` | Escalate ticket |

---

### Worker Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/worker/profile` | Get worker profile |
| POST | `/worker/complete-profile` | Submit profile completion |
| PUT | `/worker/profile` | Update bio/categories/phone |
| GET | `/worker/dashboard` | Dashboard stats |
| PUT | `/worker/toggle-active` | Toggle online/offline |
| PUT | `/worker/location` | Update GPS location |
| GET | `/worker/work-requests` | Available/Active/Completed jobs |
| GET | `/worker/work-requests/{id}` | Job detail |
| POST | `/worker/work-requests/{id}/bid` | Submit bid |
| POST | `/worker/booking/{id}/bids/{bidId}/negotiate-respond` | Respond to customer counter offer (accept/counter/decline) |
| POST | `/worker/booking/{id}/approve` | Approve booking |
| POST | `/worker/booking/{id}/request-completion-code` | Request PIN |
| POST | `/worker/booking/{id}/complete` | Complete job (enter PIN) |
| POST | `/worker/booking/{id}/cancel` | Cancel booking |
| GET | `/worker/funds` | Wallet summary |
| POST | `/worker/withdraw` | Request withdrawal |
| GET | `/worker/withdrawals` | Withdrawal history |
| GET | `/worker/wallet/transactions` | Transaction ledger |
| PUT | `/worker/bank-details` | Update bank account |
| POST | `/worker/dues/pay` | Pay dues via Razorpay |
| POST | `/worker/dues/verify` | Verify dues payment |
| POST | `/worker/dues/pay-wallet` | Pay dues from wallet |
| POST | `/worker/ekyc/re-request` | Re-request eKYC |
| GET | `/worker/notifications` | Get notifications |
| PATCH | `/worker/notifications/{id}/read` | Mark read |
| PATCH | `/worker/notifications/read-all` | Mark all read |
| DELETE | `/worker/notifications/{id}` | Delete notification |
| GET | `/worker/chatbot-qa` | FAQs for workers |
| GET | `/worker/help-tickets` | List tickets |
| GET | `/worker/help-tickets/{id}` | Ticket detail |
| POST | `/worker/help-tickets` | Create ticket |
| POST | `/worker/help-tickets/{id}/message` | Reply to ticket |
| POST | `/worker/help-tickets/{id}/escalate` | Escalate ticket |

---

### Admin Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/admin/dashboard` | All KPIs and chart data |
| GET | `/admin/ekyc/pending` | eKYC queue |
| POST | `/admin/ekyc/{id}/approve` | Approve worker |
| POST | `/admin/ekyc/{id}/reject` | Reject worker |
| POST | `/admin/ekyc/{id}/video-result` | Save video call result |
| POST | `/admin/ekyc/{id}/capture` | Capture video screenshot |
| GET | `/admin/withdrawals` | All withdrawal requests |
| POST | `/admin/withdrawals/{id}/complete` | Mark withdrawal done |
| POST | `/admin/withdrawals/{id}/decline` | Decline withdrawal |
| POST | `/admin/refunds/{id}/process` | Approve refund |
| POST | `/admin/refunds/{id}/reject` | Reject refund |
| GET | `/admin/worker-dues` | Worker dues data |
| GET | `/admin/cash-payments` | Cash booking audit |
| POST | `/admin/worker-dues/{id}/notify` | Send dues reminder |
| GET | `/admin/workers` | Workers list |
| GET | `/admin/workers/{id}` | Worker full detail |
| GET | `/admin/customers` | Customers list |
| GET | `/admin/categories` | Categories list |
| POST | `/admin/categories` | Create category |
| PUT | `/admin/categories/{id}` | Update category |
| DELETE | `/admin/categories/{id}` | Delete category |
| PUT | `/admin/categories/{id}/details` | Update category details |
| GET | `/admin/commissions` | Commission data |
| GET | `/admin/chatbot-qa` | FAQ list |
| POST | `/admin/chatbot-qa` | Create FAQ |
| PUT | `/admin/chatbot-qa/{id}` | Update FAQ |
| DELETE | `/admin/chatbot-qa/{id}` | Delete FAQ |
| GET | `/admin/help-tickets` | All support tickets |
| POST | `/admin/help-tickets/{id}/reply` | Reply to ticket |
| POST | `/admin/help-tickets/{id}/resolve` | Resolve ticket |
| GET | `/admin/notifications` | Admin notifications |
| PATCH | `/admin/notifications/{id}/read` | Mark read |
| PATCH | `/admin/notifications/read-all` | Mark all read |
| DELETE | `/admin/notifications/{id}` | Delete notification |

---

### Push Notification Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/notifications/push/config` | Get VAPID key |
| POST | `/notifications/push/subscribe` | Web push subscribe |
| POST | `/notifications/push/unsubscribe` | Web push unsubscribe |
| POST | `/notifications/push/unsubscribe-all` | Remove all web push |
| POST | `/notifications/mobile/register` | Register mobile token |
| POST | `/notifications/mobile/unregister` | Remove mobile token |
| POST | `/notifications/mobile/unregister-all` | Remove all mobile tokens |

---

*FIXO API Reference | Total endpoints: ~87 | Updated May 2026*
