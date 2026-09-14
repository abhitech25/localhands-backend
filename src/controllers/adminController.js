const pool = require('../config/database');

// ==========================================
// GET PENDING WORKERS
// ==========================================

const getPendingWorkers = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        w.id AS worker_id,
        u.id AS user_id,
        u.name,
        u.phone,
        u.email,
        w.experience_years,
        w.rating,
        w.total_jobs,
        w.is_verified,
        w.is_available,
        w.profile_photo,
        w.created_at
      FROM workers w
      INNER JOIN users u
        ON w.user_id = u.id
      WHERE w.is_verified = FALSE
      ORDER BY w.created_at DESC
      `
    );

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      workers: result.rows
    });

  } catch (error) {
    console.error(
      'Get pending workers error:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Unable to fetch pending workers'
    });
  }
};

// ==========================================
// APPROVE WORKER
// ==========================================

const approveWorker = async (req, res) => {
  try {
    const { workerId } = req.params;

    if (!workerId) {
      return res.status(400).json({
        success: false,
        message: 'Worker ID is required'
      });
    }

    const result = await pool.query(
      `
      UPDATE workers
      SET
        is_verified = TRUE,
        updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        user_id,
        is_verified,
        is_available
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
      message: 'Worker approved successfully',
      worker: result.rows[0]
    });

  } catch (error) {
    console.error(
      'Approve worker error:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Unable to approve worker'
    });
  }
};

// ==========================================
// GET WORKER DETAILS
// ==========================================

const getWorkerDetails = async (req, res) => {
  try {
    const { workerId } = req.params;

    if (!workerId) {
      return res.status(400).json({
        success: false,
        message: 'Worker ID is required'
      });
    }

    const workerResult = await pool.query(
      `
      SELECT
        w.id AS worker_id,
        u.id AS user_id,
        u.name,
        u.phone,
        u.email,
        u.role,
        u.is_active,
        w.profile_photo,
        w.experience_years,
        w.rating,
        w.total_jobs,
        w.is_verified,
        w.is_available,
        w.latitude,
        w.longitude,
        w.created_at,
        w.updated_at
      FROM workers w
      INNER JOIN users u
        ON w.user_id = u.id
      WHERE w.id = $1
      `,
      [workerId]
    );

    if (workerResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found'
      });
    }

    const worker = workerResult.rows[0];

    // Get worker services
    const servicesResult = await pool.query(
      `
      SELECT
        s.id,
        s.name
      FROM worker_services ws
      INNER JOIN services s
        ON ws.service_id = s.id
      WHERE ws.worker_id = $1
      ORDER BY s.name
      `,
      [workerId]
    );

    return res.status(200).json({
      success: true,
      worker: {
        ...worker,
        services: servicesResult.rows
      }
    });

  } catch (error) {
    console.error(
      'Get worker details error:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Unable to fetch worker details'
    });
  }
};

// ==========================================
// REJECT WORKER
// ==========================================

const rejectWorker = async (req, res) => {
  try {
    const { workerId } = req.params;

    if (!workerId) {
      return res.status(400).json({
        success: false,
        message: 'Worker ID is required'
      });
    }

    const result = await pool.query(
      `
      UPDATE workers
      SET
        is_verified = FALSE,
        is_available = FALSE,
        updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        user_id,
        is_verified,
        is_available
      `,
      [workerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found'
      });
    }

    // Also deactivate the user account
    await pool.query(
      `
      UPDATE users
      SET
        is_active = FALSE
      WHERE id = $1
      `,
      [result.rows[0].user_id]
    );

    return res.status(200).json({
      success: true,
      message: 'Worker rejected successfully',
      worker: result.rows[0]
    });

  } catch (error) {
    console.error(
      'Reject worker error:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Unable to reject worker'
    });
  }
};

// ==========================================
// GET ALL WORKERS
// ==========================================

