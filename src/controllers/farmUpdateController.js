const FarmUpdate = require('../models/FarmUpdate');
const FarmMedia = require('../models/FarmMedia');
const FarmerProfile = require('../models/FarmerProfile');
const { uploadImage, deleteFile } = require('../utils/cloudinaryUtils');

// @desc    Get farmer's updates
// @route   GET /api/farm-updates
// @access  Private (Farmer)
const getFarmUpdates = async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Get farmer profile
    const farmer = await FarmerProfile.findOne({ user: userId });
    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: 'Farmer profile not found'
      });
    }

    const updates = await FarmUpdate.find({ farmer: farmer._id })
      .populate('farmer', 'farmName user')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit);

    const total = await FarmUpdate.countDocuments({ farmer: farmer._id });

    res.json({
      success: true,
      data: {
        updates,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get farm updates error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Create new farm update
// @route   POST /api/farm-updates
// @access  Private (Farmer)
const createFarmUpdate = async (req, res) => {
  try {
    const userId = req.user._id;
    const { title, content, type, media_urls, tags, visibility, is_pinned, pinned } = req.body;

    console.log(`[FARM UPDATES] POST /api/farm-updates by ${userId} - incoming:`, JSON.stringify(req.body));

    // Validate input
    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: 'Title and content are required'
      });
    }    // Get farmer profile
    const farmer = await FarmerProfile.findOne({ user: userId });
    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: 'Farmer profile not found'
      });
    }

    const update = new FarmUpdate({
      farmer: farmer._id,
      title,
      content,
      type: (type || 'general').toString().toLowerCase(),
      visibility: (() => {
        const v = (visibility || 'adopters_only').toString().toLowerCase().replace(/\s+/g, '_');
        if (['public', 'adopters_only', 'private'].includes(v)) return v;
        return 'adopters_only';
      })(),
  is_pinned: typeof is_pinned === 'boolean' ? is_pinned : (typeof pinned === 'boolean' ? pinned : false),
      media_urls: media_urls || [],
      tags: tags || [],
      created_at: new Date()
    });

    await update.save();

    // Populate the farmer data for response
    await update.populate('farmer', 'farmName user');

    console.log(`[FARM UPDATES] Created update:`, {
      id: update._id,
      title: update.title,
      type: update.type,
      visibility: update.visibility,
      is_pinned: update.is_pinned,
      tags: update.tags
    });

    res.status(201).json({
      success: true,
      message: 'Farm update created successfully',
      data: update
    });
  } catch (error) {
    console.error('Create farm update error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update farm update
// @route   PUT /api/farm-updates/:id
// @access  Private (Farmer)
const updateFarmUpdate = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const updateData = req.body;

    // Get farmer profile
    const farmer = await FarmerProfile.findOne({ user: userId });
    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: 'Farmer profile not found'
      });
    }

    const update = await FarmUpdate.findOne({ _id: id, farmer: farmer._id });
    if (!update) {
      return res.status(404).json({
        success: false,
        message: 'Farm update not found'
      });
    }

    // Update fields explicitly to control allowed updates
    const allowed = ['title', 'content', 'type', 'media_urls', 'tags', 'visibility', 'is_pinned'];
    allowed.forEach(key => {
      if (updateData[key] !== undefined) update[key] = updateData[key];
    });
    // Support 'pinned' alias from frontend
    if (updateData.pinned !== undefined) update.is_pinned = updateData.pinned;

    await update.save();

    res.json({
      success: true,
      message: 'Farm update updated successfully',
      data: update
    });
  } catch (error) {
    console.error('Update farm update error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Delete farm update
// @route   DELETE /api/farm-updates/:id
// @access  Private (Farmer)
const deleteFarmUpdate = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    // Get farmer profile
    const farmer = await FarmerProfile.findOne({ user: userId });
    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: 'Farmer profile not found'
      });
    }

    const update = await FarmUpdate.findOne({ _id: id, farmer: farmer._id });
    if (!update) {
      return res.status(404).json({
        success: false,
        message: 'Farm update not found'
      });
    }

    // Delete associated media files from Cloudinary
    if (update.media_urls && update.media_urls.length > 0) {
      for (const mediaUrl of update.media_urls) {
        try {
          // Extract public_id from URL and delete from Cloudinary
          const publicId = mediaUrl.split('/').pop().split('.')[0];
          await deleteFile(publicId);
        } catch (deleteError) {
          console.error('Error deleting media file:', deleteError);
        }
      }
    }

    await FarmUpdate.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Farm update deleted successfully'
    });
  } catch (error) {
    console.error('Delete farm update error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get farmer's media files
// @route   GET /api/farm-updates/media
// @access  Private (Farmer)
const getFarmMedia = async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const type = req.query.type; // 'image' or 'video'

    // Get farmer profile
    const farmer = await FarmerProfile.findOne({ user: userId });
    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: 'Farmer profile not found'
      });
    }

    let filter = { farmer: farmer._id };
    if (type) {
      filter.type = type;
    }

    const media = await FarmMedia.find(filter)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit);

    const total = await FarmMedia.countDocuments(filter);

    res.json({
      success: true,
      data: {
        media,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get farm media error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Upload farm media
// @route   POST /api/farm-updates/media
// @access  Private (Farmer)
const uploadFarmMedia = async (req, res) => {
  try {
    const userId = req.user._id;
    const { caption, type } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Get farmer profile
    const farmer = await FarmerProfile.findOne({ user: userId });
    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: 'Farmer profile not found'
      });
    }

    // Upload to Cloudinary
    const uploadResult = await uploadImage(req.file, 'farm-media');

    const media = new FarmMedia({
      farmer: farmer._id,
      url: uploadResult.secure_url,
      public_id: uploadResult.public_id,
      type: type || 'image',
      caption: caption || '',
      format: uploadResult.format,
      size: req.file.size,
      created_at: new Date()
    });

    await media.save();

    res.status(201).json({
      success: true,
      message: 'Media uploaded successfully',
      data: media
    });
  } catch (error) {
    console.error('Upload farm media error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Delete farm media
// @route   DELETE /api/farm-updates/media/:id
// @access  Private (Farmer)
const deleteFarmMedia = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    // Get farmer profile
    const farmer = await FarmerProfile.findOne({ user: userId });
    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: 'Farmer profile not found'
      });
    }

    const media = await FarmMedia.findOne({ _id: id, farmer: farmer._id });
    if (!media) {
      return res.status(404).json({
        success: false,
        message: 'Media file not found'
      });
    }

    // Delete from Cloudinary
    try {
      await deleteFile(media.public_id);
    } catch (deleteError) {
      console.error('Error deleting from Cloudinary:', deleteError);
    }

    await FarmMedia.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Media file deleted successfully'
    });
  } catch (error) {
    console.error('Delete farm media error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get farmer's updates by farmer ID (public)
// @route   GET /api/farm-updates/farmer/:farmerId
// @access  Public
const getFarmUpdatesByFarmerId = async (req, res) => {
  try {
    const farmerId = req.params.farmerId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Find the farmer profile by ID
    const farmer = await FarmerProfile.findById(farmerId);
    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: 'Farmer not found'
      });
    }

    const updates = await FarmUpdate.find({ farmer: farmerId })
      .populate('farmer', 'farmName user')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit);

    const total = await FarmUpdate.countDocuments({ farmer: farmerId });

    res.json({
      success: true,
      data: {
        updates,
        pagination: {
          current_page: page,
          total_pages: Math.ceil(total / limit),
          per_page: limit,
          total_items: total
        }
      }
    });
  } catch (error) {
    console.error('Get farm updates by farmer ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = {
  getFarmUpdates,
  getFarmUpdatesByFarmerId,
  createFarmUpdate,
  updateFarmUpdate,
  deleteFarmUpdate,
  getFarmMedia,
  uploadFarmMedia,
  deleteFarmMedia
};