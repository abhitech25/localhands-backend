const pool = require('../config/database');
const jwt = require('jsonwebtoken');
const axios = require('axios');

// Temporary development OTP storage
const otpStore = new Map();


// ======================================================
// VERIFY MSG91 ACCESS TOKEN
// ======================================================

const verifyMSG91AccessToken = async (accessToken) => {
  try {
    const response = await axios.post(
      'https://control.msg91.com/api/v5/widget/verifyAccessToken',
      {
        'access-token': accessToken
      },
      {
        headers: {
          authkey: process.env.MSG91_AUTHKEY,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(
      'MSG91 ACCESS TOKEN RESPONSE:',
      response.data
    );

    return response.data;

  } catch (error) {

    console.error(
      'MSG91 ACCESS TOKEN ERROR:',
      error.response?.data || error.message
    );

    throw new Error(
      'MSG91 access token verification failed'
    );
  }
};


// ======================================================
// MSG91 LOGIN / REGISTRATION
// ======================================================

const msg91Login = async (req, res) => {

  try {

    const {
      access_token,
      phone,
      role,
      name
    } = req.body;

    // ------------------------------------------
    // VALIDATION
    // ------------------------------------------

    if (!access_token) {
      return res.status(400).json({
        success: false,
        message: 'MSG91 access token is required'
      });
    }

    if (!role || !['customer', 'worker'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Valid role is required'
      });
    }

    // ------------------------------------------
    // VERIFY TOKEN WITH MSG91
    // ------------------------------------------

    const msg91Result =
      await verifyMSG91AccessToken(access_token);

    console.log(
      'MSG91 VERIFIED RESULT:',
      msg91Result
    );

    // ------------------------------------------
    // GET VERIFIED PHONE
    // ------------------------------------------
     if (!phone) {
       return res.status(400).json({
         success: false,
         message: 'Phone number is required'
       });
     }


    // Remove +91 / 91 prefix if MSG91 returns it
    const cleanPhone = phone
      .toString()
      .replace(/\D/g, '')
      .replace(/^91(?=\d{10}$)/, '');

    if (!/^\d{10}$/.test(cleanPhone)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid mobile number'
      });
    }

    // ------------------------------------------
    // CHECK USER
    // ------------------------------------------

    const userResult = await pool.query(
      `
      SELECT
        id,
        name,
        phone,
        email,
        role,
        is_active
      FROM users
      WHERE phone = $1
      `,
      [cleanPhone]
    );

    // ==================================================
    // EXISTING USER
    // ==================================================

    if (userResult.rows.length > 0) {

      const user = userResult.rows[0];

      // ------------------------------------------
      // ACTIVE CHECK
      // ------------------------------------------

      if (!user.is_active) {

        return res.status(403).json({
          success: false,
          message: 'User account is inactive'
        });
      }

      // ------------------------------------------
      // ROLE CHECK
      // ------------------------------------------

      if (user.role !== role) {

        return res.status(403).json({
          success: false,
          message:
            `This mobile number is registered as ${user.role}`
        });
      }

      // ------------------------------------------
      // WORKER CHECK
      // ------------------------------------------

      let workerId = null;

      if (role === 'worker') {

        const workerResult = await pool.query(
          `
          SELECT
            id,
            is_verified
          FROM workers
          WHERE user_id = $1
          `,
          [user.id]
        );

        if (workerResult.rows.length === 0) {

          return res.status(404).json({
            success: false,
            message: 'Worker profile not found'
          });
        }

        workerId = workerResult.rows[0].id;

        if (workerResult.rows[0].is_verified !== true) {

          return res.status(403).json({
            success: false,
            pending_verification: true,
            message:
              'Your worker registration is pending admin verification'
          });
        }
      }

      // ------------------------------------------
      // CREATE JWT
      // ------------------------------------------

      const token = jwt.sign(
        {
          userId: user.id,
          role: user.role
        },
        process.env.JWT_SECRET ||
          'localhands-development-secret',
        {
          expiresIn: '7d'
        }
      );

      return res.status(200).json({
        success: true,
        registration: false,
        message: 'Login successful',
        token,

        user: {
          id: user.id,
          name: user.name,
          phone: user.phone,
          email: user.email,
          role: user.role,
          worker_id: workerId
        }
      });
    }

    // ==================================================
    // NEW USER
    // ==================================================

    if (!name || !name.trim()) {

      return res.status(400).json({
        success: false,
        message:
          'Name is required for new registration'
      });
    }

    // ------------------------------------------
    // CUSTOMER REGISTRATION
    // ------------------------------------------

    if (role === 'customer') {

      const newUserResult = await pool.query(
        `
        INSERT INTO users
        (
          name,
          phone,
          role,
          is_active
        )
        VALUES
        (
          $1,
          $2,
          'customer',
          TRUE
        )
        RETURNING
          id,
          name,
          phone,
          email,
          role,
          is_active
        `,
        [
          name.trim(),
          cleanPhone
        ]
      );

      const user = newUserResult.rows[0];

      const token = jwt.sign(
        {
          userId: user.id,
          role: user.role
        },
        process.env.JWT_SECRET ||
          'localhands-development-secret',
        {
          expiresIn: '7d'
        }
      );

      return res.status(201).json({
        success: true,
        registration: true,
        message: 'Account created successfully',
        token,

        user: {
          id: user.id,
          name: user.name,
          phone: user.phone,
          email: user.email,
          role: user.role,
          worker_id: null
        }
      });
    }

    // ------------------------------------------
    // WORKER REGISTRATION
    // ------------------------------------------

    if (role === 'worker') {

      return res.status(400).json({
        success: false,
        message:
          'Worker registration requires service selection'
      });
    }

  } catch (error) {

    console.error(
      'MSG91 login error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Unable to complete MSG91 login'
    });
  }
};






