const express = require('express');
const {
  getMessages,
  sendMessage,
  getConversations,
  markMessagesAsRead,
  deleteMessage,
  getUnreadCount
} = require('../controllers/messageController');
const { protect } = require('../middleware/auth');
const { validateMessage, validate } = require('../middleware/validation');

const router = express.Router();

// All message routes require authentication
router.use(protect);

router.get('/conversations', getConversations);
router.get('/unread-count', getUnreadCount);
router.get('/:conversationId', getMessages);
router.post('/send', validateMessage, validate, sendMessage);
router.put('/:conversationId/read', markMessagesAsRead);
router.delete('/:messageId', deleteMessage);

module.exports = router;