const jwt = require('jsonwebtoken');
const User = require('../models/User');

const socketService = (io) => {
  // Middleware for Socket.IO authentication
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user || !user.isActive) {
        return next(new Error('User not found'));
      }

      socket.userId = user._id.toString();
      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User ${socket.user.firstName} ${socket.user.lastName} connected`);

    // Join user to their personal room
    socket.join(`user_${socket.userId}`);

    // Handle joining conversation rooms
    socket.on('join_conversation', (conversationId) => {
      // Verify user is part of this conversation
      const conversationUsers = conversationId.split('_');
      if (conversationUsers.includes(socket.userId)) {
        socket.join(`conversation_${conversationId}`);
        console.log(`User ${socket.userId} joined conversation ${conversationId}`);
      }
    });

    // Handle leaving conversation rooms
    socket.on('leave_conversation', (conversationId) => {
      socket.leave(`conversation_${conversationId}`);
      console.log(`User ${socket.userId} left conversation ${conversationId}`);
    });

    // Handle typing indicators
    socket.on('typing_start', (data) => {
      const { conversationId } = data;
      socket.to(`conversation_${conversationId}`).emit('user_typing', {
        userId: socket.userId,
        userName: socket.user.firstName,
        conversationId
      });
    });

    socket.on('typing_stop', (data) => {
      const { conversationId } = data;
      socket.to(`conversation_${conversationId}`).emit('user_stopped_typing', {
        userId: socket.userId,
        conversationId
      });
    });

    // Handle message reactions
    socket.on('add_reaction', (data) => {
      const { messageId, emoji, conversationId } = data;
      socket.to(`conversation_${conversationId}`).emit('reaction_added', {
        messageId,
        emoji,
        userId: socket.userId,
        userName: socket.user.firstName
      });
    });

    socket.on('remove_reaction', (data) => {
      const { messageId, emoji, conversationId } = data;
      socket.to(`conversation_${conversationId}`).emit('reaction_removed', {
        messageId,
        emoji,
        userId: socket.userId
      });
    });

    // Handle user status updates
    socket.on('update_status', (status) => {
      socket.broadcast.emit('user_status_update', {
        userId: socket.userId,
        status: status // online, away, busy, offline
      });
    });

    // Handle file upload progress
    socket.on('file_upload_progress', (data) => {
      const { conversationId, progress, fileName } = data;
      socket.to(`conversation_${conversationId}`).emit('file_upload_progress', {
        userId: socket.userId,
        progress,
        fileName
      });
    });

    // Handle call initiation (for future video/voice calls)
    socket.on('initiate_call', (data) => {
      const { recipientId, callType } = data; // voice or video
      socket.to(`user_${recipientId}`).emit('incoming_call', {
        callerId: socket.userId,
        callerName: socket.user.firstName + ' ' + socket.user.lastName,
        callerAvatar: socket.user.avatar,
        callType
      });
    });

    socket.on('accept_call', (data) => {
      const { callerId } = data;
      socket.to(`user_${callerId}`).emit('call_accepted', {
        accepterId: socket.userId
      });
    });

    socket.on('reject_call', (data) => {
      const { callerId } = data;
      socket.to(`user_${callerId}`).emit('call_rejected', {
        rejecterId: socket.userId
      });
    });

    socket.on('end_call', (data) => {
      const { participantId } = data;
      socket.to(`user_${participantId}`).emit('call_ended', {
        endedBy: socket.userId
      });
    });

    // Handle real-time notifications
    socket.on('mark_notification_read', (notificationId) => {
      // Update notification status in database
      socket.emit('notification_marked_read', { notificationId });
    });

    // Handle farm visit updates
    socket.on('visit_status_update', (data) => {
      const { visitId, status, farmerId, adopterId } = data;
      
      // Notify relevant parties
      if (farmerId !== socket.userId) {
        socket.to(`user_${farmerId}`).emit('visit_status_updated', {
          visitId,
          status,
          updatedBy: socket.userId
        });
      }
      
      if (adopterId !== socket.userId) {
        socket.to(`user_${adopterId}`).emit('visit_status_updated', {
          visitId,
          status,
          updatedBy: socket.userId
        });
      }
    });

    // Handle payment notifications
    socket.on('payment_status_update', (data) => {
      const { paymentId, status, recipientId } = data;
      socket.to(`user_${recipientId}`).emit('payment_status_updated', {
        paymentId,
        status
      });
    });

    // Handle adoption milestone updates
    socket.on('milestone_update', (data) => {
      const { adoptionId, milestone, adopterId } = data;
      socket.to(`user_${adopterId}`).emit('milestone_updated', {
        adoptionId,
        milestone,
        updatedBy: socket.userId
      });
    });

    // Handle crowdfunding updates
    socket.on('crowdfunding_update', (data) => {
      const { projectId, update } = data;
      // Broadcast to all project backers (you'd need to implement this logic)
      socket.broadcast.emit('crowdfunding_project_updated', {
        projectId,
        update
      });
    });

    // Handle knowledge hub interactions
    socket.on('article_like', (data) => {
      const { articleId, authorId } = data;
      if (authorId !== socket.userId) {
        socket.to(`user_${authorId}`).emit('article_liked', {
          articleId,
          likedBy: socket.userId,
          likerName: socket.user.firstName
        });
      }
    });

    socket.on('article_comment', (data) => {
      const { articleId, authorId, comment } = data;
      if (authorId !== socket.userId) {
        socket.to(`user_${authorId}`).emit('article_commented', {
          articleId,
          comment,
          commentedBy: socket.userId,
          commenterName: socket.user.firstName
        });
      }
    });

    // Handle emergency alerts
    socket.on('emergency_alert', (data) => {
      const { type, message, location } = data;
      // Broadcast emergency alerts to relevant users (admins, nearby farmers, etc.)
      socket.broadcast.emit('emergency_alert_received', {
        type,
        message,
        location,
        from: socket.userId,
        fromName: socket.user.firstName
      });
    });

    // Handle weather alerts
    socket.on('weather_alert', (data) => {
      const { region, alert } = data;
      // Broadcast to users in specific region
      socket.broadcast.emit('weather_alert_received', {
        region,
        alert
      });
    });

    // Handle market price updates
    socket.on('market_price_update', (data) => {
      const { commodity, price, market } = data;
      socket.broadcast.emit('market_price_updated', {
        commodity,
        price,
        market,
        timestamp: new Date()
      });
    });

    // Handle user presence
    socket.on('user_active', () => {
      socket.broadcast.emit('user_online', {
        userId: socket.userId,
        timestamp: new Date()
      });
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`User ${socket.user.firstName} ${socket.user.lastName} disconnected: ${reason}`);
      
      // Broadcast user offline status
      socket.broadcast.emit('user_offline', {
        userId: socket.userId,
        timestamp: new Date()
      });
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error('Socket error:', error);
      socket.emit('error_message', {
        message: 'An error occurred. Please try again.'
      });
    });
  });

  // Global error handler
  io.engine.on('connection_error', (err) => {
    console.log('Connection error:', err.req);
    console.log('Error code:', err.code);
    console.log('Error message:', err.message);
    console.log('Error context:', err.context);
  });

  return io;
};

module.exports = socketService;