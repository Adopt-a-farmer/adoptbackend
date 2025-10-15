const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Upload image to Cloudinary
const uploadImage = async (file, folder = 'adopt-a-farmer') => {
  try {
    const result = await cloudinary.uploader.upload(file.path, {
      folder: folder,
      resource_type: 'auto',
      quality: 'auto',
      fetch_format: 'auto'
    });

    return {
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      width: result.width,
      height: result.height,
      bytes: result.bytes
    };
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new Error('Image upload failed');
  }
};

// Upload video to Cloudinary
const uploadVideo = async (file, folder = 'adopt-a-farmer/videos') => {
  try {
    const result = await cloudinary.uploader.upload(file.path, {
      folder: folder,
      resource_type: 'video',
      quality: 'auto'
    });

    return {
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      duration: result.duration,
      bytes: result.bytes
    };
  } catch (error) {
    console.error('Cloudinary video upload error:', error);
    throw new Error('Video upload failed');
  }
};

// Upload document to Cloudinary (PDF, DOC, images, etc.)
const uploadDocument = async (file, folder = 'adopt-a-farmer/documents') => {
  try {
    const result = await cloudinary.uploader.upload(file.path, {
      folder: folder,
      resource_type: 'auto', // Handles images, PDFs, and raw files
      quality: 'auto',
      format: file.mimetype.includes('pdf') ? 'pdf' : undefined
    });

    return {
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      bytes: result.bytes,
      resourceType: result.resource_type,
      originalFilename: file.originalname
    };
  } catch (error) {
    console.error('Cloudinary document upload error:', error);
    throw new Error('Document upload failed');
  }
};

// Delete file from Cloudinary
const deleteFile = async (publicId, resourceType = 'image') => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType
    });
    return result;
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    throw new Error('File deletion failed');
  }
};

// Generate transformation URL
const getTransformedUrl = (publicId, transformations = {}) => {
  return cloudinary.url(publicId, {
    ...transformations,
    secure: true
  });
};

// Get optimized image URL
const getOptimizedImageUrl = (publicId, width = 800, height = 600) => {
  return cloudinary.url(publicId, {
    width: width,
    height: height,
    crop: 'fill',
    quality: 'auto',
    fetch_format: 'auto',
    secure: true
  });
};

// Create image variants for different use cases
const createImageVariants = (publicId) => {
  return {
    thumbnail: getOptimizedImageUrl(publicId, 150, 150),
    small: getOptimizedImageUrl(publicId, 300, 200),
    medium: getOptimizedImageUrl(publicId, 600, 400),
    large: getOptimizedImageUrl(publicId, 1200, 800),
    original: cloudinary.url(publicId, { secure: true })
  };
};

module.exports = {
  cloudinary,
  uploadImage,
  uploadVideo,
  uploadDocument,
  deleteFile,
  getTransformedUrl,
  getOptimizedImageUrl,
  createImageVariants
};