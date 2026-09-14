const pool = require('../config/database');

// GET USER PROFILE
const getUserProfile = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    const result = await pool.query(
      `
      SELECT
        id,
        name,
        phone,
        email,
        role
      FROM users
      WHERE id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('GET USER PROFILE ERROR:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to get user profile',
    });
  }
};


// UPDATE USER PROFILE
const updateUserProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Name is required',
      });
    }

    const result = await pool.query(
      `
      UPDATE users
      SET
        name = $1,
        email = $2
      WHERE id = $3
      RETURNING
        id,
        name,
        phone,
        email,
        role
      `,
      [
        name.trim(),
        email && email.trim() !== '' ? email.trim() : null,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('UPDATE USER PROFILE ERROR:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
    });
  }
};


module.exports = {
  getUserProfile,
  updateUserProfile,
};