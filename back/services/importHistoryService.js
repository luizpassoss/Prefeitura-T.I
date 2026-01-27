const pool = require('../db');

function parsePayload(payload) {
  if (!payload) return null;
  try {
    return JSON.parse(payload);
  } catch (err) {
    return null;
  }
}

exports.listHistory = async (limit = 10) => {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 10;
  const [rows] = await pool.query(
    `SELECT id, import_type AS type, file_name AS file, user_name AS user,
            status, status_label AS statusLabel, error_count, success_count,
            module_id AS moduleId, created_at
     FROM import_history
     ORDER BY created_at DESC
     LIMIT ?`,
    [safeLimit]
  );
  return rows;
};

exports.getHistoryById = async (id) => {
  const [rows] = await pool.query(
    `SELECT id, import_type AS type, file_name AS file, user_name AS user,
            status, status_label AS statusLabel, error_count, success_count,
            module_id AS moduleId, payload, created_at
     FROM import_history
     WHERE id = ?`,
    [id]
  );
  if (!rows.length) return null;
  const entry = rows[0];
  return {
    ...entry,
    payload: parsePayload(entry.payload)
  };
};

exports.createHistory = async (entry = {}) => {
  const {
    type,
    file,
    user,
    status,
    statusLabel,
    errorCount,
    successCount,
    moduleId,
    payload
  } = entry;

  const payloadValue = payload ? JSON.stringify(payload) : null;
  const [result] = await pool.query(
    `INSERT INTO import_history
      (import_type, file_name, user_name, status, status_label, error_count, success_count, module_id, payload)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      type || 'inventario',
      file || 'Importação',
      user || 'Usuário atual',
      status || 'success',
      statusLabel || 'Concluída',
      Number.isFinite(errorCount) ? errorCount : 0,
      Number.isFinite(successCount) ? successCount : 0,
      moduleId || null,
      payloadValue
    ]
  );

  const [rows] = await pool.query(
    `SELECT id, import_type AS type, file_name AS file, user_name AS user,
            status, status_label AS statusLabel, error_count, success_count,
            module_id AS moduleId, created_at
     FROM import_history
     WHERE id = ?`,
    [result.insertId]
  );
  return rows[0];
};

exports.clearHistory = async () => {
  await pool.query('DELETE FROM import_history');
};
