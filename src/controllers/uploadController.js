const { uploadImage, uploadVideo, deleteFile, createImageVariants } = require('../utils/cloudinaryUtils');
const fs = require('fs').promises;

// @desc    Upload single image
// @route   POST /api/upload/image
// @access  Private
const uploadSingleImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    const folder = req.body.folder || 'adopt-a-farmer/general';
    const result = await uploadImage(req.file, folder);

    // Create image variants for different use cases
    const variants = createImageVariants(result.publicId);

    // Clean up temp file
    try {
      await fs.unlink(req.file.path);
    } catch (error) {
      console.log('Temp file cleanup failed:', error.message);
    }

    res.json({
      success: true,
      message: 'Image uploaded successfully',
      data: {
        url: result.url,
        publicId: result.publicId,
        format: result.format,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
        variants
      }
    });
  } catch (error) {
    // Clean up temp file on error
    if (req.file && req.file.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.log('Temp file cleanup failed:', unlinkError.message);
      }
    }

    console.error('Upload image error:', error);
    res.status(500).json({
      success: false,
      message: 'Image upload failed'
    });
  }
};

// @desc    Upload multiple images
// @route   POST /api/upload/images
// @access  Private
const uploadMultipleImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No image files provided'
      });
    }

    const folder = req.body.folder || 'adopt-a-farmer/general';
    const uploadPromises = req.files.map(file => uploadImage(file, folder));
    const results = await Promise.all(uploadPromises);

    // Create variants for each image
    const imagesWithVariants = results.map(result => ({
      url: result.url,
      publicId: result.publicId,
      format: result.format,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
      variants: createImageVariants(result.publicId)
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
      message: `${results.length} images uploaded successfully`,
      data: {
        images: imagesWithVariants
      }
    });
  } catch (error) {
    // Clean up temp files on error
    if (req.files) {
      const cleanupPromises = req.files.map(file => 
        fs.unlink(file.path).catch(unlinkError => 
          console.log('Temp file cleanup failed:', unlinkError.message)
        )
      );
      await Promise.all(cleanupPromises);
    }

    console.error('Upload multiple images error:', error);
    res.status(500).json({
      success: false,
      message: 'Images upload failed'
    });
  }
};

// @desc    Upload video
// @route   POST /api/upload/video
// @access  Private
const uploadSingleVideo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No video file provided'
      });
    }

    const folder = req.body.folder || 'adopt-a-farmer/videos';
    const result = await uploadVideo(req.file, folder);

    // Clean up temp file
    try {
      await fs.unlink(req.file.path);
    } catch (error) {
      console.log('Temp file cleanup failed:', error.message);
    }

    res.json({
      success: true,
      message: 'Video uploaded successfully',
      data: {
        url: result.url,
        publicId: result.publicId,
        format: result.format,
        duration: result.duration,
        bytes: result.bytes
      }
    });
  } catch (error) {
    // Clean up temp file on error
    if (req.file && req.file.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.log('Temp file cleanup failed:', unlinkError.message);
      }
    }

    console.error('Upload video error:', error);
    res.status(500).json({
      success: false,
      message: 'Video upload failed'
    });
  }
};

// @desc    Delete file from Cloudinary
// @route   DELETE /api/upload/:publicId
// @access  Private
const deleteUploadedFile = async (req, res) => {
  try {
    const { publicId } = req.params;
    const { type } = req.query; // 'image' or 'video'

    if (!publicId) {
      return res.status(400).json({
        success: false,
        message: 'Public ID is required'
      });
    }

    const resourceType = type === 'video' ? 'video' : 'image';
    const result = await deleteFile(publicId, resourceType);

    if (result.result === 'ok') {
      res.json({
        success: true,
        message: 'File deleted successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'File deletion failed',
        error: result
      });
    }
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during file deletion'
    });
  }
};

// @desc    Get upload signature for direct client uploads
// @route   POST /api/upload/signature
// @access  Private
const getUploadSignature = async (req, res) => {
  try {
    const { folder, public_id } = req.body;
    const timestamp = Math.round(new Date().getTime() / 1000);

    const params = {
      timestamp,
      folder: folder || 'adopt-a-farmer/general'
    };

    if (public_id) {
      params.public_id = public_id;
    }

    const signature = cloudinary.utils.api_sign_request(
      params,
      process.env.CLOUDINARY_API_SECRET
    );

    res.json({
      success: true,
      data: {
        signature,
        timestamp,
        api_key: process.env.CLOUDINARY_API_KEY,
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        folder: params.folder
      }
    });
  } catch (error) {
    console.error('Get upload signature error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate upload signature'
    });
  }
};

module.exports = {
  uploadSingleImage,
  uploadMultipleImages,
  uploadSingleVideo,
  deleteUploadedFile,
  getUploadSignature
};