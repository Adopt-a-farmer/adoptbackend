# Adopt-A-Farmer Backend

A comprehensive Node.js backend for the Adopt-A-Farmer platform, connecting adopters with farmers through a robust API system.

## 🚀 Features

- **User Management:** Multi-role authentication (Farmer, Adopter, Expert, Admin)
- **Farmer Profiles:** Detailed farmer profiles with verification system
- **Adoption System:** Comprehensive farmer adoption with multiple packages
- **Payment Integration:** Paystack payment gateway integration
- **File Management:** Cloudinary integration for media storage
- **Real-time Chat:** Socket.IO powered messaging system
- **Knowledge Hub:** Articles and farming calendar
- **Crowdfunding:** Project funding platform
- **Farm Visits:** Visit scheduling and management
- **Admin Dashboard:** Complete administrative controls

## 🛠️ Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB with Mongoose
- **Authentication:** JWT (JSON Web Tokens)
- **Payment:** Paystack API
- **File Storage:** Cloudinary
- **Real-time:** Socket.IO
- **Security:** Helmet, CORS, Rate Limiting
- **Validation:** Express Validator

## 📋 Prerequisites

- Node.js (v16 or higher)
- MongoDB (local or cloud)
- pnpm package manager
- Cloudinary account
- Paystack account

## ⚡ Quick Start

### 1. Clone and Install
```bash
cd backend
pnpm install
```

### 2. Environment Configuration
Create a `.env` file in the backend root:

```env
# Server Configuration
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:5173

# Database
MONGO_URI=mongodb://localhost:27017/adopt-a-farmer
# OR for MongoDB Atlas:
# MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/adopt-a-farmer

# JWT
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRE=7d

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# Paystack
PAYSTACK_SECRET_KEY=sk_test_your_paystack_secret_key
PAYSTACK_PUBLIC_KEY=pk_test_your_paystack_public_key
PAYSTACK_WEBHOOK_SECRET=your_webhook_secret

# Email (Optional - for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_email_password
```

### 3. Start Development Server
```bash
# Development mode with auto-reload
pnpm dev

# Production mode
pnpm start
```

### 4. Verify Installation
Visit `http://localhost:5000/health` - you should see:
```json
{
  "status": "OK",
  "message": "Adopt-A-Farmer API is running",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/
│   │   └── database.js          # MongoDB connection
│   ├── controllers/
│   │   ├── authController.js    # Authentication logic
│   │   ├── userController.js    # User management
│   │   ├── farmerController.js  # Farmer operations
│   │   ├── adopterController.js # Adopter operations
│   │   ├── paymentController.js # Payment processing
│   │   ├── uploadController.js  # File uploads
│   │   ├── messageController.js # Chat system
│   │   ├── knowledgeController.js # Knowledge hub
│   │   ├── crowdfundingController.js # Crowdfunding
│   │   ├── visitController.js   # Farm visits
│   │   └── adminController.js   # Admin operations
│   ├── middleware/
│   │   ├── auth.js             # Authentication middleware
│   │   ├── errorHandler.js     # Error handling
│   │   ├── logger.js           # Request logging
│   │   └── validation.js       # Input validation
│   ├── models/
│   │   ├── User.js             # User schema
│   │   ├── FarmerProfile.js    # Farmer profile schema
│   │   ├── AdopterProfile.js   # Adopter profile schema
│   │   ├── Adoption.js         # Adoption schema
│   │   ├── Payment.js          # Payment schema
│   │   ├── Message.js          # Message schema
│   │   ├── KnowledgeArticle.js # Knowledge article schema
│   │   ├── FarmingCalendar.js  # Calendar schema
│   │   ├── CrowdfundingProject.js # Project schema
│   │   └── FarmVisit.js        # Visit schema
│   ├── routes/
│   │   ├── auth.js             # Auth routes
│   │   ├── users.js            # User routes
│   │   ├── farmers.js          # Farmer routes
│   │   ├── adopters.js         # Adopter routes
│   │   ├── payments.js         # Payment routes
│   │   ├── upload.js           # Upload routes
│   │   ├── messages.js         # Message routes
│   │   ├── knowledge.js        # Knowledge routes
│   │   ├── crowdfunding.js     # Crowdfunding routes
│   │   ├── visits.js           # Visit routes
│   │   └── admin.js            # Admin routes
│   ├── services/
│   │   ├── paystackService.js  # Paystack integration
│   │   └── socketService.js    # Socket.IO service
│   ├── utils/
│   │   └── cloudinaryUtils.js  # Cloudinary utilities
│   └── server.js               # Main application file
├── package.json
├── .env.example
├── .gitignore
├── API_DOCUMENTATION.md
└── README.md
```

