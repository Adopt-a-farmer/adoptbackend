# Adopt-A-Farmer API Documentation

## Base URL
```
http://localhost:5000/api
```

## Authentication
Most endpoints require authentication via JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

---

## 🔐 Authentication Routes
**Base:** `/api/auth`

### POST /register
Register a new user
- **Body:** `{ firstName, lastName, email, password, role }`
- **Roles:** farmer, adopter, expert, admin
- **Returns:** User data + JWT token

### POST /login
Login user
- **Body:** `{ email, password }`
- **Returns:** User data + JWT token

### GET /me
Get current user profile
- **Auth:** Required
- **Returns:** Current user data

### PUT /me
Update current user profile
- **Auth:** Required
- **Body:** `{ firstName, lastName, phone, etc. }`
- **Returns:** Updated user data

---

## 👥 User Management Routes
**Base:** `/api/users`

### GET /
Get all users (Admin only)
- **Auth:** Required (Admin)
- **Query:** `page, limit, search, role, status`
- **Returns:** Paginated users list

### GET /:id
Get specific user by ID
- **Auth:** Required
- **Returns:** User profile data

### PUT /:id
Update user profile
- **Auth:** Required (Own profile or Admin)
- **Body:** User update data
- **Returns:** Updated user

### DELETE /:id
Deactivate user account
- **Auth:** Required (Admin)
- **Returns:** Success message

---

## 🚜 Farmer Routes
**Base:** `/api/farmers`

### GET /
Get all farmers with filters
- **Query:** `page, limit, farmingType, location, verified, search`
- **Returns:** Paginated farmers list

### GET /:id
Get specific farmer profile
- **Returns:** Detailed farmer profile

### POST /profile
Create/Update farmer profile
- **Auth:** Required (Farmer)
- **Body:** Complete farmer profile data
- **Returns:** Created/Updated profile

### GET /:id/adoptions
Get farmer's adoptions
- **Auth:** Required (Farmer or Admin)
- **Returns:** List of adoptions

### POST /:id/adopt
Adopt a farmer
- **Auth:** Required (Adopter)
- **Body:** `{ packageType, duration, message }`
- **Returns:** Adoption record

### GET /:id/analytics
Get farmer dashboard analytics
- **Auth:** Required (Farmer)
- **Returns:** Dashboard statistics

---

## 🤝 Adopter Routes
**Base:** `/api/adopters`

### GET /dashboard
Get adopter dashboard data
- **Auth:** Required (Adopter)
- **Returns:** Dashboard analytics

### GET /adoptions
Get adopter's adoptions
- **Auth:** Required (Adopter)
- **Query:** `status, page, limit`
- **Returns:** List of adoptions

### PUT /adoptions/:id
Update adoption details
- **Auth:** Required (Adopter)
- **Body:** Adoption update data
- **Returns:** Updated adoption

### POST /adoptions/:id/feedback
Add feedback to adoption
- **Auth:** Required (Adopter)
- **Body:** `{ rating, feedback, images }`
- **Returns:** Success message

---

## 💳 Payment Routes
**Base:** `/api/payments`

### POST /initialize
Initialize payment
- **Auth:** Required
- **Body:** `{ amount, type, metadata }`
- **Returns:** Payment URL and reference

### POST /verify
Verify payment
- **Auth:** Required
- **Body:** `{ reference }`
- **Returns:** Payment verification result

### GET /
Get user payments
- **Auth:** Required
- **Query:** `status, type, page, limit`
- **Returns:** Paginated payments list

### POST /webhook
Paystack webhook handler
- **Headers:** `x-paystack-signature`
- **Body:** Paystack event data
- **Returns:** Success response

---

## 📁 File Upload Routes
**Base:** `/api/upload`

### POST /single
Upload single file
- **Auth:** Required
- **Body:** FormData with file
- **Returns:** File URL and details

### POST /multiple
Upload multiple files
- **Auth:** Required
- **Body:** FormData with files array
- **Returns:** Array of file URLs

### DELETE /
Delete file from Cloudinary
- **Auth:** Required
- **Body:** `{ public_id }`
- **Returns:** Success message

---

## 💬 Message Routes
**Base:** `/api/messages`

### GET /conversations
Get user's conversations
- **Auth:** Required
- **Returns:** List of conversations

### GET /conversations/:userId
Get conversation with specific user
- **Auth:** Required
- **Query:** `page, limit`
- **Returns:** Paginated messages

### POST /send
Send a message
- **Auth:** Required
- **Body:** `{ recipientId, content, type, attachments }`
- **Returns:** Created message

### PUT /:id/read
Mark message as read
- **Auth:** Required
- **Returns:** Success message

### DELETE /:id
Delete message
- **Auth:** Required
- **Returns:** Success message

---

## 📚 Knowledge Hub Routes
**Base:** `/api/knowledge`

### GET /articles
Get knowledge articles
- **Query:** `page, limit, category, search, difficulty, sort`
- **Returns:** Paginated articles list

### GET /articles/:id
Get specific article
- **Returns:** Article details with comments

### POST /articles
Create knowledge article
- **Auth:** Required (Expert/Admin)
- **Body:** Article data
- **Returns:** Created article

### POST /articles/:id/like
Like/Unlike article
- **Auth:** Required
- **Returns:** Like status

