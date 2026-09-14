const pool = require('../config/database');

// GET /api/services
const getServices = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        name,
        description,
        icon
      FROM services
      WHERE is_active = TRUE
      ORDER BY id
    `);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get services error:', error);

    res.status(500).json({
      success: false,
      message: 'Unable to fetch services',
    });
  }
};


// GET /api/services/:id
const getServiceById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
        id,
        name,
        description,
        icon
      FROM services
      WHERE id = $1
        AND is_active = TRUE
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Service not found',
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Get service error:', error);

    res.status(500).json({
      success: false,
      message: 'Unable to fetch service',
    });
  }
};


// GET /api/services/:id/options
const getServiceOptions = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
        id,
        service_id,
        name,
        description,
        base_price
      FROM service_options
      WHERE service_id = $1
        AND is_active = TRUE
      ORDER BY id
      `,
      [id]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get service options error:', error);

    res.status(500).json({
      success: false,
      message: 'Unable to fetch service options',
    });
  }
};


module.exports = {
  getServices,
  getServiceById,
  getServiceOptions,
};