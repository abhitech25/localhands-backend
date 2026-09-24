const pool = require('../config/database');

// ============================================================
// CREATE REVIEW / RATE WORKER
// ============================================================

const createReview = async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      booking_id,
      user_id,
      rating,
      comment
    } = req.body;

    // ----------------------------------------------------------
    // VALIDATION
    // ----------------------------------------------------------

    if (!booking_id || !user_id || rating === undefined) {
      return res.status(400).json({
        success: false,
        message: 'booking_id, user_id and rating are required'
      });
    }

    const numericRating = Number(rating);

    if (
      !Number.isInteger(numericRating) ||
      numericRating < 1 ||
      numericRating > 5
    ) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be an integer between 1 and 5'
      });
    }

    // ----------------------------------------------------------
    // START TRANSACTION
    // ----------------------------------------------------------

    await client.query('BEGIN');

    // ----------------------------------------------------------
    // GET BOOKING
    // ----------------------------------------------------------

    const bookingResult = await client.query(
      `
      SELECT
        b.id,
        b.user_id,
        b.worker_id,
        b.status
      FROM bookings b
      WHERE b.id = $1
      FOR UPDATE
      `,
      [booking_id]
    );

    if (bookingResult.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const booking = bookingResult.rows[0];

    // ----------------------------------------------------------
    // VERIFY CUSTOMER
    // ----------------------------------------------------------

    if (Number(booking.user_id) !== Number(user_id)) {
      await client.query('ROLLBACK');

      return res.status(403).json({
        success: false,
        message: 'You are not authorized to review this booking'
      });
    }

    // ----------------------------------------------------------
    // BOOKING MUST BE COMPLETED
    // ----------------------------------------------------------

    if (booking.status !== 'completed') {
      await client.query('ROLLBACK');

      return res.status(400).json({
        success: false,
        message: 'Only completed bookings can be reviewed'
      });
    }

    // ----------------------------------------------------------
    // BOOKING MUST HAVE WORKER
    // ----------------------------------------------------------

    if (booking.worker_id === null) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        success: false,
        message: 'This booking does not have an assigned worker'
      });
    }

    // ----------------------------------------------------------
    // CHECK EXISTING REVIEW
    // ----------------------------------------------------------

    const existingReview = await client.query(
      `
      SELECT id
      FROM reviews
      WHERE booking_id = $1
      `,
      [booking_id]
    );

    if (existingReview.rows.length > 0) {
      await client.query('ROLLBACK');

      return res.status(409).json({
        success: false,
        message: 'This booking has already been reviewed'
      });
    }

    // ----------------------------------------------------------
    // INSERT REVIEW
    // ----------------------------------------------------------

    const reviewResult = await client.query(
      `
      INSERT INTO reviews
      (
        booking_id,
        user_id,
        worker_id,
        rating,
        comment
      )
      VALUES
      (
        $1,
        $2,
        $3,
        $4,
        $5
      )
      RETURNING *
      `,
      [
        booking_id,
        user_id,
        booking.worker_id,
        numericRating,
        comment && comment.trim()
          ? comment.trim()
          : null
      ]
    );

    // ----------------------------------------------------------
    // RECALCULATE WORKER RATING
    // ----------------------------------------------------------

    const ratingResult = await client.query(
      `
      SELECT
        ROUND(AVG(rating)::numeric, 2) AS average_rating,
        COUNT(*) AS total_reviews
      FROM reviews
      WHERE worker_id = $1
      `,
      [booking.worker_id]
    );

    const averageRating =
      ratingResult.rows[0].average_rating || 0;

    // ----------------------------------------------------------
    // UPDATE WORKER RATING
    // ----------------------------------------------------------

    await client.query(
      `
      UPDATE workers
      SET
        rating = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      `,
      [
        averageRating,
        booking.worker_id
      ]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: 'Worker rated successfully',
      data: {
        review: reviewResult.rows[0],
        worker_rating: Number(averageRating),
        total_reviews: Number(
          ratingResult.rows[0].total_reviews
        )
      }
    });

  } catch (error) {

    await client.query('ROLLBACK');

    console.error(
      'Create review error:',
      error
    );

    // Handle duplicate booking review
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'This booking has already been reviewed'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Unable to submit review'
    });

  } finally {
    client.release();
  }
};


// ============================================================
// GET REVIEW FOR BOOKING
// ============================================================

const getBookingReview = async (req, res) => {
  try {

    const { booking_id } = req.params;

    const result = await pool.query(
      `
      SELECT
        r.id,
        r.booking_id,
        r.user_id,
        r.worker_id,
        r.rating,
        r.comment,
        r.created_at
      FROM reviews r
      WHERE r.booking_id = $1
      `,
      [booking_id]
    );

    if (result.rows.length === 0) {
      return res.status(200).json({
        success: true,
        reviewed: false,
        data: null
      });
    }

    return res.status(200).json({
      success: true,
      reviewed: true,
      data: result.rows[0]
    });

  } catch (error) {

    console.error(
      'Get booking review error:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Unable to fetch booking review'
    });
  }
};


// ============================================================
// GET WORKER REVIEWS
// ============================================================

const getWorkerReviews = async (req, res) => {
  try {

    const { worker_id } = req.params;

    const result = await pool.query(
      `
      SELECT
        r.id,
        r.booking_id,
        r.rating,
        r.comment,
        r.created_at,
        u.name AS customer_name
      FROM reviews r
      LEFT JOIN users u
        ON u.id = r.user_id
      WHERE r.worker_id = $1
      ORDER BY r.created_at DESC
      `,
      [worker_id]
    );

    return res.status(200).json({
      success: true,
      data: result.rows
    });

  } catch (error) {

    console.error(
      'Get worker reviews error:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Unable to fetch worker reviews'
    });
  }
};


module.exports = {
  createReview,
  getBookingReview,
  getWorkerReviews
};