// ======================================================
// CHECK CUSTOMER
// ======================================================

const checkCustomer = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required',
      });
    }

    const cleanPhone = phone
      .toString()
      .replace(/\D/g, '')
      .replace(/^91(?=\d{10}$)/, '');

    if (!/^\d{10}$/.test(cleanPhone)) {
      return res.status(400).json({
        success: false,
        message: 'Phone number must be 10 digits',
      });
    }

    const result = await pool.query(
      `
      SELECT id, name, phone, role, is_active
      FROM users
      WHERE phone = $1
      `,
      [cleanPhone]
    );

    if (result.rows.length === 0) {
      return res.status(200).json({
        success: true,
        exists: false,
      });
    }

    const user = result.rows[0];

    if (user.role !== 'customer') {
      return res.status(200).json({
        success: true,
        exists: true,
        role: user.role,
        message: `This mobile number is registered as ${user.role}`,
      });
    }

    return res.status(200).json({
      success: true,
      exists: true,
      role: 'customer',
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        is_active: user.is_active,
      },
    });

  } catch (error) {
    console.error('Check customer error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to check customer',
    });
  }
};


// ======================================================
// VERIFY MSG91 ACCESS TOKEN
// ======================================================

const verifyMSG91AccessTokenForCustomer = async (accessToken) => {
  try {
    const response = await axios.post(
      'https://control.msg91.com/api/v5/widget/verifyAccessToken',
      {
        'access-token': accessToken,
      },
      {
        headers: {
          authkey: process.env.MSG91_AUTHKEY,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log(
      'MSG91 CUSTOMER ACCESS TOKEN RESPONSE:',
      response.data
    );

    return response.data;

  } catch (error) {
    console.error(
      'MSG91 CUSTOMER ACCESS TOKEN ERROR:',
      error.response?.data || error.message
    );

    throw new Error(
      'MSG91 access token verification failed'
    );
  }
};


// ======================================================
// CUSTOMER LOGIN
// ======================================================

const loginCustomer = async (req, res) => {
  try {
    const { access_token } = req.body;

    if (!access_token) {
      return res.status(400).json({
        success: false,
        message: 'MSG91 access token is required',
      });
    }

    // ------------------------------------------
    // VERIFY MSG91 TOKEN
    // ------------------------------------------

    const msg91Result =
      await verifyMSG91AccessTokenForCustomer(access_token);

    console.log(
      'MSG91 CUSTOMER VERIFIED RESULT:',
      msg91Result
    );

    // ------------------------------------------
    // GET VERIFIED PHONE
    // ------------------------------------------

    const phone =
      msg91Result?.data?.mobile ||
      msg91Result?.data?.phone ||
      msg91Result?.mobile ||
      msg91Result?.phone;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message:
          'Unable to get verified mobile number from MSG91',
      });
    }

    const cleanPhone = phone
      .toString()
      .replace(/^\+91/, '')
      .replace(/^91(?=\d{10}$)/, '');

    if (!/^\d{10}$/.test(cleanPhone)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid mobile number returned by MSG91',
      });
    }

    // ------------------------------------------
    // FIND CUSTOMER
    // ------------------------------------------

    const result = await pool.query(
      `
      SELECT
        id,
        name,
        phone,
        email,
        role,
        is_active
      FROM users
      WHERE phone = $1
      `,
      [cleanPhone]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message:
          'Customer not registered. Please register first.',
      });
    }

    const user = result.rows[0];

    // ------------------------------------------
    // ROLE CHECK
    // ------------------------------------------

    if (user.role !== 'customer') {
      return res.status(403).json({
        success: false,
        message:
          `This mobile number is registered as ${user.role}`,
      });
    }

    // ------------------------------------------
    // ACTIVE CHECK
    // ------------------------------------------

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Customer account is inactive',
      });
    }

    // ------------------------------------------
    // CREATE LOCALHANDS JWT
    // ------------------------------------------

    const token = jwt.sign(
      {
        userId: user.id,
        role: 'customer',
      },
      process.env.JWT_SECRET ||
        'localhands-development-secret',
      {
        expiresIn: '7d',
      }
    );

    // ------------------------------------------
    // LOGIN SUCCESS
    // ------------------------------------------

    return res.status(200).json({
      success: true,
      registration: false,
      message: 'Login successful',
      token,

      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
      },
    });

  } catch (error) {
    console.error(
      'Customer login error:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Unable to complete customer login',
    });
  }
};


