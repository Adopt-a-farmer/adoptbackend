# Admin Dashboard Implementation

## Overview
This document outlines the comprehensive admin dashboard functionality that has been implemented for the Adopt-a-Farmer platform.

## Default Admin Account

A default admin account has been created with the following credentials:

- **Email**: admin@adoptafarmer.com
- **Password**: Admin@123456
- **Role**: admin

**IMPORTANT**: Please change the password after first login for security purposes.

To create the default admin account, run:
```bash
node src/utils/seedAdmin.js
```

## Admin Dashboard Features

### 1. User Management
The admin can manage all platform users through comprehensive endpoints:

#### View All Users
- **Endpoint**: `GET /api/admin/users`
- **Features**:
  - Pagination support
  - Filter by role (farmer, adopter, expert, admin)
  - Filter by status (active/inactive)
  - Search by name or email
  - View user details including verification status

#### Create New Users
- **Endpoint**: `POST /api/admin/users`
- **Features**:
  - Create farmers, adopters, or experts
  - Auto-verification for admin-created users
  - Optional profile data inclusion

#### User Verification
- **Endpoint**: `PUT /api/admin/users/:id/verify`
- **Features**:
  - Verify/unverify users
  - Add verification notes
  - Automatic profile verification sync

#### User Status Management
- **Endpoint**: `PUT /api/admin/users/:id/status`
- **Features**:
  - Activate/deactivate users
  - Add deactivation reasons
  - Track deactivation timestamps

### 2. Farmer Management

#### View All Farmers
- **Endpoint**: `GET /api/admin/farmers`
- **Features**:
  - View farmer profiles with user details
  - Filter by verification status
  - Filter by farming category
  - Search by farm name or location
  - Pagination support

#### Farmer Verification
- **Endpoint**: `PUT /api/admin/farmers/:id/verify`
- **Features**:
  - Verify, reject, or set pending status
  - Add verification notes
  - Track verification timestamps
  - Automatically updates visibility to adopters

### 3. Expert Management

#### View All Experts
- **Endpoint**: `GET /api/admin/experts`
- **Features**:
  - View expert profiles with specializations
  - Filter by verification status
  - Filter by specialization
  - Search by name or expertise
  - View document verification status

#### Expert Verification
- **Endpoint**: `PUT /api/admin/experts/:id/verify`
- **Features**:
  - Verify expert credentials
  - Review uploaded documents
  - Individual document approval/rejection
  - Add verification notes

### 4. Adopter Management

#### View All Adopters
- **Endpoint**: `GET /api/admin/adopters`
- **Features**:
  - View adopter profiles
  - Filter by status
  - Search functionality
  - View adoption history

### 5. Farmer-Adopter Allocations

#### View All Allocations
- **Endpoint**: `GET /api/admin/allocations`
- **Features**:
  - Monitor farmer-adopter relationships
  - Filter by status, farmer, or adopter
  - Track adoption progress
  - View allocation details with populated user data

### 6. Message Monitoring

#### View All Messages
- **Endpoint**: `GET /api/admin/messages`
- **Features**:
  - Monitor platform communications
  - Filter by conversation, sender, or recipient
  - Filter by message type
  - View message content for moderation

### 7. Farmer Availability Management

#### View Farmer Availability
- **Endpoint**: `GET /api/admin/farmer-availability`
- **Features**:
  - Monitor farmer availability schedules
  - Filter by farmer or date range
  - Track availability patterns
  - Debug availability issues

### 8. Dashboard Analytics

#### Dashboard Statistics
- **Endpoint**: `GET /api/admin/dashboard`
- **Features**:
  - User statistics (total, by role, new registrations)
  - Financial metrics (revenue, payments)
  - Activity metrics (adoptions, projects, visits)
  - Content statistics (articles, messages)

#### Advanced Analytics
- **Endpoint**: `GET /api/admin/analytics`
- **Features**:
  - Time-based analytics (7d, 30d, 90d, 1y)
  - User registration trends
  - Revenue trends
  - Adoption trends

## Verification System

### Farmer Verification
1. **Default Status**: New farmers are set to 'pending' verification
2. **Visibility**: Only verified farmers are visible to adopters
3. **Admin Action**: Admin can verify, reject, or keep pending
4. **Profile Pictures**: Farmers can upload profile pictures during signup via Cloudinary

### Expert Verification
1. **Document Upload**: Experts can upload verification documents
2. **Document Types**: degree, certificate, license, id, cv, portfolio
3. **Admin Review**: Admin reviews and approves/rejects individual documents
4. **Status Updates**: Expert status changes based on document verification

### Automatic Verification
- Admin-created users are automatically verified
- System admin account is pre-verified

## File Upload System

### Profile Pictures (Farmers)
- **Endpoint**: `POST /api/upload/profile-image`
- **Storage**: Cloudinary (adopt-a-farmer/profile-images folder)
- **Integration**: Automatic inclusion in farmer profile during signup

### Expert Documents
- **Upload Endpoint**: `POST /api/upload/expert-documents`
- **Expert Endpoint**: `POST /api/experts/upload-documents`
- **Storage**: Cloudinary (adopt-a-farmer/expert-documents folder)
- **Verification**: Admin approval required

## API Security

All admin endpoints require:
1. Valid JWT authentication
2. Admin role authorization
3. Active user status

## Error Handling

- Comprehensive error responses
- Validation error details
- Server error logging
- Graceful failure handling

## Usage Examples

### Create a New Farmer
```javascript
POST /api/admin/users
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "password": "SecurePassword123",
  "role": "farmer",
  "phone": "+254700000000",
  "profileData": {
    "farmName": "Green Valley Farm",
    "location": {
      "county": "Nairobi",
      "subCounty": "Westlands"
    },
    "farmSize": {
      "value": 5,
      "unit": "acres"
    },
    "farmingType": ["crop"],
    "cropTypes": ["maize", "beans"]
  }
}
```

### Verify a Farmer
```javascript
PUT /api/admin/farmers/:farmerId/verify
{
  "status": "verified",
  "notes": "Farm documents verified and location confirmed"
}
```

### Verify Expert Documents
```javascript
PUT /api/admin/experts/:expertId/verify
{
  "status": "verified",
  "notes": "All credentials verified",
  "documentApprovals": [
    {
      "documentId": "document_id_1",
      "status": "approved"
    },
    {
      "documentId": "document_id_2", 
      "status": "approved"
    }
  ]
}
```

## Database Changes

The implementation includes:
- Enhanced verification fields in user models
- Document storage in ExpertProfile
- Profile image support in FarmerProfile
- Verification tracking timestamps
- Admin action logging

## Next Steps

1. Run the admin seeding script to create the default admin
2. Test all endpoints with the admin credentials
3. Configure Cloudinary environment variables
4. Set up proper file upload limits
5. Implement frontend dashboard interface

## Security Considerations

- Change default admin password immediately
- Implement proper file type validation
- Set up Cloudinary security policies
- Monitor admin actions through logs
- Regular security audits

This implementation provides comprehensive admin control over the platform while maintaining security and user experience standards.