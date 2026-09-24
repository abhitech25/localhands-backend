const pool = require('../config/database');

const createBooking = async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      user_id,
      service_id,
      service_option_id,
      address_id,
      problem_description,
      scheduled_date,
      scheduled_time_start,
      scheduled_time_end,
      estimated_price
    } = req.body;

    // Validate required fields
    if (
      !user_id ||
      !service_id ||
      !address_id ||
      !scheduled_date ||
      !scheduled_time_start ||
      !scheduled_time_end
    ) {
      return res.status(400).json({
        success: false,
        message: 'Missing required booking information'
      });
    }

    await client.query('BEGIN');

    // Verify service option and get its price
    let price = estimated_price;

    if (service_option_id) {
      const optionResult = await client.query(
        `
        SELECT base_price
        FROM service_options
        WHERE id = $1
        AND service_id = $2
        AND is_active = TRUE
        `,
        [
          service_option_id,
          service_id
        ]
      );

      if (optionResult.rows.length === 0) {
        await client.query('ROLLBACK');

        return res.status(404).json({
          success: false,
          message: 'Service option not found'
        });
      }

      price = optionResult.rows[0].base_price;
    }

    // Generate unique booking number
    const bookingNumber =
      'LH' + Date.now().toString();

    // Create booking
    const bookingResult = await client.query(
      `
      INSERT INTO bookings
      (
        booking_number,
        user_id,
        service_id,
        service_option_id,
        address_id,
        problem_description,
        scheduled_date,
        scheduled_time_start,
        scheduled_time_end,
        estimated_price,
        status
      )
      VALUES
      (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        'pending'
      )
      RETURNING *
      `,
      [
        bookingNumber,
        user_id,
        service_id,
        service_option_id || null,
        address_id,
        problem_description || null,
        scheduled_date,
        scheduled_time_start,
        scheduled_time_end,
        price || null
      ]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: bookingResult.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');

    console.error(
      'Create booking error:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Unable to create booking'
    });

  } finally {
    client.release();
  }
};

//module.exports = {
//  createBooking
//};

const getMyBookings = async (req, res) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: 'user_id is required'
      });
    }

    const result = await pool.query(
      `
      SELECT
        b.id,
        b.booking_number,
        b.user_id,
        b.service_id,
        b.service_option_id,

        b.address_id,

        -- Address details
        a.address_line,
        a.landmark,
        a.city,
        a.state,
        a.pincode,

        b.problem_description,
        TO_CHAR(
          b.scheduled_date,
          'YYYY-MM-DD'
        ) AS scheduled_date,

        b.scheduled_time_start,
        b.scheduled_time_end,
        b.estimated_price,
        b.status,
        b.created_at,

        s.name AS service_name,

        so.name AS option_name,
        so.base_price AS option_price

      FROM bookings b

      LEFT JOIN services s
        ON s.id = b.service_id

      LEFT JOIN service_options so
        ON so.id = b.service_option_id

      LEFT JOIN addresses a
        ON a.id = b.address_id

      WHERE b.user_id = $1

      ORDER BY b.id DESC
      `,
      [user_id]
    );

    return res.status(200).json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error(
      'Get my bookings error:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Unable to fetch bookings'
    });
  }
};

const getBookingById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
        b.id,
        b.booking_number,
        b.user_id,
        b.service_id,
        b.service_option_id,
        b.worker_id,
        b.address_id,
        b.problem_description,

        TO_CHAR(
          b.scheduled_date,
          'YYYY-MM-DD'
        ) AS scheduled_date,

        b.scheduled_time_start,
        b.scheduled_time_end,
        b.estimated_price,
        b.final_price,
        b.status,
        b.cancellation_reason,
        b.created_at,

        s.name AS service_name,

        so.name AS option_name,
        so.base_price AS option_price,

        a.address_line,
        a.landmark,
        a.city,
        a.state,
        a.pincode,
        a.address_type,

        u.name AS worker_name,
        u.phone AS worker_phone

      FROM bookings b

      LEFT JOIN services s
        ON b.service_id = s.id

      LEFT JOIN service_options so
        ON b.service_option_id = so.id

      LEFT JOIN addresses a
        ON b.address_id = a.id

      LEFT JOIN workers w
        ON b.worker_id = w.id

      LEFT JOIN users u
        ON w.user_id = u.id

      WHERE b.id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error(
      'Get booking error:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Unable to fetch booking'
    });
  }
};

const cancelBooking = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { cancellation_reason } = req.body;

    if (!cancellation_reason ||
        !cancellation_reason.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Cancellation reason is required'
      });
    }

    await client.query('BEGIN');

    const bookingResult = await client.query(
      `
      SELECT id, status
      FROM bookings
      WHERE id = $1
      FOR UPDATE
      `,
      [id]
    );

    if (bookingResult.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const booking =
      bookingResult.rows[0];

    // Only pending bookings can be cancelled
    if (booking.status !== 'pending') {
      await client.query('ROLLBACK');

      return res.status(400).json({
        success: false,
        message:
          `Booking cannot be cancelled because its current status is '${booking.status}'`
      });
    }

    const result = await client.query(
      `
      UPDATE bookings
      SET
        status = 'cancelled',
        cancellation_reason = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
      `,
      [
        cancellation_reason.trim(),
        id
      ]
    );

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully',
      data: result.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');

    console.error(
      'Cancel booking error:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Unable to cancel booking'
    });

  } finally {
    client.release();
  }
};