// ======================================================
// CUSTOMER REGISTRATION
// ======================================================

const registerCustomer = async (req, res) => {
  try {
    const {
      access_token,
      name,
    } = req.body;

    // ------------------------------------------
    // VALIDATION
    // ------------------------------------------

    if (!access_token) {
      return res.status(400).json({
        success: false,
        message: 'MSG91 access token is required',
      });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Name is required',
      });
    }

    // ------------------------------------------
    // VERIFY MSG91 TOKEN
    // ------------------------------------------

    const msg91Result =
      await verifyMSG91AccessTokenForCustomer(
        access_token
      );

    console.log(
      'MSG91 CUSTOMER REGISTRATION VERIFIED RESULT:',
      msg91Result
    );

    // ------------------------------------------
    // GET VERIFIED PHONE
    // ------------------------------------------

    const phone =
      msg91Result?.data?.mobile ||
      msg91Result?.data?.phone ||
      msg91Result?.mobile ||
      msg91Result?.phone;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message:
          'Unable to get verified mobile number from MSG91',
      });
    }

    const cleanPhone = phone
      .toString()
      .replace(/^\+91/, '')
      .replace(/^91(?=\d{10}$)/, '');

    if (!/^\d{10}$/.test(cleanPhone)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid mobile number returned by MSG91',
      });
    }

    // ------------------------------------------
    // DOUBLE-CHECK CUSTOMER
    // ------------------------------------------

    const existingResult = await pool.query(
      `
      SELECT
        id,
        name,
        phone,
        role,
        is_active
      FROM users
      WHERE phone = $1
      `,
      [cleanPhone]
    );

    if (existingResult.rows.length > 0) {
      const existingUser = existingResult.rows[0];

      if (existingUser.role === 'customer') {
        return res.status(409).json({
          success: false,
          message:
            'This mobile number is already registered. Please login.',
        });
      }

      return res.status(409).json({
        success: false,
        message:
          `This mobile number is registered as ${existingUser.role}`,
      });
    }

    // ------------------------------------------
    // CREATE CUSTOMER
    // ------------------------------------------

    const userResult = await pool.query(
      `
      INSERT INTO users
      (
        name,
        phone,
        role,
        is_active
      )
      VALUES
      (
        $1,
        $2,
        'customer',
        TRUE
      )
      RETURNING
        id,
        name,
        phone,
        email,
        role,
        is_active
      `,
      [
        name.trim(),
        cleanPhone,
      ]
    );

    const user = userResult.rows[0];

    // ------------------------------------------
    // CREATE LOCALHANDS JWT
    // ------------------------------------------

    const token = jwt.sign(
      {
        userId: user.id,
        role: 'customer',
      },
      process.env.JWT_SECRET ||
        'localhands-development-secret',
      {
        expiresIn: '7d',
      }
    );

    // ------------------------------------------
    // REGISTRATION SUCCESS
    // ------------------------------------------

    return res.status(201).json({
      success: true,
      registration: true,
      message: 'Registration successful',
      token,

      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
      },
    });

  } catch (error) {
    console.error(
      'Customer registration error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Unable to complete customer registration',
    });
  }
};
// ======================================================
// SEND OTP
// ======================================================
const sendOtp = async (req, res) => {
  try {
    const {
      phone,
      role,
      name,
      is_registration,
      service_id
    } = req.body;

    // ------------------------------------------
    // VALIDATION
    // ------------------------------------------

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Phone number must be 10 digits'
      });
    }

    if (!role || !['customer', 'worker', 'admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Valid role is required'
      });
    }

    // New registration requires name
    if (
      !name &&
      role !== 'admin'
    ) {
      // We only require name when the phone number
      // does not already belong to a user.
    }

    // ------------------------------------------
    // CHECK EXISTING USER
    // ------------------------------------------

    const userResult = await pool.query(
      `
      SELECT
        id,
        name,
        phone,
        email,
        role,
        is_active
      FROM users
      WHERE phone = $1
      `,
      [phone]
    );

    let user = null;
    let isNewRegistration = false;


    // ==================================================
    // CHECK NEW / EXISTING USER
    // ==================================================

    if (userResult.rows.length === 0) {

      // Admin cannot self-register
      if (role === 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Admin account not found'
        });
      }

      // --------------------------------------------------
      // CUSTOMER LOGIN
      // --------------------------------------------------

      if (role === 'customer' && is_registration !== true) {
        return res.status(404).json({
          success: false,
          message: 'Customer not found. Please register first.'
        });
      }

      // --------------------------------------------------
      // WORKER LOGIN
      // --------------------------------------------------

      if (role === 'worker' && is_registration !== true) {
        return res.status(404).json({
          success: false,
          message: 'Worker not found. Please register first.'
        });
      }

      // --------------------------------------------------
      // WORKER REGISTRATION
      // --------------------------------------------------

      if (role === 'worker' && is_registration === true) {
        if (!service_id) {
          return res.status(400).json({
            success: false,
            message: 'Service is required for worker registration'
          });
        }

        const serviceResult = await pool.query(
          `
          SELECT id
          FROM services
          WHERE id = $1
            AND is_active = TRUE
          `,
          [service_id]
        );

        if (serviceResult.rows.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'Invalid service selected'
          });
        }
      }


      // --------------------------------------------------
      // CUSTOMER REGISTRATION
      // Name is required
      // --------------------------------------------------

      if (role === 'customer') {

        if (!name || !name.trim()) {
          return res.status(400).json({
            success: false,
            message: 'Name is required for customer registration'
          });
        }
      }

      isNewRegistration = true;



    } else {

      // ==================================================
      // EXISTING USER
      // ==================================================

      user = userResult.rows[0];

      // --------------------------------------------------
      // ACCOUNT ACTIVE CHECK
      // --------------------------------------------------

      if (!user.is_active) {
        return res.status(403).json({
          success: false,
          message: 'User account is inactive'
        });
      }

      // --------------------------------------------------
      // ROLE CHECK
      // --------------------------------------------------

      if (user.role !== role) {

        if (role === 'worker') {
          return res.status(403).json({
            success: false,
            message: 'This mobile number is not registered as a worker'
          });
        }

        if (role === 'customer') {
          return res.status(403).json({
            success: false,
            message: 'This mobile number is not registered as a customer'
          });
        }

        return res.status(403).json({
          success: false,
          message: 'Invalid user role'
        });
      }
    }


    // ==================================================
    // DEVELOPMENT OTP
    // ==================================================

    const otp = '123456';

    otpStore.set(phone, {
      otp,
      userId: user ? user.id : null,
      role,
      name: name ? name.trim() : null,
      serviceId: service_id ? Number(service_id) : null,
      isNewRegistration,
      expiresAt: Date.now() + 5 * 60 * 1000
    });

    // ------------------------------------------
    // DEVELOPMENT LOG
    // ------------------------------------------

    console.log('================================');
    console.log('LOCALHANDS OTP');
    console.log(`Phone: ${phone}`);
    console.log(`Role: ${role}`);
    console.log(`New Registration: ${isNewRegistration}`);
    console.log(`OTP: ${otp}`);
    console.log('================================');

    return res.status(200).json({
      success: true,
      message: isNewRegistration
        ? 'OTP sent for registration'
        : 'OTP sent successfully',

      // Development only
      dev_otp: otp
    });

  } catch (error) {

    console.error('Send OTP error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to send OTP'
    });
  }
};


