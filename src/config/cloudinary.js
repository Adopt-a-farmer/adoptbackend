const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Upload document to Cloudinary
 * Cloudinary supports PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX and other document formats
 * @param {string} filePath - File path from multer
 * @param {Object} options - Upload options
 */
const uploadDocument = async (filePath, options = {}) => {
  try {
    const uploadOptions = {
      folder: options.folder || 'adopt-a-farmer/documents',
      resource_type: 'auto', // Use 'auto' to handle images, PDFs, and raw files
      public_id: options.public_id,
      tags: options.tags || ['document'],
      context: options.context,
      ...options
    };

    const result = await cloudinary.uploader.upload(filePath, uploadOptions);
    return {
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      bytes: result.bytes,
      resourceType: result.resource_type,
      originalFilename: options.originalFilename
    };
  } catch (error) {
    console.error('Cloudinary document upload error:', error);
    throw error;
  }
};

/**
 * Upload verification document (ID, certificates, etc.)
 */
const uploadVerificationDocument = async (file, userId, documentType) => {
  return uploadDocument(file, {
    folder: `adopt-a-farmer/verifications/${userId}`,
    tags: ['verification', documentType],
    context: {
      documentType,
      userId,
      uploadDate: new Date().toISOString()
    }
  });
};

module.exports = cloudinary;
module.exports.uploadDocument = uploadDocument;
module.exports.uploadVerificationDocument = uploadVerificationDocument;