### GET /calendar
Get farming calendar
- **Query:** `region, month, category, crop, livestock`
- **Returns:** Calendar entries

### POST /calendar
Create calendar entry
- **Auth:** Required (Expert/Admin)
- **Body:** Calendar entry data
- **Returns:** Created entry

---

## 💰 Crowdfunding Routes
**Base:** `/api/crowdfunding`

### GET /projects
Get crowdfunding projects
- **Query:** `page, limit, category, search, sort`
- **Returns:** Paginated projects list

### GET /projects/:id
Get specific project
- **Returns:** Project details with backers

### POST /projects
Create crowdfunding project
- **Auth:** Required (Farmer)
- **Body:** Project data
- **Returns:** Created project

### POST /projects/:id/back
Back a project
- **Auth:** Required
- **Body:** `{ amount, message }`
- **Returns:** Payment initialization

### POST /verify-payment
Verify crowdfunding payment
- **Auth:** Required
- **Body:** `{ reference }`
- **Returns:** Payment verification

### POST /projects/:id/updates
Add project update
- **Auth:** Required (Project Owner)
- **Body:** `{ title, content, images }`
- **Returns:** Created update

---

## 🚗 Farm Visits Routes
**Base:** `/api/visits`

### GET /
Get farm visits
- **Auth:** Required
- **Query:** `status, date`
- **Returns:** User's visits list

### GET /:id
Get specific visit
- **Auth:** Required
- **Returns:** Visit details

### POST /
Schedule farm visit
- **Auth:** Required (Adopter)
- **Body:** `{ farmerId, scheduledDate, duration, purpose }`
- **Returns:** Created visit

### PUT /:id/status
Update visit status
- **Auth:** Required (Farmer/Admin)
- **Body:** `{ status, reason }`
- **Returns:** Updated visit

### POST /:id/feedback
Add visit feedback
- **Auth:** Required (Adopter)
- **Body:** `{ rating, comment, highlights }`
- **Returns:** Success message

### GET /farmer/:farmerId/availability
Get farmer availability
- **Query:** `date`
- **Returns:** Available time slots

---

## 🛡️ Admin Routes
**Base:** `/api/admin`

### GET /dashboard
Get admin dashboard statistics
- **Auth:** Required (Admin)
- **Returns:** Comprehensive stats

### GET /analytics
Get analytics data
- **Auth:** Required (Admin)
- **Query:** `period` (7d, 30d, 90d, 1y)
- **Returns:** Analytics charts data

### GET /users
Get all users with filters
- **Auth:** Required (Admin)
- **Query:** `page, limit, role, status, search`
- **Returns:** Paginated users

### PUT /users/:id/status
Update user status
- **Auth:** Required (Admin)
- **Body:** `{ isActive, reason }`
- **Returns:** Updated user

### GET /farmers
Get all farmers with profiles
- **Auth:** Required (Admin)
- **Query:** `page, limit, status, category, search`
- **Returns:** Paginated farmers

### PUT /farmers/:id/verify
Verify farmer profile
- **Auth:** Required (Admin)
- **Body:** `{ status, notes }`
- **Returns:** Updated farmer

### GET /payments
Get all payments
- **Auth:** Required (Admin)
- **Query:** `page, limit, status, type, startDate, endDate`
- **Returns:** Paginated payments

---

## 🔌 WebSocket Events

### Connection
```javascript
socket.emit('join_room', { userId, role });
```

### Chat Events
```javascript
// Send message
socket.emit('send_message', { recipientId, content, type });

// Receive message
socket.on('new_message', (message) => {});

// Message read
socket.emit('message_read', { messageId });
```

### Notification Events
```javascript
// General notifications
socket.on('notification', (notification) => {});

// Adoption notifications
socket.on('adoption_update', (adoption) => {});

// Payment notifications
socket.on('payment_update', (payment) => {});
```

### Video Call Events
```javascript
// Start call
socket.emit('start_call', { recipientId, callType });

// Call events
socket.on('incoming_call', (callData) => {});
socket.on('call_accepted', (callData) => {});
socket.on('call_ended', (callData) => {});
```

---

## 📋 Response Format

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    // Response data
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    // Validation errors if any
  ]
}
```

### Pagination Response
```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "current": 1,
      "pages": 10,
      "total": 100,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

---

## 🚀 Getting Started

1. **Install dependencies:**
   ```bash
   cd backend
   pnpm install
   ```

2. **Environment variables:**
   ```bash
   cp .env.example .env
   # Configure your .env file
   ```

3. **Start development server:**
   ```bash
   pnpm dev
   ```

4. **Test API health:**
   ```bash
   curl http://localhost:5000/health
   ```

---

## 📝 Notes

- All dates should be in ISO 8601 format
- File uploads limited to 10MB
- Rate limiting: 100 requests per 15 minutes per IP
- JWT tokens expire in 7 days
- WebSocket connections require authentication
- Admin role has access to all endpoints
- Farmers can only manage their own profiles and content
- Adopters can only access their own adoptions and data

---

## 🔒 Security Features

- JWT authentication
- Rate limiting
- Helmet security headers
- CORS protection
- Input validation
- Password hashing with bcrypt
- File upload restrictions
- XSS protection
- SQL injection prevention (NoSQL)