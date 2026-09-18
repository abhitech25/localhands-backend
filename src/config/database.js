//const { Pool } = require('pg');
//require('dotenv').config();


const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,

  ssl:
    process.env.DB_SSL === 'true'
      ? { rejectUnauthorized: false }
      : false,
});

module.exports = pool;

//const pool = new Pool({
//  host: process.env.DB_HOST,
//  port: process.env.DB_PORT,
//  database: process.env.DB_NAME,
//  user: process.env.DB_USER,
//  password: process.env.DB_PASSWORD,
//
//  // Neon PostgreSQL requires SSL
//  ssl: {
//    rejectUnauthorized: false,
//  },
//});

pool.on('connect', () => {
  console.log('PostgreSQL connected');
});

pool.on('error', (error) => {
  console.error('PostgreSQL error:', error);
});

module.exports = pool;