const getAllWorkers = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        w.id AS worker_id,
        u.id AS user_id,
        u.name,
        u.phone,
        u.email,
        u.is_active,
        w.profile_photo,
        w.experience_years,
        w.rating,
        w.total_jobs,
        w.is_verified,
        w.is_available,
        w.created_at,
        w.updated_at
      FROM workers w
      INNER JOIN users u
        ON w.user_id = u.id
      ORDER BY w.created_at DESC
      `
    );

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      workers: result.rows
    });

  } catch (error) {
    console.error(
      'Get all workers error:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Unable to fetch workers'
    });
  }
};

const getDashboardStats = async (req, res) => {
  try {
    const workersResult = await pool.query(`
      SELECT COUNT(*) AS total
      FROM workers
    `);

    const pendingWorkersResult = await pool.query(`
      SELECT COUNT(*) AS total
      FROM workers
      WHERE is_verified = false
    `);

    const customersResult = await pool.query(`
      SELECT COUNT(*) AS total
      FROM users
      WHERE role = 'customer'
    `);

    const bookingsResult = await pool.query(`
      SELECT COUNT(*) AS total
      FROM bookings
    `);

    res.json({
      success: true,
      stats: {
        total_workers: Number(workersResult.rows[0].total),
        pending_workers: Number(pendingWorkersResult.rows[0].total),
        total_customers: Number(customersResult.rows[0].total),
        total_bookings: Number(bookingsResult.rows[0].total),
      },
    });

  } catch (error) {
    console.error('Dashboard stats error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics',
    });
  }
};

const getAllCustomers = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        name,
        phone,
        email,
        is_active,
        created_at
      FROM users
      WHERE role = 'customer'
      ORDER BY created_at DESC
    `);

    res.json({
      success: true,
      count: result.rows.length,
      customers: result.rows,
    });

  } catch (error) {
    console.error('Get customers error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to fetch customers',
    });
  }
};

const getCustomerDetails = async (req, res) => {
  try {
    const { customerId } = req.params;

    const result = await pool.query(
      `
      SELECT
        id,
        name,
        phone,
        email,
        role,
        is_active,
        created_at
      FROM users
      WHERE id = $1
        AND role = 'customer'
      `,
      [customerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
    }

    res.json({
      success: true,
      customer: result.rows[0],
    });

  } catch (error) {
    console.error('Get customer details error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to fetch customer details',
    });
  }
};

const getCustomerBookings = async (req, res) => {
  try {
    const { customerId } = req.params;

    // Check customer exists
    const customerResult = await pool.query(
      `
      SELECT id
      FROM users
      WHERE id = $1
        AND role = 'customer'
      `,
      [customerId]
    );

    if (customerResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
    }

    const result = await pool.query(
      `
      SELECT
        b.id,
        b.booking_number,
        b.service_id,
        b.worker_id,
        b.problem_description,
        b.scheduled_date,
        b.scheduled_time_start,
        b.scheduled_time_end,
        b.estimated_price,
        b.final_price,
        b.status,
        b.created_at,

        s.name AS service_name,

        u.name AS worker_name,
        u.phone AS worker_phone

      FROM bookings b

      LEFT JOIN services s
        ON s.id = b.service_id

      LEFT JOIN workers w
        ON w.id = b.worker_id

      LEFT JOIN users u
        ON u.id = w.user_id

      WHERE b.user_id = $1

      ORDER BY b.created_at DESC
      `,
      [customerId]
    );

    res.json({
      success: true,
      count: result.rows.length,
      bookings: result.rows,
    });

  } catch (error) {
    console.error(
      'Get customer bookings error:',
      error
    );

    res.status(500).json({
      success: false,
      message: 'Failed to fetch customer bookings',
    });
  }
};