## 🔐 Authentication Flow

### Registration
1. User submits registration form with role selection
2. Password is hashed using bcrypt
3. User record is created in MongoDB
4. JWT token is generated and returned
5. Role-specific profile can be created

### Login
1. User submits email and password
2. Credentials are validated
3. JWT token is generated with user data
4. Token is returned for subsequent requests

### Protected Routes
1. Client sends JWT token in Authorization header
2. Middleware validates token and extracts user data
3. User data is attached to request object
4. Route handler processes request with user context

## 💳 Payment Integration

### Paystack Setup
1. **Initialize Payment:**
   ```javascript
   POST /api/payments/initialize
   {
     "amount": 50000, // Amount in kobo (NGN 500)
     "type": "adoption",
     "metadata": { "farmerId": "farmer123" }
   }
   ```

2. **Verify Payment:**
   ```javascript
   POST /api/payments/verify
   {
     "reference": "payment_reference_from_paystack"
   }
   ```

3. **Webhook Handling:**
   - Paystack sends webhook to `/api/payments/webhook`
   - Signature verification ensures security
   - Payment status updated in database

## 📁 File Upload System

### Cloudinary Integration
1. **Single File Upload:**
   ```javascript
   POST /api/upload/single
   Content-Type: multipart/form-data
   file: [file_data]
   ```

2. **Multiple Files:**
   ```javascript
   POST /api/upload/multiple
   Content-Type: multipart/form-data
   files: [file1, file2, file3]
   ```

3. **File Deletion:**
   ```javascript
   DELETE /api/upload
   {
     "public_id": "cloudinary_public_id"
   }
   ```

## 💬 Real-time Features

### Socket.IO Integration
```javascript
// Client connection
const socket = io('http://localhost:5000');

// Join user room
socket.emit('join_room', { userId: 'user123', role: 'adopter' });

// Send message
socket.emit('send_message', {
  recipientId: 'recipient123',
  content: 'Hello!',
  type: 'text'
});

// Receive messages
socket.on('new_message', (message) => {
  console.log('New message:', message);
});
```

## 🧪 Testing

### API Testing with curl
```bash
# Health check
curl http://localhost:5000/health

# Register user
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"firstName":"John","lastName":"Doe","email":"john@example.com","password":"password123","role":"adopter"}'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","password":"password123"}'

# Get farmers (with token)
curl http://localhost:5000/api/farmers \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Using Postman
1. Import the API endpoints
2. Set up environment variables for base URL and token
3. Test authentication flow
4. Test protected endpoints

## 🚀 Deployment

### Environment Setup
1. **Production Environment Variables:**
   ```env
   NODE_ENV=production
   PORT=5000
   MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/adopt-a-farmer
   JWT_SECRET=your_production_jwt_secret
   # ... other production configs
   ```

2. **Build and Start:**
   ```bash
   pnpm install --production
   pnpm start
   ```

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

## 🛡️ Security Features

- **Authentication:** JWT-based authentication
- **Authorization:** Role-based access control
- **Rate Limiting:** 100 requests per 15 minutes per IP
- **Security Headers:** Helmet.js protection
- **CORS:** Configured for frontend domain
- **Input Validation:** Express Validator
- **Password Security:** bcrypt hashing
- **File Upload Security:** Type and size restrictions

## 📊 Monitoring

### Health Checks
- **Endpoint:** `GET /health`
- **Response:** Server status and timestamp
- **Use:** Load balancer health checks

### Logging
- Request logging middleware
- Error logging with stack traces
- Payment transaction logging
- File upload logging

## 🐛 Troubleshooting

### Common Issues

1. **MongoDB Connection Failed:**
   - Check MONGO_URI in .env
   - Ensure MongoDB is running
   - Verify network access for cloud DB

2. **JWT Token Invalid:**
   - Check JWT_SECRET in .env
   - Verify token expiration
   - Ensure proper Authorization header format

3. **File Upload Failed:**
   - Verify Cloudinary credentials
   - Check file size limits
   - Ensure proper multipart/form-data

4. **Payment Integration Issues:**
   - Verify Paystack keys
   - Check webhook endpoint accessibility
   - Validate payment amounts (kobo vs naira)

### Debug Mode
```bash
DEBUG=adopt-a-farmer:* pnpm dev
```

## 📞 Support

For issues and questions:
- Check API Documentation: `API_DOCUMENTATION.md`
- Review error logs in console
- Verify environment configuration
- Test with provided curl examples

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes with tests
4. Submit pull request
5. Ensure all tests pass

## 📄 License

This project is licensed under the MIT License.