// ============================================================
// GET AVAILABLE WORKER BOOKINGS
// ============================================================

// ============================================================
// GET WORKER BOOKINGS
// ============================================================

// ============================================================
// GET WORKER BOOKINGS
// ============================================================

const getWorkerBookings = async (req, res) => {
  try {
    const { worker_id } = req.query;

    if (!worker_id) {
      return res.status(400).json({
        success: false,
        message: 'worker_id is required'
      });
    }

    const result = await pool.query(
      `
      SELECT
        b.id,
        b.booking_number,
        b.user_id,
        b.service_id,
        b.service_option_id,
        b.worker_id,
        b.address_id,
        b.problem_description,

        TO_CHAR(
          b.scheduled_date,
          'YYYY-MM-DD'
        ) AS scheduled_date,

        b.scheduled_time_start,
        b.scheduled_time_end,
        b.estimated_price,
        b.final_price,
        b.status,
        b.created_at,

        s.name AS service_name,

        so.name AS option_name,
        so.base_price AS option_price

      FROM bookings b

      LEFT JOIN services s
        ON s.id = b.service_id

      LEFT JOIN service_options so
        ON so.id = b.service_option_id

      WHERE

      (
        -- ======================================================
        -- NEW JOBS
        -- Only show pending paid jobs for services
        -- provided by this worker
        -- ======================================================

        (
          b.status IN ('pending', 'searching_worker')
          AND b.payment_status = 'paid'
          AND b.worker_id IS NULL

          AND EXISTS (
            SELECT 1
            FROM worker_services ws
            WHERE ws.worker_id = $1
              AND ws.service_id = b.service_id
          )
        )

        OR

        -- ======================================================
        -- ALREADY ASSIGNED JOBS
        -- Only return jobs assigned to this worker
        -- ======================================================

        (
          b.worker_id = $1
          AND b.status IN (
            'worker_assigned',
            'worker_on_the_way',
            'worker_arrived',
            'in_progress',
            'completed'
          )
        )
      )

      AND NOT EXISTS (
        SELECT 1
        FROM booking_rejections br
        WHERE br.booking_id = b.id
          AND br.worker_id = $1
      )

      ORDER BY
        b.scheduled_date ASC,
        b.scheduled_time_start ASC,
        b.id DESC
      `,
      [worker_id]
    );

    return res.status(200).json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error(
      'Get worker bookings error:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Unable to fetch worker bookings'
    });
  }
};
// ============================================================
// ACCEPT BOOKING
// ============================================================



const acceptBooking = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { worker_id } = req.body;

    if (!worker_id) {
      return res.status(400).json({
        success: false,
        message: 'worker_id is required'
      });
    }

    await client.query('BEGIN');

    // ============================================================
    // CHECK BOOKING + WORKER SERVICE
    // ============================================================

    const bookingResult = await client.query(
      `
      SELECT
        b.id,
        b.worker_id,
        b.service_id,
        b.status,

        EXISTS (
          SELECT 1
          FROM worker_services ws
          WHERE ws.worker_id = $2
            AND ws.service_id = b.service_id
        ) AS worker_provides_service

      FROM bookings b

      WHERE b.id = $1

      FOR UPDATE
      `,
      [id, worker_id]
    );

    if (bookingResult.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const booking = bookingResult.rows[0];

    // ============================================================
    // VERIFY WORKER SERVICE
    // ============================================================

    if (!booking.worker_provides_service) {
      await client.query('ROLLBACK');

      return res.status(403).json({
        success: false,
        message: 'You are not authorized to accept this service booking'
      });
    }

    // ============================================================
    // CHECK ALREADY ASSIGNED
    // ============================================================

    if (booking.worker_id !== null) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        success: false,
        message: 'Booking has already been assigned to a worker'
      });
    }

    // ============================================================
    // CHECK STATUS
    // ============================================================

    if (booking.status !== 'pending') {
      await client.query('ROLLBACK');

      return res.status(400).json({
        success: false,
        message:
          `Booking cannot be accepted because its current status is '${booking.status}'`
      });
    }

    // ============================================================
    // ASSIGN WORKER
    // ============================================================

    const result = await client.query(
      `
      UPDATE bookings
      SET
        worker_id = $1,
        status = 'worker_assigned',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
      `,
      [worker_id, id]
    );

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: 'Booking accepted successfully',
      data: result.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');

    console.error(
      'Accept booking error:',
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message
    });

  } finally {
    client.release();
  }
};


// ============================================================
// REJECT BOOKING
// ============================================================

