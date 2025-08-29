# Farmer and Expert Messaging System

## Overview
This document outlines the improved messaging system for farmers and experts in the adopt-a-farmer platform.

## Features Implemented

### 1. Real-time Messaging
- **WebSocket Integration**: Using Socket.IO for real-time communication
- **Typing Indicators**: Shows when users are typing
- **Message Status**: Delivered, read status indicators
- **Online Presence**: Shows user online/offline status

### 2. File Sharing
- **Image Support**: Upload and share images with automatic preview
- **Document Support**: PDF, DOC, DOCX, TXT, Excel files
- **File Size Limit**: 10MB maximum file size
- **Progress Tracking**: Real-time upload progress indication

### 3. Message Features
- **Text Messages**: Standard text communication
- **Message Reactions**: React to messages with emojis
- **Message Editing**: Edit sent messages (planned)
- **Message Deletion**: Delete messages with soft delete
- **Reply to Messages**: Reply to specific messages (planned)

### 4. Conversation Management
- **Unread Count**: Track unread messages per conversation
- **Search**: Search through conversations and messages
- **Archive**: Archive old conversations
- **Block Users**: Block unwanted communications

### 5. Expert-Specific Features
- **Mentorship Integration**: Only chat with farmers being mentored
- **Farmer Profile Info**: See farm details in conversation
- **Location Display**: Show farmer location in conversation list

### 6. Farmer-Specific Features
- **Multi-role Support**: Chat with adopters, experts, and admins
- **Role Indicators**: Visual badges for different user types
- **Farm Context**: Conversations linked to farm activities

## API Endpoints

### Message Endpoints
```
GET    /api/messages/conversations         - Get user conversations
GET    /api/messages/:conversationId       - Get messages for conversation
POST   /api/messages/send                  - Send text message
POST   /api/messages/send-file             - Send file message
PUT    /api/messages/:conversationId/read  - Mark messages as read
DELETE /api/messages/:messageId            - Delete message
GET    /api/messages/unread-count          - Get unread message count
```

### Expert Endpoints
```
GET /api/experts/conversations - Get expert conversations with farmers
```

### Farmer Endpoints
```
GET /api/farmers/conversations      - Get farmer conversations
GET /api/farmers/messages/unread-count - Get unread count for farmer
```

## Frontend Components

### 1. ExpertMessagingCenter
- **Location**: `src/components/expert/messages/ExpertMessagingCenter.tsx`
- **Purpose**: Messaging interface for experts
- **Features**: 
  - List of farmers being mentored
  - Real-time messaging
  - File upload support
  - Typing indicators

### 2. FarmerMessagingCenter
- **Location**: `src/components/farmer/messages/FarmerMessagingCenter.tsx`
- **Purpose**: Enhanced messaging interface for farmers
- **Features**:
  - Multi-role conversation support
  - File sharing with progress
  - Message reactions
  - Real-time features

### 3. Messaging Service
- **Location**: `src/services/messaging.ts`
- **Purpose**: Real-time WebSocket communication
- **Features**:
  - Socket.IO client integration
  - Event management
  - Connection handling

### 4. Message API Service
- **Location**: `src/services/messageAPI.ts`
- **Purpose**: HTTP API calls for messaging
- **Features**:
  - Type-safe API calls
  - File upload handling
  - Error management

## Database Schema

### Message Model
```javascript
{
  sender: ObjectId,           // User who sent the message
  recipient: ObjectId,        // User who receives the message
  conversationId: String,     // Unique conversation identifier
  messageType: String,        // 'text', 'image', 'video', 'file', 'location'
  content: {
    text: String,             // Text content
    media: {                  // Media content
      url: String,
      publicId: String,
      fileName: String,
      fileSize: Number,
      mimeType: String
    },
    location: {               // Location content
      latitude: Number,
      longitude: Number,
      address: String
    }
  },
  isRead: Boolean,            // Message read status
  readAt: Date,              // When message was read
  isDelivered: Boolean,      // Message delivery status
  deliveredAt: Date,         // When message was delivered
  isDeleted: Boolean,        // Soft delete flag
  deletedAt: Date,           // When message was deleted
  reactions: [{              // Message reactions
    user: ObjectId,
    emoji: String,
    reactedAt: Date
  }],
  replyTo: ObjectId,         // Reference to replied message
  editHistory: [{            // Message edit history
    originalContent: String,
    editedAt: Date
  }]
}
```

## Real-time Events

### Socket.IO Events

#### Client to Server
- `join_conversation` - Join a conversation room
- `leave_conversation` - Leave a conversation room
- `typing_start` - Start typing indicator
- `typing_stop` - Stop typing indicator
- `add_reaction` - Add emoji reaction
- `remove_reaction` - Remove emoji reaction

#### Server to Client
- `new_message` - New message received
- `message_sent` - Message sent confirmation
- `user_typing` - User started typing
- `user_stopped_typing` - User stopped typing
- `messages_read` - Messages marked as read
- `reaction_added` - Reaction added to message
- `reaction_removed` - Reaction removed from message

## Security Features

### 1. Authentication
- JWT token validation for Socket.IO connections
- Protected API endpoints with middleware

### 2. Authorization
- Users can only access their own conversations
- Experts can only message farmers they mentor
- Role-based conversation filtering

### 3. File Upload Security
- File type validation
- File size limits (10MB)
- Cloudinary secure upload
- Malware scanning (planned)

### 4. Content Moderation
- Message reporting system (planned)
- Inappropriate content detection (planned)
- User blocking functionality

## Performance Optimizations

### 1. Database
- Indexed conversation IDs for fast queries
- Aggregation pipelines for conversation lists
- Pagination for message history

### 2. Frontend
- React Query for caching and synchronization
- Optimistic updates for better UX
- Virtual scrolling for large message lists (planned)

### 3. File Handling
- Cloudinary CDN for fast file delivery
- Image optimization and compression
- Progressive file upload

## Testing Strategy

### 1. Unit Tests
- Message API service functions
- Messaging hook functionality
- Component rendering and interactions

### 2. Integration Tests
- Socket.IO connection and events
- File upload workflows
- Real-time message delivery

### 3. E2E Tests
- Complete messaging workflows
- Multi-user conversation scenarios
- File sharing end-to-end

## Future Enhancements

### 1. Advanced Features
- Voice messages
- Video calls
- Screen sharing
- Message scheduling

### 2. AI Integration
- Smart reply suggestions
- Language translation
- Sentiment analysis

### 3. Mobile Support
- Push notifications
- Offline message sync
- Mobile-optimized UI

### 4. Analytics
- Message delivery metrics
- User engagement tracking
- Conversation analytics

## Deployment Notes

### Environment Variables
```env
# Socket.IO Configuration
SOCKET_IO_ORIGINS=http://localhost:3000,https://yourdomain.com

# File Upload
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
MAX_FILE_SIZE=10485760  # 10MB in bytes

# Redis (for Socket.IO scaling)
REDIS_URL=redis://localhost:6379
```

### Installation
1. Install socket.io-client: `npm install socket.io-client`
2. Update API endpoints with file upload routes
3. Configure Cloudinary for file storage
4. Set up Redis for Socket.IO scaling (production)

### Monitoring
- Socket.IO connection metrics
- Message delivery rates
- File upload success rates
- Error logging and alerting

This messaging system provides a robust, scalable, and user-friendly communication platform for farmers and experts in the adopt-a-farmer ecosystem.