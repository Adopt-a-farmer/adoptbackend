const { uploadImage, uploadVideo, deleteFile, createImageVariants } = require('../utils/cloudinaryUtils');
const { uploadDocument, uploadVerificationDocument } = require('../config/cloudinary');
const cloudinary = require('../config/cloudinary');
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

// @desc    Upload profile image for farmer registration
// @route   POST /api/upload/profile-image
// @access  Private
const uploadProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    const folder = 'adopt-a-farmer/profile-images';
    const result = await uploadImage(req.file, folder);

    // Create image variants for profile use
    const variants = createImageVariants(result.publicId);

    // Clean up temp file
    try {
      await fs.unlink(req.file.path);
    } catch (error) {
      console.log('Temp file cleanup failed:', error.message);
    }

    res.json({
      success: true,
      message: 'Profile image uploaded successfully',
      data: {
        url: result.url,
        secure_url: result.url, // Adding secure_url for compatibility
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

    console.error('Upload profile image error:', error);
    res.status(500).json({
      success: false,
      message: 'Profile image upload failed'
    });
  }
};

// @desc    Upload expert verification documents
// @route   POST /api/upload/expert-documents
// @access  Private (Expert)
const uploadExpertDocuments = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No document files provided'
      });
    }

    const { documentTypes } = req.body; // Array of document types corresponding to files
    
    if (!documentTypes || !Array.isArray(documentTypes)) {
      return res.status(400).json({
        success: false,
        message: 'Document types must be provided as an array'
      });
    }

    if (documentTypes.length !== req.files.length) {
      return res.status(400).json({
        success: false,
        message: 'Number of document types must match number of files'
      });
    }

    const allowedDocTypes = ['degree', 'certificate', 'license', 'id', 'cv', 'portfolio'];
    const invalidTypes = documentTypes.filter(type => !allowedDocTypes.includes(type));
    
    if (invalidTypes.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid document types: ${invalidTypes.join(', ')}`
      });
    }

    const folder = 'adopt-a-farmer/expert-documents';
    const uploadPromises = req.files.map(file => uploadImage(file, folder));
    const results = await Promise.all(uploadPromises);

    // Format results with document types
    const documents = results.map((result, index) => ({
      type: documentTypes[index],
      url: result.url,
      publicId: result.publicId,
      fileName: req.files[index].originalname,
      uploadDate: new Date(),
      status: 'pending'
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
      message: `${results.length} documents uploaded successfully`,
      data: {
        documents
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

    console.error('Upload expert documents error:', error);
    res.status(500).json({
      success: false,
      message: 'Documents upload failed'
    });
  }
};

// @desc    Upload registration documents during signup (no auth required)
// @route   POST /api/upload/registration-documents
// @access  Public
const uploadRegistrationDocuments = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No document files provided'
      });
    }

    const folder = 'adopt-a-farmer/registration-documents';
    const uploadPromises = req.files.map(file => 
      uploadDocument(file.path, {
        folder: folder,
        originalFilename: file.originalname
      })
    );
    const results = await Promise.all(uploadPromises);

    // Format results
    const documents = results.map((result, index) => ({
      url: result.url,
      publicId: result.publicId,
      fileName: result.originalFilename || req.files[index].originalname,
      uploadDate: new Date(),
      fileSize: result.bytes,
      format: result.format,
      resourceType: result.resourceType
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
      message: `${results.length} document(s) uploaded successfully`,
      data: {
        documents
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

    console.error('Upload registration documents error:', error);
    res.status(500).json({
      success: false,
      message: 'Documents upload failed'
    });
  }
};

// @desc    Upload verification documents (ID, certificates, licenses)
// @route   POST /api/upload/verification-documents
// @access  Private
const uploadVerificationDocuments = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No document files provided'
      });
    }

    const { documentTypes } = req.body; // Array of document types
    const documentTypesArray = Array.isArray(documentTypes) ? documentTypes : JSON.parse(documentTypes || '[]');
    
    if (documentTypesArray.length !== req.files.length) {
      return res.status(400).json({
        success: false,
        message: 'Number of document types must match number of files'
      });
    }

    const allowedDocTypes = [
      'national_id',
      'passport',
      'driving_license',
      'land_title',
      'lease_agreement',
      'certificate',
      'license',
      'tax_pin',
      'bank_statement',
      'business_permit',
      'other'
    ];
    
    const invalidTypes = documentTypesArray.filter(type => !allowedDocTypes.includes(type));
    if (invalidTypes.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid document types: ${invalidTypes.join(', ')}`
      });
    }

    const userId = req.user._id.toString();
    const uploadPromises = req.files.map((file, index) => 
      uploadVerificationDocument(file.path, userId, documentTypesArray[index])
    );
    
    const results = await Promise.all(uploadPromises);

    // Format results with document metadata
    const documents = results.map((result, index) => ({
      type: documentTypesArray[index],
      url: result.url,
      publicId: result.publicId,
      fileName: req.files[index].originalname,
      fileSize: result.bytes,
      format: result.format,
      uploadDate: new Date(),
      status: 'pending_verification'
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
      message: `${results.length} verification documents uploaded successfully`,
      data: {
        documents
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

    console.error('Upload verification documents error:', error);
    res.status(500).json({
      success: false,
      message: 'Verification documents upload failed',
      error: error.message
    });
  }
};

module.exports = {
  uploadSingleImage,
  uploadMultipleImages,
  uploadSingleVideo,
  deleteUploadedFile,
  getUploadSignature,
  uploadProfileImage,
  uploadExpertDocuments,
  uploadVerificationDocuments,
  uploadRegistrationDocuments
};