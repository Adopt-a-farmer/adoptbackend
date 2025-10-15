const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getAllStories,
  getStoryById,
  createStory,
  updateStory,
  deleteStory,
  toggleLike,
  addComment,
  deleteComment,
  markHelpful,
  uploadMedia
} = require('../controllers/farmerStoryController');

// Public routes
router.get('/', getAllStories);
router.get('/:id', getStoryById);

// Protected routes
router.post('/', protect, uploadMedia, createStory);
router.put('/:id', protect, updateStory);
router.delete('/:id', protect, deleteStory);
router.post('/:id/like', protect, toggleLike);
router.post('/:id/comments', protect, addComment);
router.delete('/:id/comments/:commentId', protect, deleteComment);
router.post('/:id/helpful', protect, markHelpful);

module.exports = router;
