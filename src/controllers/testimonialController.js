const FarmerTestimonial = require('../models/FarmerTestimonial');
const User = require('../models/User');
const FarmerProfile = require('../models/FarmerProfile');
const { uploadDocument } = require('../config/cloudinary');
const fs = require('fs').promises;

// @desc    Create new testimonial
// @route   POST /api/testimonials
// @access  Private (Farmer only)
const createTestimonial = async (req, res) => {
  try {
    const userId = req.user._id;
    const { title, problem, solution, tags, images } = req.body;

    // Verify user is a farmer
    const farmerProfile = await FarmerProfile.findOne({ user: userId });
    if (!farmerProfile) {
      return res.status(403).json({
        success: false,
        message: 'Only farmers can create testimonials'
      });
    }

    // Parse images if sent as JSON string
    let parsedImages = [];
    if (images) {
      try {
        parsedImages = typeof images === 'string' ? JSON.parse(images) : images;
      } catch (error) {
        console.error('Error parsing images:', error);
      }
    }

    // Parse tags if sent as JSON string
    let parsedTags = [];
    if (tags) {
      try {
        parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags;
      } catch (error) {
        console.error('Error parsing tags:', error);
      }
    }

    const testimonial = await FarmerTestimonial.create({
      farmer: userId,
      title,
      problem,
      solution,
      images: parsedImages,
      tags: parsedTags,
      status: 'published',
      isPublic: true
    });

    const populatedTestimonial = await FarmerTestimonial.findById(testimonial._id)
      .populate('farmer', 'firstName lastName avatar email')
      .populate({
        path: 'farmer',
        populate: {
          path: 'farmerProfile',
          select: 'farmName location'
        }
      });

    res.status(201).json({
      success: true,
      message: 'Testimonial created successfully',
      data: { testimonial: populatedTestimonial }
    });
  } catch (error) {
    console.error('Create testimonial error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create testimonial'
    });
  }
};

// @desc    Upload testimonial images
// @route   POST /api/testimonials/upload-images
// @access  Private (Farmer only)
const uploadTestimonialImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No images provided'
      });
    }

    const folder = 'adopt-a-farmer/testimonials';
    const uploadPromises = req.files.map(file =>
      uploadDocument(file.path, {
        folder: folder,
        originalFilename: file.originalname
      })
    );

    const results = await Promise.all(uploadPromises);

    const images = results.map((result, index) => ({
      url: result.url,
      publicId: result.publicId,
      fileName: result.originalFilename || req.files[index].originalname
    }));

    // Clean up temp files
    const cleanupPromises = req.files.map(file =>
      fs.unlink(file.path).catch(error =>
        console.log('Temp file cleanup failed:', error.message)
      )
    );
    await Promise.all(cleanupPromises);

    res.json({
      success: true,
      message: `${results.length} image(s) uploaded successfully`,
      data: { images }
    });
  } catch (error) {
    console.error('Upload testimonial images error:', error);

    // Clean up temp files on error
    if (req.files) {
      const cleanupPromises = req.files.map(file =>
        fs.unlink(file.path).catch(unlinkError =>
          console.log('Temp file cleanup failed:', unlinkError.message)
        )
      );
      await Promise.all(cleanupPromises);
    }

    res.status(500).json({
      success: false,
      message: 'Failed to upload images'
    });
  }
};

