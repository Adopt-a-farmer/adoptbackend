const FarmerStory = require('../models/FarmerStory');
const User = require('../models/User');
const cloudinary = require('../config/cloudinary');
const multer = require('multer');
const path = require('path');

// Configure multer for memory storage
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Allow images and videos
  if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('Please upload only images or videos'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// @desc    Get all farmer stories (feed)
// @route   GET /api/farmer-stories
// @access  Public
exports.getAllStories = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const {
      category,
      search,
      farmerId,
      featured,
      sort = '-createdAt'
    } = req.query;

    // Build query
    let query = { isApproved: true };

    if (category && category !== 'all') {
      query.category = category;
    }

    if (farmerId) {
      query.farmer = farmerId;
    }

    if (featured === 'true') {
      query.isFeatured = true;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { challenge: { $regex: search, $options: 'i' } },
        { solution: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    const total = await FarmerStory.countDocuments(query);

    const stories = await FarmerStory.find(query)
      .populate('farmer', 'firstName lastName profilePicture location')
      .populate('comments.user', 'firstName lastName profilePicture')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      data: {
        stories,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching farmer stories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch farmer stories'
    });
  }
};

// @desc    Get single farmer story
// @route   GET /api/farmer-stories/:id
// @access  Public
exports.getStoryById = async (req, res) => {
  try {
    const story = await FarmerStory.findById(req.params.id)
      .populate('farmer', 'firstName lastName profilePicture location bio')
      .populate('comments.user', 'firstName lastName profilePicture')
      .populate('likes.user', 'firstName lastName')
      .populate('markedHelpfulBy', 'firstName lastName');

    if (!story) {
      return res.status(404).json({
        success: false,
        error: 'Story not found'
      });
    }

    // Increment views
    story.views += 1;
    await story.save();

    res.status(200).json({
      success: true,
      data: story
    });
  } catch (error) {
    console.error('Error fetching story:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch story'
    });
  }
};

// @desc    Create new farmer story
// @route   POST /api/farmer-stories
// @access  Private (Farmer only)
exports.createStory = async (req, res) => {
  try {
    const { title, challenge, solution, outcome, category, tags } = req.body;

    // Validate required fields
    if (!title || !challenge || !solution || !category) {
      return res.status(400).json({
        success: false,
        error: 'Please provide title, challenge, solution, and category'
      });
    }

    // Handle media uploads
    let mediaFiles = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          // Determine resource type
          const resourceType = file.mimetype.startsWith('video/') ? 'video' : 'image';
          
          // Convert buffer to base64
          const b64 = Buffer.from(file.buffer).toString('base64');
          const dataURI = `data:${file.mimetype};base64,${b64}`;

          // Upload to Cloudinary
          const uploadOptions = {
            folder: 'farmer-stories',
            resource_type: resourceType
          };

          if (resourceType === 'video') {
            uploadOptions.eager = [
              { width: 720, crop: "scale" }
            ];
            uploadOptions.eager_async = true;
          }

          const result = await cloudinary.uploader.upload(dataURI, uploadOptions);

          mediaFiles.push({
            type: resourceType,
            url: result.secure_url,
            publicId: result.public_id
          });
        } catch (uploadError) {
          console.error('Cloudinary upload error:', uploadError);
        }
      }
    }

    // Create story
    const story = await FarmerStory.create({
      farmer: req.user._id,
      title,
      challenge,
      solution,
      outcome,
      category,
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(tag => tag.trim())) : [],
      media: mediaFiles
    });

    const populatedStory = await FarmerStory.findById(story._id)
      .populate('farmer', 'firstName lastName profilePicture location');

    res.status(201).json({
      success: true,
      data: populatedStory
    });
  } catch (error) {
    console.error('Error creating story:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create story'
    });
  }
};

// @desc    Update farmer story
// @route   PUT /api/farmer-stories/:id
// @access  Private (Story owner only)
exports.updateStory = async (req, res) => {
  try {
    let story = await FarmerStory.findById(req.params.id);

    if (!story) {
      return res.status(404).json({
        success: false,
        error: 'Story not found'
      });
    }

    // Check ownership
    if (story.farmer.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this story'
      });
    }

    const { title, challenge, solution, outcome, category, tags } = req.body;

    story = await FarmerStory.findByIdAndUpdate(
      req.params.id,
      {
        title,
        challenge,
        solution,
        outcome,
        category,
        tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(tag => tag.trim())) : story.tags
      },
      { new: true, runValidators: true }
    ).populate('farmer', 'firstName lastName profilePicture location');

    res.status(200).json({
      success: true,
      data: story
    });
  } catch (error) {
    console.error('Error updating story:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update story'
    });
  }
};