const getAllBookings = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        b.id,
        b.booking_number,
        b.problem_description,
        b.scheduled_date,
        b.scheduled_time_start,
        b.scheduled_time_end,
        b.estimated_price,
        b.final_price,
        b.status,
        b.created_at,

        s.name AS service_name,

        customer.name AS customer_name,
        customer.phone AS customer_phone,

        worker_user.name AS worker_name,
        worker_user.phone AS worker_phone

      FROM bookings b

      LEFT JOIN services s
        ON s.id = b.service_id

      LEFT JOIN users customer
        ON customer.id = b.user_id

      LEFT JOIN workers w
        ON w.id = b.worker_id

      LEFT JOIN users worker_user
        ON worker_user.id = w.user_id

      ORDER BY b.created_at DESC
    `);

    res.json({
      success: true,
      count: result.rows.length,
      bookings: result.rows,
    });

  } catch (error) {
    console.error('Get all bookings error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings',
    });
  }
};

const getBookingDetails = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const result = await pool.query(
      `
      SELECT
        b.id,
        b.booking_number,
        b.problem_description,
        b.scheduled_date,
        b.scheduled_time_start,
        b.scheduled_time_end,
        b.estimated_price,
        b.final_price,
        b.status,
        b.created_at,

        s.id AS service_id,
        s.name AS service_name,

        customer.id AS customer_id,
        customer.name AS customer_name,
        customer.phone AS customer_phone,
        customer.email AS customer_email,

        w.id AS worker_id,
        worker_user.name AS worker_name,
        worker_user.phone AS worker_phone,
        worker_user.email AS worker_email

      FROM bookings b

      LEFT JOIN services s
        ON s.id = b.service_id

      LEFT JOIN users customer
        ON customer.id = b.user_id

      LEFT JOIN workers w
        ON w.id = b.worker_id

      LEFT JOIN users worker_user
        ON worker_user.id = w.user_id

      WHERE b.id = $1
      `,
      [bookingId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    res.json({
      success: true,
      booking: result.rows[0],
    });

  } catch (error) {
    console.error(
      'Get booking details error:',
      error
    );

    res.status(500).json({
      success: false,
      message: 'Failed to fetch booking details',
    });
  }
};

const getAllServices = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        name,
        description,
        is_active,
        created_at
      FROM services
      ORDER BY id ASC
    `);

    res.json({
      success: true,
      count: result.rows.length,
      services: result.rows,
    });

  } catch (error) {
    console.error('Get services error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to fetch services',
    });
  }
};

const createService = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Service name is required',
      });
    }

    const result = await pool.query(
      `
      INSERT INTO services
      (
        name,
        description,
        is_active
      )
      VALUES
      (
        $1,
        $2,
        true
      )
      RETURNING
        id,
        name,
        description,
        is_active,
        created_at
      `,
      [
        name.trim(),
        description?.trim() || null,
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Service created successfully',
      service: result.rows[0],
    });

  } catch (error) {
    console.error('Create service error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to create service',
    });
  }
};

const updateService = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Service name is required',
      });
    }

    const result = await pool.query(
      `
      UPDATE services
      SET
        name = $1,
        description = $2
      WHERE id = $3
      RETURNING
        id,
        name,
        description,
        is_active,
        created_at
      `,
      [
        name.trim(),
        description?.trim() || null,
        serviceId,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Service not found',
      });
    }

    res.json({
      success: true,
      message: 'Service updated successfully',
      service: result.rows[0],
    });

  } catch (error) {
    console.error('Update service error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to update service',
    });
  }
};

const toggleServiceStatus = async (req, res) => {
  try {
    const { serviceId } = req.params;

    const result = await pool.query(
      `
      UPDATE services
      SET
        is_active = NOT is_active
      WHERE id = $1
      RETURNING
        id,
        name,
        description,
        is_active,
        created_at
      `,
      [serviceId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Service not found',
      });
    }

    res.json({
      success: true,
      message: result.rows[0].is_active
        ? 'Service activated successfully'
        : 'Service deactivated successfully',
      service: result.rows[0],
    });

  } catch (error) {
    console.error(
      'Toggle service status error:',
      error
    );

    res.status(500).json({
      success: false,
      message: 'Failed to update service status',
    });
  }
};
const getRecentActivity = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        'booking' AS activity_type,
        b.id,
        b.booking_number AS reference,
        b.status,
        b.created_at,

        customer.name AS customer_name,
        s.name AS service_name

      FROM bookings b

      LEFT JOIN users customer
        ON customer.id = b.user_id

      LEFT JOIN services s
        ON s.id = b.service_id

      ORDER BY b.created_at DESC

      LIMIT 10
    `);

    res.json({
      success: true,
      activities: result.rows,
    });

  } catch (error) {
    console.error(
      'Get recent activity error:',
      error
    );

    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent activity',
    });
  }
};


module.exports = {
  getPendingWorkers,
  approveWorker,
  getWorkerDetails,
  rejectWorker,
  getAllWorkers,
  getDashboardStats,
  getAllCustomers,
  getCustomerDetails,
  getCustomerBookings,
  getAllBookings,
  getBookingDetails,
  getAllServices,
  createService,
  updateService,
  toggleServiceStatus,
  getRecentActivity,

};