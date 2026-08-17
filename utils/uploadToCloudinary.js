const cloudinary = require('../config/cloudinary');
const { Readable } = require('stream');

/**
 * Uploads a Buffer directly to Cloudinary via upload_stream.
 * No temp file written to disk.
 *
 * @param {Buffer} buffer        - File content as a Buffer
 * @param {string} folder        - Cloudinary folder (e.g. 'eye-hospital/prescriptions')
 * @param {string} publicId      - Optional custom public_id (filename without extension)
 * @param {string} resourceType  - 'raw' for PDFs, 'image' for images
 * @returns {Promise<string>}    - Cloudinary secure URL
 */
const uploadToCloudinary = (buffer, folder, publicId = null, resourceType = 'raw') => {
  return new Promise((resolve, reject) => {
    const options = {
      folder,
      resource_type: resourceType,
      ...(publicId && { public_id: publicId }),
    };

    const uploadStream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      resolve(result.secure_url);
    });

    // Convert buffer to readable stream and pipe into Cloudinary
    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);
    readable.pipe(uploadStream);
  });
};

module.exports = uploadToCloudinary;
