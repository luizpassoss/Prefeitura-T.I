const express = require('express');
const router = express.Router();
const pool = require('../db');

const VALID_TAB_TYPES = new Set(['inventario', 'maquinas']);

function getTabType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return VALID_TAB_TYPES.has(normalized) ? normalized : null;
}

router.get('/manual-custom-fields', async (req, res) => {
  try {
    const tabType = getTabType(req.query.tabType);
    if (!tabType) {
      return res.status(400).json({ error: 'tabType inválido.' });
    }
    const [rows] = await pool.query(
      'SELECT field_key AS `key`, label FROM manual_custom_fields WHERE tab_type = ? ORDER BY id ASC',
      [tabType]
    );
    return res.json(rows);
  } catch (err) {
    console.error('Erro GET /manual-custom-fields:', err);
    return res.status(500).json({ error: 'Erro ao buscar campos personalizados.' });
  }
});

router.post('/manual-custom-fields', async (req, res) => {
  try {
    const tabType = getTabType(req.body.tabType);
    const key = String(req.body.key || '').trim();
    const label = String(req.body.label || '').trim();
    if (!tabType || !key || !label) {
      return res.status(400).json({ error: 'Dados inválidos.' });
    }
    await pool.query(
      'INSERT INTO manual_custom_fields (tab_type, field_key, label) VALUES (?, ?, ?)',
      [tabType, key, label]
    );
    return res.status(201).json({ key, label });
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Campo já existente.' });
    }
    console.error('Erro POST /manual-custom-fields:', err);
    return res.status(500).json({ error: 'Erro ao criar campo personalizado.' });
  }
});

router.delete('/manual-custom-fields', async (req, res) => {
  let connection;
  try {
    const tabType = getTabType(req.query.tabType);
    if (!tabType) {
      return res.status(400).json({ error: 'tabType inválido.' });
    }
    connection = await pool.getConnection();
    await connection.beginTransaction();
    await connection.query('DELETE FROM manual_custom_values WHERE tab_type = ?', [tabType]);
    await connection.query('DELETE FROM manual_custom_fields WHERE tab_type = ?', [tabType]);
    await connection.commit();
    return res.json({ success: true });
  } catch (err) {
    if (connection) {
      await connection.rollback();
    }
    console.error('Erro DELETE /manual-custom-fields:', err);
    return res.status(500).json({ error: 'Erro ao limpar campos personalizados.' });
  } finally {
    if (connection) connection.release();
  }
});

router.get('/manual-custom-values', async (req, res) => {
  try {
    const tabType = getTabType(req.query.tabType);
    if (!tabType) {
      return res.status(400).json({ error: 'tabType inválido.' });
    }
    const [rows] = await pool.query(
      'SELECT item_id, field_key, value FROM manual_custom_values WHERE tab_type = ?',
      [tabType]
    );
    const data = rows.reduce((acc, row) => {
      if (!acc[row.item_id]) {
        acc[row.item_id] = {};
      }
      acc[row.item_id][row.field_key] = row.value;
      return acc;
    }, {});
    return res.json({ data });
  } catch (err) {
    console.error('Erro GET /manual-custom-values:', err);
    return res.status(500).json({ error: 'Erro ao buscar valores personalizados.' });
  }
});

router.put('/manual-custom-values', async (req, res) => {
  let connection;
  try {
    const tabType = getTabType(req.query.tabType);
    const itemId = Number(req.query.itemId);
    const values = req.body?.values;
    if (!tabType || !Number.isFinite(itemId)) {
      return res.status(400).json({ error: 'Parâmetros inválidos.' });
    }
    if (!values || typeof values !== 'object') {
      return res.status(400).json({ error: 'Valores inválidos.' });
    }
    connection = await pool.getConnection();
    await connection.beginTransaction();
    await connection.query(
      'DELETE FROM manual_custom_values WHERE tab_type = ? AND item_id = ?',
      [tabType, itemId]
    );
    const entries = Object.entries(values)
      .map(([fieldKey, value]) => [tabType, itemId, fieldKey, String(value || '').trim()])
      .filter(([, , , value]) => value);
    if (entries.length) {
      await connection.query(
        'INSERT INTO manual_custom_values (tab_type, item_id, field_key, value) VALUES ?',
        [entries]
      );
    }
    await connection.commit();
    return res.json({ success: true });
  } catch (err) {
    if (connection) {
      await connection.rollback();
    }
    console.error('Erro PUT /manual-custom-values:', err);
    return res.status(500).json({ error: 'Erro ao salvar valores personalizados.' });
  } finally {
    if (connection) connection.release();
  }
});

router.delete('/manual-custom-values', async (req, res) => {
  try {
    const tabType = getTabType(req.query.tabType);
    const itemId = Number(req.query.itemId);
    if (!tabType || !Number.isFinite(itemId)) {
      return res.status(400).json({ error: 'Parâmetros inválidos.' });
    }
    await pool.query(
      'DELETE FROM manual_custom_values WHERE tab_type = ? AND item_id = ?',
      [tabType, itemId]
    );
    return res.json({ success: true });
  } catch (err) {
    console.error('Erro DELETE /manual-custom-values:', err);
    return res.status(500).json({ error: 'Erro ao remover valores personalizados.' });
  }
});

module.exports = router;
