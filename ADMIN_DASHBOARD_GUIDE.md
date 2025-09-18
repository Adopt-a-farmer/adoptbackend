# Admin Dashboard Documentation

## Overview
The admin dashboard provides comprehensive farmer management functionality for the Adopt-A-Farmer system. It allows administrators to view, verify, and manage farmer profiles and verification status.

## Access
- **URL**: `http://localhost:8080/admin/dashboard`
- **Login**: `http://localhost:8080/admin/login`
- **Requirements**: Admin role required

## Features

### Dashboard Statistics
- Total farmers count
- Verified farmers count  
- Pending verification count
- Rejected farmers count

### Farmer Management Table
- **Search**: Search by farm name, county, sub-county, or village
- **Filter**: Filter by verification status (pending, verified, rejected)
- **Pagination**: Navigate through multiple pages of farmers
- **Actions**: Quick approve/reject for pending farmers

### Farmer Details Modal
View comprehensive farmer information including:
- Personal information (name, email, phone)
- Farm details (name, size, type, location)
- Verification status and notes
- Farm description
- Crop types and farming methods
- Establishment year

### Verification Actions
- **Approve**: Mark farmer as verified
- **Reject**: Mark farmer as rejected
- **Add Notes**: Include verification notes for future reference

## API Endpoints Used

### Authentication
- `POST /api/auth/login` - Admin login

### Dashboard Data
- `GET /api/admin/dashboard` - Dashboard statistics
- `GET /api/admin/farmers` - List all farmers with pagination and filtering
- `GET /api/admin/farmers/:id` - Get specific farmer details
- `PUT /api/admin/farmers/:id/verify` - Update farmer verification status

## Usage Instructions

### 1. Login
1. Navigate to `http://localhost:8080/admin/login`
2. Enter admin credentials
3. Check "Remember me" to stay logged in (optional)
4. Click "Sign in"

### 2. Dashboard Overview
- View farmer statistics at the top of the dashboard
- Monitor verification progress

### 3. Managing Farmers
1. Use the search box to find specific farmers
2. Use the status filter to view only pending, verified, or rejected farmers
3. Click "Refresh" to reload the data
4. Click on any farmer row to view detailed information

### 4. Farmer Verification
#### Quick Actions (from table):
- Click the green checkmark (✓) to quickly approve
- Click the red X (✗) to quickly reject

#### Detailed Review:
1. Click on a farmer row to open the details modal
2. Review all farmer information
3. Click "Approve" or "Reject" 
4. Add verification notes (optional)
5. Click "Confirm" to save

### 5. Navigation
- Use pagination controls at the bottom of the table
- View record counts and navigate between pages
- Use "Previous" and "Next" buttons

## Security Features
- Authentication required for all admin functions
- Role-based access control (admin only)
- Secure token-based sessions
- Auto-logout functionality

## Technical Details

### Data Fields
- **Location**: Uses county, sub-county, and village structure
- **Farm Size**: Displays value and unit (acres/hectares)
- **Farming Type**: Array of types (crop, livestock, mixed, etc.)
- **Verification Status**: pending, verified, or rejected

### Responsive Design
- Mobile-friendly interface
- Responsive tables and modals
- Touch-friendly buttons and controls

### Error Handling
- Network error detection
- User-friendly error messages
- Graceful degradation

## Troubleshooting

### Common Issues
1. **Cannot access dashboard**: Ensure you're logged in with admin credentials
2. **Empty farmer list**: Check database connection and ensure farmers exist
3. **Cannot verify farmers**: Verify admin permissions and API connectivity

### Browser Requirements
- Modern browser with JavaScript enabled
- Internet connection for Tailwind CSS and Font Awesome
- Local storage support for authentication tokens