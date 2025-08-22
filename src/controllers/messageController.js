const Message = require('../models/Message');
const User = require('../models/User');

// @desc    Get messages for a conversation
// @route   GET /api/messages/:conversationId
// @access  Private
const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    // Verify user is part of this conversation
    const conversationUsers = conversationId.split('_');
    if (!conversationUsers.includes(userId.toString())) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this conversation'
      });
    }

    const messages = await Message.find({ conversationId })
      .populate('sender', 'firstName lastName avatar')
      .populate('recipient', 'firstName lastName avatar')
      .populate('replyTo')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Message.countDocuments({ conversationId });

    // Mark messages as read
    await Message.updateMany(
      {
        conversationId,
        recipient: userId,
        isRead: false
      },
      {
        isRead: true,
        readAt: new Date()
      }
    );

    res.json({
      success: true,
      data: {
        messages: messages.reverse(), // Reverse to show oldest first
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total,
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Send a message
// @route   POST /api/messages/send
// @access  Private
const sendMessage = async (req, res) => {
  try {
    const senderId = req.user._id;
    const {
      recipient,
      messageType,
      content,
      adoption,
      replyTo
    } = req.body;

    // Verify recipient exists
    const recipientUser = await User.findById(recipient);
    if (!recipientUser || !recipientUser.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Recipient not found'
      });
    }

    // Create conversation ID (consistent ordering)
    const conversationId = [senderId, recipient].sort().join('_');

    // Create message
    const message = await Message.create({
      sender: senderId,
      recipient,
      conversationId,
      messageType,
      content,
      adoption,
      replyTo
    });

    // Populate message data
    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'firstName lastName avatar')
      .populate('recipient', 'firstName lastName avatar')
      .populate('replyTo');

    // Emit message via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${recipient}`).emit('new_message', populatedMessage);
      io.to(`user_${senderId}`).emit('message_sent', populatedMessage);
    }

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: { message: populatedMessage }
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get conversations list
// @route   GET /api/messages/conversations
// @access  Private
const getConversations = async (req, res) => {
  try {
    const userId = req.user._id;

    // Aggregate to get latest message for each conversation
    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [
            { sender: userId },
            { recipient: userId }
          ]
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: '$conversationId',
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$recipient', userId] },
                    { $eq: ['$isRead', false] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $sort: { 'lastMessage.createdAt': -1 }
      }
    ]);

    // Populate user details
    const populatedConversations = await Promise.all(
      conversations.map(async (conv) => {
        const lastMessage = await Message.findById(conv.lastMessage._id)
          .populate('sender', 'firstName lastName avatar')
          .populate('recipient', 'firstName lastName avatar');

        // Determine the other user in conversation
        const otherUserId = conv._id.split('_').find(id => id !== userId.toString());
        const otherUser = await User.findById(otherUserId)
          .select('firstName lastName avatar role');

        return {
          conversationId: conv._id,
          otherUser,
          lastMessage,
          unreadCount: conv.unreadCount
        };
      })
    );

    res.json({
      success: true,
      data: { conversations: populatedConversations }
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Mark messages as read
// @route   PUT /api/messages/:conversationId/read
// @access  Private
const markMessagesAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;

    await Message.updateMany(
      {
        conversationId,
        recipient: userId,
        isRead: false
      },
      {
        isRead: true,
        readAt: new Date()
      }
    );

    // Emit read status via Socket.IO
    const io = req.app.get('io');
    if (io) {
      const otherUserId = conversationId.split('_').find(id => id !== userId.toString());
      io.to(`user_${otherUserId}`).emit('messages_read', { conversationId, readBy: userId });
    }

    res.json({
      success: true,
      message: 'Messages marked as read'
    });
  } catch (error) {
    console.error('Mark messages as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Delete a message
// @route   DELETE /api/messages/:messageId
// @access  Private
const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Only sender can delete their message
    if (message.sender.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this message'
      });
    }

    message.isDeleted = true;
    message.deletedAt = new Date();
    message.content = { text: 'This message was deleted' };
    await message.save();

    // Emit deletion via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${message.recipient}`).emit('message_deleted', { messageId });
      io.to(`user_${message.sender}`).emit('message_deleted', { messageId });
    }

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get unread message count
// @route   GET /api/messages/unread-count
// @access  Private
const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user._id;

    const unreadCount = await Message.countDocuments({
      recipient: userId,
      isRead: false
    });

    res.json({
      success: true,
      data: { unreadCount }
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = {
  getMessages,
  sendMessage,
  getConversations,
  markMessagesAsRead,
  deleteMessage,
  getUnreadCount
};