// ======================================================
// VERIFY OTP
// ======================================================
const verifyOtp = async (req, res) => {

  const client = await pool.connect();

  try {

    const { phone, otp, role } = req.body;

    // ------------------------------------------
    // VALIDATION
    // ------------------------------------------

    if (!phone || !otp || !role) {
      return res.status(400).json({
        success: false,
        message: 'Phone, OTP and role are required'
      });
    }

    // ------------------------------------------
    // GET STORED OTP
    // ------------------------------------------

    const storedOtp = otpStore.get(phone);

    if (!storedOtp) {
      return res.status(400).json({
        success: false,
        message: 'OTP not found or expired'
      });
    }

    // ------------------------------------------
    // CHECK EXPIRY
    // ------------------------------------------

    if (storedOtp.expiresAt < Date.now()) {

      otpStore.delete(phone);

      return res.status(400).json({
        success: false,
        message: 'OTP has expired'
      });
    }

    // ------------------------------------------
    // CHECK OTP
    // ------------------------------------------

    if (storedOtp.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP'
      });
    }

    // ------------------------------------------
    // CHECK ROLE
    // ------------------------------------------

    if (storedOtp.role !== role) {

      otpStore.delete(phone);

      return res.status(400).json({
        success: false,
        message: 'Invalid login role'
      });
    }

    let user = null;
    let workerId = null;

    // ==================================================
    // NEW REGISTRATION
    // ==================================================

    if (storedOtp.isNewRegistration === true) {

      // ------------------------------------------
      // Start transaction
      // ------------------------------------------

      await client.query('BEGIN');

      // ------------------------------------------
      // Double-check phone number
      // ------------------------------------------

      const existingCheck = await client.query(
        `
        SELECT
          id,
          name,
          phone,
          email,
          role,
          is_active
        FROM users
        WHERE phone = $1
        `,
        [phone]
      );

      if (existingCheck.rows.length > 0) {

        await client.query('ROLLBACK');

        otpStore.delete(phone);

        return res.status(409).json({
          success: false,
          message: 'This phone number is already registered'
        });
      }

      // ==================================================
      // CREATE CUSTOMER
      // ==================================================

      if (role === 'customer') {

        const userResult = await client.query(
          `
          INSERT INTO users
          (
            name,
            phone,
            role,
            is_active
          )
          VALUES
          (
            $1,
            $2,
            'customer',
            TRUE
          )
          RETURNING
            id,
            name,
            phone,
            email,
            role,
            is_active
          `,
          [
            storedOtp.name,
            phone
          ]
        );

        user = userResult.rows[0];
      }

      // ==================================================
      // CREATE WORKER
      // ==================================================

      if (role === 'worker') {

        const userResult = await client.query(
          `
          INSERT INTO users
          (
            name,
            phone,
            role,
            is_active
          )
          VALUES
          (
            $1,
            $2,
            'worker',
            TRUE
          )
          RETURNING
            id,
            name,
            phone,
            email,
            role,
            is_active
          `,
          [
            storedOtp.name,
            phone
          ]
        );

        user = userResult.rows[0];

        // ------------------------------------------
        // Create worker profile
        // ------------------------------------------

        const workerResult = await client.query(
          `
          INSERT INTO workers
          (
            user_id,
            experience_years,
            rating,
            total_jobs,
            is_verified,
            is_available
          )
          VALUES
          (
            $1,
            0,
            0,
            0,
            FALSE,
            FALSE
          )
          RETURNING id
          `,
          [user.id]
        );

        workerId = workerResult.rows[0].id;
      }


      await client.query(
        `
        INSERT INTO worker_services
        (
          worker_id,
          service_id
        )
        VALUES
        (
          $1,
          $2
        )
        `,
        [
          workerId,
          storedOtp.serviceId
        ]
      );
      // ------------------------------------------
      // Commit
      // ------------------------------------------

      await client.query('COMMIT');

      // OTP used
      otpStore.delete(phone);

      // ==================================================
      // NEW CUSTOMER
      // ==================================================

      if (role === 'customer') {

        const token = jwt.sign(
          {
            userId: user.id,
            role: user.role
          },
          process.env.JWT_SECRET ||
            'localhands-development-secret',
          {
            expiresIn: '7d'
          }
        );

        return res.status(201).json({
          success: true,
          registration: true,
          message: 'Account created successfully',
          token,

          user: {
            id: user.id,
            name: user.name,
            phone: user.phone,
            email: user.email,
            role: user.role,
            worker_id: null
          }
        });
      }

      // ==================================================
      // NEW WORKER
      // ==================================================

      if (role === 'worker') {

        return res.status(201).json({
          success: true,
          registration: true,
          pending_verification: true,
          message:
            'Registration successful. Your account is pending admin verification.',

          user: {
            id: user.id,
            name: user.name,
            phone: user.phone,
            email: user.email,
            role: user.role,
            worker_id: workerId
          }
        });
      }
    }

    // ==================================================
    // EXISTING USER LOGIN
    // ==================================================

    if (!user) {

      const userResult = await client.query(
        `
        SELECT
          id,
          name,
          phone,
          email,
          role,
          is_active
        FROM users
        WHERE phone = $1
        `,
        [phone]
      );

      if (userResult.rows.length === 0) {

        otpStore.delete(phone);

        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      user = userResult.rows[0];
    }

    // ------------------------------------------
    // ACTIVE CHECK
    // ------------------------------------------

    if (!user.is_active) {

      otpStore.delete(phone);

      return res.status(403).json({
        success: false,
        message: 'User account is inactive'
      });
    }

    // ------------------------------------------
    // ROLE CHECK
    // ------------------------------------------

    if (user.role !== role) {

      otpStore.delete(phone);

      return res.status(403).json({
        success: false,
        message: 'Invalid user role'
      });
    }

    // ==================================================
    // WORKER LOGIN
    // ==================================================

    if (role === 'worker') {

      const workerResult = await client.query(
        `
        SELECT
          id,
          is_verified
        FROM workers
        WHERE user_id = $1
        `,
        [user.id]
      );

      if (workerResult.rows.length === 0) {

        otpStore.delete(phone);

        return res.status(404).json({
          success: false,
          message: 'Worker profile not found'
        });
      }

      workerId = workerResult.rows[0].id;

      // ------------------------------------------
      // ADMIN APPROVAL REQUIRED
      // ------------------------------------------

      if (workerResult.rows[0].is_verified !== true) {

        otpStore.delete(phone);

        return res.status(403).json({
          success: false,
          pending_verification: true,
          message:
            'Your worker registration is pending admin verification'
        });
      }
    }

    // ==================================================
    // CREATE JWT
    // ==================================================

    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role
      },
      process.env.JWT_SECRET ||
        'localhands-development-secret',
      {
        expiresIn: '7d'
      }
    );

    // OTP can only be used once
    otpStore.delete(phone);

    // ==================================================
    // LOGIN SUCCESS
    // ==================================================

    return res.status(200).json({
      success: true,
      registration: false,
      message: 'Login successful',

      token,

      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        worker_id: workerId
      }
    });

  } catch (error) {

    try {
      await client.query('ROLLBACK');
    } catch (_) {
      // Ignore rollback error
    }

    console.error('Verify OTP error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to verify OTP'
    });

  } finally {

    client.release();
  }
};