// @desc    Delete farmer story
// @route   DELETE /api/farmer-stories/:id
// @access  Private (Story owner or Admin)
exports.deleteStory = async (req, res) => {
  try {
    const story = await FarmerStory.findById(req.params.id);

    if (!story) {
      return res.status(404).json({
        success: false,
        error: 'Story not found'
      });
    }

    // Check ownership
    if (story.farmer.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to delete this story'
      });
    }

    // Delete media from Cloudinary
    if (story.media && story.media.length > 0) {
      for (const media of story.media) {
        try {
          await cloudinary.uploader.destroy(media.publicId, {
            resource_type: media.type
          });
        } catch (error) {
          console.error('Error deleting media from Cloudinary:', error);
        }
      }
    }

    await story.deleteOne();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    console.error('Error deleting story:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete story'
    });
  }
};

// @desc    Toggle like on story
// @route   POST /api/farmer-stories/:id/like
// @access  Private
exports.toggleLike = async (req, res) => {
  try {
    const story = await FarmerStory.findById(req.params.id);

    if (!story) {
      return res.status(404).json({
        success: false,
        error: 'Story not found'
      });
    }

    const likeIndex = story.likes.findIndex(
      like => like.user.toString() === req.user._id.toString()
    );

    if (likeIndex > -1) {
      // Unlike
      story.likes.splice(likeIndex, 1);
    } else {
      // Like
      story.likes.push({ user: req.user._id });
    }

    await story.save();

    res.status(200).json({
      success: true,
      data: {
        liked: likeIndex === -1,
        likeCount: story.likes.length
      }
    });
  } catch (error) {
    console.error('Error toggling like:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle like'
    });
  }
};

// @desc    Add comment to story
// @route   POST /api/farmer-stories/:id/comments
// @access  Private
exports.addComment = async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Please provide comment text'
      });
    }

    const story = await FarmerStory.findById(req.params.id);

    if (!story) {
      return res.status(404).json({
        success: false,
        error: 'Story not found'
      });
    }

    story.comments.push({
      user: req.user._id,
      text: text.trim()
    });

    await story.save();

    const updatedStory = await FarmerStory.findById(story._id)
      .populate('comments.user', 'firstName lastName profilePicture');

    res.status(201).json({
      success: true,
      data: updatedStory.comments[updatedStory.comments.length - 1]
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add comment'
    });
  }
};

// @desc    Delete comment from story
// @route   DELETE /api/farmer-stories/:id/comments/:commentId
// @access  Private (Comment owner or Story owner or Admin)
exports.deleteComment = async (req, res) => {
  try {
    const story = await FarmerStory.findById(req.params.id);

    if (!story) {
      return res.status(404).json({
        success: false,
        error: 'Story not found'
      });
    }

    const comment = story.comments.id(req.params.commentId);

    if (!comment) {
      return res.status(404).json({
        success: false,
        error: 'Comment not found'
      });
    }

    // Check authorization
    const isCommentOwner = comment.user.toString() === req.user._id.toString();
    const isStoryOwner = story.farmer.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isCommentOwner && !isStoryOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to delete this comment'
      });
    }

    comment.deleteOne();
    await story.save();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete comment'
    });
  }
};

// @desc    Mark story as helpful
// @route   POST /api/farmer-stories/:id/helpful
// @access  Private
exports.markHelpful = async (req, res) => {
  try {
    const story = await FarmerStory.findById(req.params.id);

    if (!story) {
      return res.status(404).json({
        success: false,
        error: 'Story not found'
      });
    }

    const alreadyMarked = story.markedHelpfulBy.some(
      userId => userId.toString() === req.user._id.toString()
    );

    if (alreadyMarked) {
      // Remove helpful mark
      story.markedHelpfulBy = story.markedHelpfulBy.filter(
        userId => userId.toString() !== req.user._id.toString()
      );
      story.helpfulCount = Math.max(0, story.helpfulCount - 1);
    } else {
      // Add helpful mark
      story.markedHelpfulBy.push(req.user._id);
      story.helpfulCount += 1;
    }

    await story.save();

    res.status(200).json({
      success: true,
      data: {
        marked: !alreadyMarked,
        helpfulCount: story.helpfulCount
      }
    });
  } catch (error) {
    console.error('Error marking story as helpful:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark story as helpful'
    });
  }
};

// Multer upload middleware
exports.uploadMedia = upload.array('media', 5); // Max 5 files