const rejectBooking = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { worker_id } = req.body;

    if (!worker_id) {
      return res.status(400).json({
        success: false,
        message: 'worker_id is required'
      });
    }

    await client.query('BEGIN');

    // Check booking
    const bookingResult = await client.query(
      `
      SELECT
        b.id,
        b.worker_id,
        b.service_id,
        b.status,

        EXISTS (
          SELECT 1
          FROM worker_services ws
          WHERE ws.worker_id = $2
            AND ws.service_id = b.service_id
        ) AS worker_provides_service

      FROM bookings b
      WHERE b.id = $1
      FOR UPDATE
      `,
      [id, worker_id]
    );







    if (bookingResult.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

//    const booking = bookingResult.rows[0];

    const booking = bookingResult.rows[0];

    if (!booking.worker_provides_service) {
      await client.query('ROLLBACK');

      return res.status(403).json({
        success: false,
        message: 'You are not authorized to reject this service booking'
      });
    }

    // Only pending bookings can be rejected
    if (booking.status !== 'pending') {
      await client.query('ROLLBACK');

      return res.status(400).json({
        success: false,
        message:
          `Booking cannot be rejected because its current status is '${booking.status}'`
      });
    }

    // Booking must not already be assigned
    if (booking.worker_id !== null) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        success: false,
        message: 'Booking has already been assigned to a worker'
      });
    }

    // Store this worker's rejection
    await client.query(
      `
      INSERT INTO booking_rejections (
        booking_id,
        worker_id
      )
      VALUES ($1, $2)
      ON CONFLICT (booking_id, worker_id)
      DO NOTHING
      `,
      [id, worker_id]
    );

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: 'Booking rejected successfully'
    });

  } catch (error) {
    await client.query('ROLLBACK');

    console.error(
      'Reject booking error:',
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message
    });

  } finally {
    client.release();
  }
};
const updateWorkerBookingStatus = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { worker_id, status } = req.body;

    if (!worker_id || !status) {
      return res.status(400).json({
        success: false,
        message: 'worker_id and status are required'
      });
    }

    const allowedStatuses = [
      'worker_on_the_way',
      'worker_arrived',
      'in_progress',
      'completed'
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid worker booking status'
      });
    }

    await client.query('BEGIN');

    const bookingResult = await client.query(
      `
      SELECT id, worker_id, status
      FROM bookings
      WHERE id = $1
      FOR UPDATE
      `,
      [id]
    );

    if (bookingResult.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const booking = bookingResult.rows[0];

    if (booking.worker_id === null) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        success: false,
        message: 'Booking is not assigned to any worker'
      });
    }

    if (Number(booking.worker_id) !== Number(worker_id)) {
      await client.query('ROLLBACK');

      return res.status(403).json({
        success: false,
        message: 'This booking is assigned to another worker'
      });
    }

    const validTransitions = {
      worker_assigned: 'worker_on_the_way',
      worker_on_the_way: 'worker_arrived',
      worker_arrived: 'in_progress',
      in_progress: 'completed'
    };

    if (validTransitions[booking.status] !== status) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        success: false,
        message:
          `Invalid status transition from '${booking.status}' to '${status}'`
      });
    }

    const result = await client.query(
      `
      UPDATE bookings
      SET
        status = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
      `,
      [status, id]
    );

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: 'Booking status updated successfully',
      data: result.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');

    console.error('Update worker booking status error:', error);

    return res.status(500).json({
      success: false,
      message: error.message
    });

  } finally {
    client.release();
  }
};


const startBooking = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { worker_id } = req.body;

    if (!worker_id) {
      return res.status(400).json({
        success: false,
        message: 'worker_id is required'
      });
    }

    await client.query('BEGIN');

    const bookingResult = await client.query(
      `
      SELECT
        id,
        worker_id,
        status
      FROM bookings
      WHERE id = $1
      FOR UPDATE
      `,
      [id]
    );

    if (bookingResult.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const booking = bookingResult.rows[0];

    if (booking.worker_id === null) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        success: false,
        message: 'Booking is not assigned to any worker'
      });
    }

    if (Number(booking.worker_id) !== Number(worker_id)) {
      await client.query('ROLLBACK');

      return res.status(403).json({
        success: false,
        message: 'This booking is assigned to another worker'
      });
    }

    if (booking.status !== 'worker_arrived') {
      await client.query('ROLLBACK');

      return res.status(400).json({
        success: false,
        message:
          `Job cannot be started because current status is '${booking.status}'`
      });
    }

    const result = await client.query(
      `
      UPDATE bookings
      SET
        status = 'in_progress',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
      `,
      [id]
    );

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: 'Job started successfully',
      data: result.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');

    console.error('Start booking error:', error);

    return res.status(500).json({
      success: false,
      message: error.message
    });

  } finally {
    client.release();
  }
};










module.exports = {
  createBooking,
  getMyBookings,
  getBookingById,
  cancelBooking,
  getWorkerBookings,
  acceptBooking,
  rejectBooking,
  updateWorkerBookingStatus,
  startBooking
};