// ======================================================
// LEGACY WORKER REGISTRATION
// ======================================================
// Kept temporarily so existing routes do not break.
// New Worker App registration will NOT use this endpoint.
// ======================================================

const registerWorker = async (req, res) => {

  return res.status(410).json({
    success: false,
    message:
      'This registration method is no longer used. Please register using name, mobile number and OTP.'
  });
};

// ============================================================
// WORKER MSG91 LOGIN
// ============================================================

const msg91WorkerLogin = async (req, res) => {
  try {
    const { access_token, phone } = req.body;

    if (!access_token) {
      return res.status(400).json({
        success: false,
        message: 'MSG91 access token is required'
      });
    }

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    // Verify OTP verification token with MSG91
    const msg91Result =
      await verifyMSG91AccessToken(access_token);

    console.log(
      'WORKER MSG91 VERIFIED TOKEN:',
      msg91Result
    );

    // Prefer phone returned by MSG91
    const verifiedPhone =
      msg91Result?.data?.mobile ||
      msg91Result?.data?.phone ||
      msg91Result?.mobile ||
      msg91Result?.phone ||
      phone;

    const normalizedPhone =
      verifiedPhone.toString().replace(/\D/g, '').slice(-10);

    if (!/^\d{10}$/.test(normalizedPhone)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verified mobile number'
      });
    }

    // Find user
    const userResult = await pool.query(
      `
      SELECT
        id,
        name,
        phone,
        email,
        role,
        is_active
      FROM users
      WHERE phone = $1
      LIMIT 1
      `,
      [normalizedPhone]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Worker account not found. Please register first.'
      });
    }

    const user = userResult.rows[0];

    // Must be worker
    if (user.role !== 'worker') {
      return res.status(403).json({
        success: false,
        message: `This mobile number is registered as ${user.role}.`
      });
    }

    // Account active check
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Worker account is inactive.'
      });
    }

    // Get worker profile
    const workerResult = await pool.query(
      `
      SELECT
        id,
        user_id,
        is_verified,
        is_available,
        experience,
        rating,
        total_jobs
      FROM workers
      WHERE user_id = $1
      LIMIT 1
      `,
      [user.id]
    );

    if (workerResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Worker profile not found.'
      });
    }

    const worker = workerResult.rows[0];

    // Worker must be verified by admin
    if (!worker.is_verified) {
      return res.status(403).json({
        success: false,
        pending_verification: true,
        message:
          'Your worker account is pending admin verification.'
      });
    }

    // Create LocalHands JWT
    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role,
        workerId: worker.id
      },
      process.env.JWT_SECRET || 'localhands-development-secret',
      {
        expiresIn: '7d'
      }
    );

    return res.status(200).json({
      success: true,
      registration: false,
      message: 'Worker login successful',

      token,

      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        worker_id: worker.id
      }
    });

  } catch (error) {
    console.error(
      'MSG91 WORKER LOGIN ERROR:',
      error.response?.data || error.message
    );

    return res.status(500).json({
      success: false,
      message: 'Unable to complete worker login'
    });
  }
};