// @desc    Get all testimonials
// @route   GET /api/testimonials
// @access  Private
const getAllTestimonials = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = { status: 'published', isPublic: true };

    // Filter by tags
    if (req.query.tags) {
      filter.tags = { $in: req.query.tags.split(',') };
    }

    // Search by title or content
    if (req.query.search) {
      filter.$or = [
        { title: { $regex: req.query.search, $options: 'i' } },
        { problem: { $regex: req.query.search, $options: 'i' } },
        { solution: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const testimonials = await FarmerTestimonial.find(filter)
      .populate('farmer', 'firstName lastName avatar email')
      .populate('comments.user', 'firstName lastName avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Get farmer profiles for populated farmers
    const testimonialsWithProfiles = await Promise.all(
      testimonials.map(async (testimonial) => {
        const farmerProfile = await FarmerProfile.findOne({ user: testimonial.farmer._id })
          .select('farmName location');
        
        const testimonialObj = testimonial.toObject();
        testimonialObj.farmerProfile = farmerProfile;
        return testimonialObj;
      })
    );

    const total = await FarmerTestimonial.countDocuments(filter);

    res.json({
      success: true,
      data: {
        testimonials: testimonialsWithProfiles,
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
    console.error('Get testimonials error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch testimonials'
    });
  }
};

// @desc    Get single testimonial
// @route   GET /api/testimonials/:id
// @access  Private
const getTestimonial = async (req, res) => {
  try {
    const testimonial = await FarmerTestimonial.findById(req.params.id)
      .populate('farmer', 'firstName lastName avatar email')
      .populate('comments.user', 'firstName lastName avatar');

    if (!testimonial) {
      return res.status(404).json({
        success: false,
        message: 'Testimonial not found'
      });
    }

    // Increment view count
    testimonial.views += 1;
    await testimonial.save();

    // Get farmer profile
    const farmerProfile = await FarmerProfile.findOne({ user: testimonial.farmer._id })
      .select('farmName location');

    const testimonialObj = testimonial.toObject();
    testimonialObj.farmerProfile = farmerProfile;

    res.json({
      success: true,
      data: { testimonial: testimonialObj }
    });
  } catch (error) {
    console.error('Get testimonial error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch testimonial'
    });
  }
};

// @desc    Get farmer's own testimonials
// @route   GET /api/testimonials/my-testimonials
// @access  Private (Farmer only)
const getMyTestimonials = async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const testimonials = await FarmerTestimonial.find({ farmer: userId })
      .populate('comments.user', 'firstName lastName avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await FarmerTestimonial.countDocuments({ farmer: userId });

    res.json({
      success: true,
      data: {
        testimonials,
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
    console.error('Get my testimonials error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch testimonials'
    });
  }
};

// @desc    Update testimonial
// @route   PUT /api/testimonials/:id
// @access  Private (Farmer - own testimonials only)
const updateTestimonial = async (req, res) => {
  try {
    const testimonial = await FarmerTestimonial.findById(req.params.id);

    if (!testimonial) {
      return res.status(404).json({
        success: false,
        message: 'Testimonial not found'
      });
    }

    // Check ownership
    if (testimonial.farmer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this testimonial'
      });
    }

    const { title, problem, solution, tags, images } = req.body;

    if (title) testimonial.title = title;
    if (problem) testimonial.problem = problem;
    if (solution) testimonial.solution = solution;
    if (tags) testimonial.tags = typeof tags === 'string' ? JSON.parse(tags) : tags;
    if (images) testimonial.images = typeof images === 'string' ? JSON.parse(images) : images;

    await testimonial.save();

    res.json({
      success: true,
      message: 'Testimonial updated successfully',
      data: { testimonial }
    });
  } catch (error) {
    console.error('Update testimonial error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update testimonial'
    });
  }
};

// @desc    Delete testimonial
// @route   DELETE /api/testimonials/:id
// @access  Private (Farmer - own testimonials only)
const deleteTestimonial = async (req, res) => {
  try {
    const testimonial = await FarmerTestimonial.findById(req.params.id);

    if (!testimonial) {
      return res.status(404).json({
        success: false,
        message: 'Testimonial not found'
      });
    }

    // Check ownership
    if (testimonial.farmer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this testimonial'
      });
    }

    await testimonial.deleteOne();

    res.json({
      success: true,
      message: 'Testimonial deleted successfully'
    });
  } catch (error) {
    console.error('Delete testimonial error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete testimonial'
    });
  }
};

// @desc    Like/unlike testimonial
// @route   POST /api/testimonials/:id/like
// @access  Private
const toggleLike = async (req, res) => {
  try {
    const testimonial = await FarmerTestimonial.findById(req.params.id);

    if (!testimonial) {
      return res.status(404).json({
        success: false,
        message: 'Testimonial not found'
      });
    }

    const userId = req.user._id;
    const likeIndex = testimonial.likes.indexOf(userId);

    if (likeIndex > -1) {
      // Unlike
      testimonial.likes.splice(likeIndex, 1);
    } else {
      // Like
      testimonial.likes.push(userId);
    }

    await testimonial.save();

    res.json({
      success: true,
      message: likeIndex > -1 ? 'Testimonial unliked' : 'Testimonial liked',
      data: {
        liked: likeIndex === -1,
        likeCount: testimonial.likes.length
      }
    });
  } catch (error) {
    console.error('Toggle like error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle like'
    });
  }
};

// @desc    Add comment to testimonial
// @route   POST /api/testimonials/:id/comments
// @access  Private
const addComment = async (req, res) => {
  try {
    const testimonial = await FarmerTestimonial.findById(req.params.id);

    if (!testimonial) {
      return res.status(404).json({
        success: false,
        message: 'Testimonial not found'
      });
    }

    const { comment } = req.body;

    if (!comment || comment.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Comment cannot be empty'
      });
    }

    testimonial.comments.push({
      user: req.user._id,
      comment: comment.trim(),
      createdAt: new Date()
    });

    await testimonial.save();

    const populatedTestimonial = await FarmerTestimonial.findById(testimonial._id)
      .populate('comments.user', 'firstName lastName avatar');

    res.json({
      success: true,
      message: 'Comment added successfully',
      data: {
        comments: populatedTestimonial.comments
      }
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add comment'
    });
  }
};

// @desc    Delete comment from testimonial
// @route   DELETE /api/testimonials/:id/comments/:commentId
// @access  Private (Comment owner or testimonial owner)
const deleteComment = async (req, res) => {
  try {
    const testimonial = await FarmerTestimonial.findById(req.params.id);

    if (!testimonial) {
      return res.status(404).json({
        success: false,
        message: 'Testimonial not found'
      });
    }

    const comment = testimonial.comments.id(req.params.commentId);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found'
      });
    }

    // Check if user is comment owner or testimonial owner
    if (
      comment.user.toString() !== req.user._id.toString() &&
      testimonial.farmer.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this comment'
      });
    }

    testimonial.comments.pull(req.params.commentId);
    await testimonial.save();

    res.json({
      success: true,
      message: 'Comment deleted successfully'
    });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete comment'
    });
  }
};

module.exports = {
  createTestimonial,
  uploadTestimonialImages,
  getAllTestimonials,
  getTestimonial,
  getMyTestimonials,
  updateTestimonial,
  deleteTestimonial,
  toggleLike,
  addComment,
  deleteComment
};
