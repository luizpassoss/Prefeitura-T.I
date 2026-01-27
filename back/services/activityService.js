const pool = require('../db');

exports.listRecentActions = async (limit = 6) => {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 6;
  const [rows] = await pool.query(
    `SELECT id, message, tag, user_name AS user, created_at
     FROM recent_actions
     ORDER BY created_at DESC
     LIMIT ?`,
    [safeLimit]
  );
  return rows;
};

exports.createRecentAction = async ({ message, tag, user }) => {
  const [result] = await pool.query(
    `INSERT INTO recent_actions (message, tag, user_name)
     VALUES (?, ?, ?)`,
    [message, tag || 'Ação', user || 'Usuário atual']
  );
  const [rows] = await pool.query(
    `SELECT id, message, tag, user_name AS user, created_at
     FROM recent_actions
     WHERE id = ?`,
    [result.insertId]
  );
  return rows[0];
};
