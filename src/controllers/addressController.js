
const pool = require('../config/database');

// ============================================================
// GET USER ADDRESSES
// ============================================================

const getUserAddresses = async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await pool.query(
      `
      SELECT *
      FROM addresses
      WHERE user_id = $1
      ORDER BY id DESC
      `,
      [userId]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error(
      'Get addresses error:',
      error
    );

    res.status(500).json({
      success: false,
      message: 'Unable to fetch addresses',
    });
  }
};

// ============================================================
// ADD NEW ADDRESS
// ============================================================

const addAddress = async (req, res) => {
  try {
    const {
      user_id,
      address_line,
      landmark,
      city,
      state,
      pincode,
      latitude,
      longitude,
      address_type,
      is_default,
    } = req.body;

    // --------------------------------------------------------
    // BASIC VALIDATION
    // --------------------------------------------------------

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    if (!address_line) {
      return res.status(400).json({
        success: false,
        message: 'Address is required',
      });
    }

    if (!pincode) {
      return res.status(400).json({
        success: false,
        message: 'Pincode is required',
      });
    }

    // --------------------------------------------------------
    // IF NEW ADDRESS IS DEFAULT
    // REMOVE DEFAULT FROM OLD ADDRESSES
    // --------------------------------------------------------

    if (is_default === true) {
      await pool.query(
        `
        UPDATE addresses
        SET is_default = false,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1
        `,
        [user_id]
      );
    }

    // --------------------------------------------------------
    // INSERT ADDRESS
    // --------------------------------------------------------

    const result = await pool.query(
      `
      INSERT INTO addresses (
        user_id,
        address_line,
        landmark,
        city,
        state,
        pincode,
        latitude,
        longitude,
        address_type,
        is_default
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10
      )
      RETURNING *
      `,
      [
        user_id,
        address_line,
        landmark || null,
        city || null,
        state || null,
        pincode,
        latitude || null,
        longitude || null,
        address_type || 'home',
        is_default === true,
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Address added successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error(
      'Add address error:',
      error
    );

    res.status(500).json({
      success: false,
      message: 'Unable to add address',
    });
  }
};

module.exports = {
  getUserAddresses,
  addAddress,
};

