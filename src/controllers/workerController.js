const pool = require('../config/database');

const path = require('path');
const fs = require('fs');
const multer = require('multer');


// ======================================================
// GET WORKER SERVICES
// ======================================================

const getWorkerServices = async (req, res) => {
  try {
    const { workerId } = req.params;

    if (!workerId) {
      return res.status(400).json({
        success: false,
        message: 'workerId is required'
      });
    }

    const result = await pool.query(
      `
      SELECT
        s.id,
        s.name,
        s.description,
        s.icon
      FROM worker_services ws
      JOIN services s
        ON s.id = ws.service_id
      WHERE
        ws.worker_id = $1
        AND s.is_active = true
      ORDER BY s.id
      `,
      [workerId]
    );

    return res.status(200).json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Get worker services error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to fetch worker services'
    });
  }
};


// ======================================================
// GET WORKER AVAILABILITY
// ======================================================

const getWorkerAvailability = async (req, res) => {
  try {
    const { workerId } = req.params;

    if (!workerId) {
      return res.status(400).json({
        success: false,
        message: 'workerId is required'
      });
    }

    const result = await pool.query(
      `
      SELECT
        id,
        is_available
      FROM workers
      WHERE id = $1
      `,
      [workerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        worker_id: result.rows[0].id,
        is_available: result.rows[0].is_available
      }
    });

  } catch (error) {
    console.error(
      'Get worker availability error:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Unable to fetch worker availability'
    });
  }
};


// ======================================================
// UPDATE WORKER AVAILABILITY
// ======================================================

const updateWorkerAvailability = async (req, res) => {
  try {
    const { workerId } = req.params;
    const { is_available } = req.body;

    if (!workerId) {
      return res.status(400).json({
        success: false,
        message: 'workerId is required'
      });
    }

    if (typeof is_available !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'is_available must be true or false'
      });
    }

    const result = await pool.query(
      `
      UPDATE workers
      SET
        is_available = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING
        id,
        is_available
      `,
      [is_available, workerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: is_available
        ? 'Worker is now available'
        : 'Worker is now unavailable',
      data: {
        worker_id: result.rows[0].id,
        is_available: result.rows[0].is_available
      }
    });

  } catch (error) {
    console.error(
      'Update worker availability error:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Unable to update worker availability'
    });
  }
};


// ======================================================
// GET WORKER PROFILE
// ======================================================

const getWorkerProfile = async (req, res) => {
  try {
    const { workerId } = req.params;

    if (!workerId) {
      return res.status(400).json({
        success: false,
        message: 'workerId is required'
      });
    }

    const result = await pool.query(
      `
      SELECT
        w.id,
        w.user_id,
        w.profile_photo,
        w.experience_years,
        w.rating,
        w.total_jobs,
        w.is_verified,
        w.is_available,

        u.name,
        u.phone,
        u.email,
        u.role

      FROM workers w

      JOIN users u
        ON u.id = w.user_id

      WHERE w.id = $1
      `,
      [workerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found'
      });
    }

    const worker = result.rows[0];

    return res.status(200).json({
      success: true,
      data: {
        worker_id: worker.id,
        user_id: worker.user_id,

        name: worker.name,
        phone: worker.phone,
        email: worker.email,
        role: worker.role,

        profile_photo: worker.profile_photo,
        experience_years: worker.experience_years,
        rating: worker.rating,
        total_jobs: worker.total_jobs,
        is_verified: worker.is_verified,
        is_available: worker.is_available
      }
    });

  } catch (error) {
    console.error(
      'Get worker profile error:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Unable to fetch worker profile'
    });
  }
};


// ======================================================
// PROFILE PHOTO STORAGE
// ======================================================

const workerProfileStorage = multer.diskStorage({

  destination: (req, file, cb) => {

    const uploadPath = path.join(
      __dirname,
      '../uploads/worker-profiles'
    );

    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, {
        recursive: true
      });
    }

    cb(null, uploadPath);
  },

  filename: (req, file, cb) => {

    const workerId = req.params.workerId;

    const extension = path
      .extname(file.originalname)
      .toLowerCase();

    cb(
      null,
      `worker_${workerId}_${Date.now()}${extension}`
    );
  }
});


// ======================================================
// PROFILE PHOTO UPLOAD MIDDLEWARE
// ======================================================

const uploadWorkerProfilePhoto = multer({

  storage: workerProfileStorage,

  limits: {
    fileSize: 5 * 1024 * 1024
  },

  fileFilter: (req, file, cb) => {

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/jpg'
    ];

    const allowedExtensions = [
      '.jpg',
      '.jpeg',
      '.png',
      '.webp'
    ];

    const extension = path
      .extname(file.originalname)
      .toLowerCase();

    if (
      allowedTypes.includes(file.mimetype) ||
      allowedExtensions.includes(extension)
    ) {

      cb(null, true);

    } else {

      cb(
        new Error(
          'Only JPG, JPEG, PNG and WEBP images are allowed'
        )
      );
    }
  }

}).single('profile_photo');


// ======================================================
// UPDATE WORKER PROFILE PHOTO
// ======================================================

const updateWorkerProfilePhoto = async (req, res) => {

  try {

    const { workerId } = req.params;

    if (!workerId) {
      return res.status(400).json({
        success: false,
        message: 'workerId is required'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Profile photo is required'
      });
    }

    const photoPath =
      `/uploads/worker-profiles/${req.file.filename}`;

    const result = await pool.query(
      `
      UPDATE workers
      SET
        profile_photo = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING
        id,
        profile_photo
      `,
      [
        photoPath,
        workerId
      ]
    );

    if (result.rows.length === 0) {

      // Delete uploaded file if worker doesn't exist
      try {
        fs.unlinkSync(req.file.path);
      } catch (_) {}

      return res.status(404).json({
        success: false,
        message: 'Worker not found'
      });
    }

    return res.status(200).json({

      success: true,

      message:
        'Profile photo updated successfully',

      data: {
        worker_id:
          result.rows[0].id,

        profile_photo:
          result.rows[0].profile_photo
      }
    });

  } catch (error) {

    console.error(
      'Update worker profile photo error:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Unable to update profile photo'
    });
  }
};


// ======================================================
// EXPORTS
// ======================================================

module.exports = {

  getWorkerServices,

  getWorkerAvailability,

  updateWorkerAvailability,

  getWorkerProfile,

  uploadWorkerProfilePhoto,

  updateWorkerProfilePhoto

};