// ============================================================
// WORKER MSG91 REGISTRATION
// ============================================================

const msg91WorkerRegister = async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      access_token,
      phone,
      name,
      service_id
    } = req.body;

    if (!access_token) {
      return res.status(400).json({
        success: false,
        message: 'MSG91 access token is required'
      });
    }

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Worker name is required'
      });
    }

    if (!service_id) {
      return res.status(400).json({
        success: false,
        message: 'Service selection is required'
      });
    }

    // Verify OTP verification token with MSG91
    const msg91Result =
      await verifyMSG91AccessToken(access_token);

    console.log(
      'WORKER REGISTRATION MSG91 VERIFIED TOKEN:',
      msg91Result
    );

    // Prefer verified phone returned by MSG91
    const verifiedPhone =
      msg91Result?.data?.mobile ||
      msg91Result?.data?.phone ||
      msg91Result?.mobile ||
      msg91Result?.phone ||
      phone;

    const normalizedPhone =
      verifiedPhone.toString().replace(/\D/g, '').slice(-10);

    if (!/^\d{10}$/.test(normalizedPhone)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verified mobile number'
      });
    }

    // Check service
    const serviceResult = await client.query(
      `
      SELECT id, name
      FROM services
      WHERE id = $1
        AND is_active = true
      LIMIT 1
      `,
      [Number(service_id)]
    );

    if (serviceResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Selected service is invalid'
      });
    }

    // Check duplicate mobile
    const existingUser = await client.query(
      `
      SELECT id, role
      FROM users
      WHERE phone = $1
      LIMIT 1
      `,
      [normalizedPhone]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message:
          'This mobile number is already registered.'
      });
    }

    await client.query('BEGIN');

    // Create user
    const userResult = await client.query(
      `
      INSERT INTO users (
        name,
        phone,
        role,
        is_active
      )
      VALUES ($1, $2, 'worker', true)
      RETURNING id, name, phone, role, is_active
      `,
      [
        name.trim(),
        normalizedPhone
      ]
    );

    const user = userResult.rows[0];

    // Create worker profile
    const workerResult = await client.query(
      `
      INSERT INTO workers (
        user_id,
        is_verified,
        is_available,
        experience,
        rating,
        total_jobs
      )
      VALUES (
        $1,
        false,
        false,
        0,
        0,
        0
      )
      RETURNING id, user_id, is_verified
      `,
      [user.id]
    );

    const worker = workerResult.rows[0];

    // Assign selected service
    await client.query(
      `
      INSERT INTO worker_services (
        worker_id,
        service_id
      )
      VALUES ($1, $2)
      `,
      [
        worker.id,
        Number(service_id)
      ]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      registration: true,
      pending_verification: true,
      message:
        'Worker registration successful. Your account is pending admin verification.',

      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        worker_id: worker.id
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');

    console.error(
      'MSG91 WORKER REGISTRATION ERROR:',
      error.response?.data || error.message
    );

    return res.status(500).json({
      success: false,
      message: 'Unable to complete worker registration'
    });

  } finally {
    client.release();
  }
};




// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  sendOtp,
  verifyOtp,
  registerWorker,

  msg91Login,

  msg91WorkerLogin,
  msg91WorkerRegister,

  checkCustomer,
  loginCustomer,
  registerCustomer,
};