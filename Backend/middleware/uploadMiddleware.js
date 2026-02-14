const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create uploads directories if they don't exist
const profilePicsDir = 'uploads/profile-pictures';
const coverPhotosDir = 'uploads/cover-photos';

[profilePicsDir, coverPhotosDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ Created upload directory: ${dir}`);
  }
});

// Configure storage for different upload types
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Determine destination based on field name
    if (file.fieldname === 'profilePicture') {
      cb(null, profilePicsDir);
    } else if (file.fieldname === 'coverPhoto') {
      cb(null, coverPhotosDir);
    } else {
      cb(new Error('Invalid field name'), null);
    }
  },
  filename: (req, file, cb) => {
    // Use user ID from request (set by auth middleware)
    const userId = req.user?.id || 'unknown';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    
    // Get extension from original name or default to .jpg
    let ext = path.extname(file.originalname).toLowerCase();
    
    // Handle iPhone HEIC photos - convert to jpg
    if (ext === '.heic' || ext === '.heif') {
      ext = '.jpg';
      console.log(`📱 iPhone HEIC/HEIF file detected, converting to JPG`);
    }
    
    // If no extension, add .jpg
    if (!ext) {
      ext = '.jpg';
    }
    
    // Create filename with field type prefix
    const filename = `${file.fieldname}-${userId}-${uniqueSuffix}${ext}`;
    
    console.log(`📁 File upload details:`, {
      fieldname: file.fieldname,
      userId,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: formatBytes(file.size),
      finalFilename: filename
    });
    
    cb(null, filename);
  }
});

// File filter - MORE LENIENT for iPhone photos
const fileFilter = (req, file, cb) => {
  // Log file info for debugging
  console.log('🔍 File filter checking:', {
    fieldname: file.fieldname,
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: formatBytes(file.size)
  });
  
  // Get file extension
  const ext = path.extname(file.originalname).toLowerCase();
  
  // ALLOW iPhone HEIC/HEIF files
  if (ext === '.heic' || ext === '.heif') {
    console.log(`✅ iPhone photo accepted: ${file.originalname} (${file.mimetype}) - Size: ${formatBytes(file.size)}`);
    return cb(null, true);
  }
  
  // Check if it's an image file
  const isImage = file.mimetype.startsWith('image/');
  
  if (isImage) {
    console.log(`✅ Image accepted: ${file.originalname} (${file.mimetype}) - Size: ${formatBytes(file.size)}`);
    cb(null, true);
  } else {
    console.log(`❌ File rejected - not an image: ${file.originalname} (${file.mimetype})`);
    cb(new Error('Only image files are allowed'));
  }
};

// Create multer instance with 75MB file size limit
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 75 * 1024 * 1024, // 75MB limit
    files: 2 // Max 2 files (for profile and cover photo)
  }
});

// Middleware for profile picture upload only
const uploadProfilePicture = (req, res, next) => {
  const uploadSingle = upload.single('profilePicture');
  
  uploadSingle(req, res, function(err) {
    handleUploadError(err, req, res, next);
  });
};

// Middleware for cover photo upload only
const uploadCoverPhoto = (req, res, next) => {
  const uploadSingle = upload.single('coverPhoto');
  
  uploadSingle(req, res, function(err) {
    handleUploadError(err, req, res, next);
  });
};

// Middleware for both profile and cover photo upload (if needed)
const uploadBoth = upload.fields([
  { name: 'profilePicture', maxCount: 1 },
  { name: 'coverPhoto', maxCount: 1 }
]);

const uploadWithErrorHandling = (req, res, next) => {
  uploadBoth(req, res, function(err) {
    handleUploadError(err, req, res, next);
  });
};

// Error handling function
function handleUploadError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    // Multer-specific errors
    let errorMessage = `Upload error: ${err.message}`;
    
    if (err.code === 'LIMIT_FILE_SIZE') {
      errorMessage = `File size is too large. Maximum size is 75MB.`;
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      errorMessage = 'Too many files uploaded.';
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      errorMessage = 'Unexpected file field. Please use "profilePicture" or "coverPhoto" as the field name.';
    }
    
    console.error('❌ Multer error:', err.code, err.message);
    return res.status(400).json({
      success: false,
      message: errorMessage
    });
  } else if (err) {
    // Other errors (file filter, etc.)
    console.error('❌ Upload error:', err.message);
    return res.status(400).json({
      success: false,
      message: err.message || 'File upload failed'
    });
  }
  
  // Log successful file info
  if (req.files) {
    // Multiple files
    Object.keys(req.files).forEach(fieldname => {
      req.files[fieldname].forEach(file => {
        console.log(`✅ ${fieldname} uploaded successfully:`, {
          filename: file.filename,
          originalname: file.originalname,
          size: formatBytes(file.size),
          mimetype: file.mimetype,
          path: file.path
        });
      });
    });
  } else if (req.file) {
    // Single file
    console.log('✅ File uploaded successfully:', {
      fieldname: req.file.fieldname,
      filename: req.file.filename,
      originalname: req.file.originalname,
      size: formatBytes(req.file.size),
      mimetype: req.file.mimetype,
      path: req.file.path
    });
  }
  
  // No errors, proceed
  next();
}

// Helper function to format file size
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

module.exports = {
  uploadProfilePicture,
  uploadCoverPhoto,
  uploadWithErrorHandling
};