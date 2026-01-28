const express = require('express');
const router = express.Router();
const pool = require('../db');

const VALID_TAB_TYPES = new Set(['inventario', 'maquinas']);

function getTabType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return VALID_TAB_TYPES.has(normalized) ? normalized : null;
}

router.get('/system/manual-tab-config', async (req, res) => {
  try {
    const tabType = getTabType(req.query.tabType);
    if (!tabType) {
      return res.status(400).json({ error: 'tabType inválido.' });
    }
    const [rows] = await pool.query(
      'SELECT config_json FROM system_manual_tab_config WHERE tab_type = ? LIMIT 1',
      [tabType]
    );
    const config = rows[0]?.config_json ? JSON.parse(rows[0].config_json) : null;
    return res.json({ config });
  } catch (err) {
    console.error('Erro GET /system/manual-tab-config:', err);
    return res.status(500).json({ error: 'Erro ao buscar configuração da aba.' });
  }
});

router.put('/system/manual-tab-config', async (req, res) => {
  try {
    const tabType = getTabType(req.query.tabType);
    if (!tabType) {
      return res.status(400).json({ error: 'tabType inválido.' });
    }
    const config = req.body?.config ?? null;
    if (!config) {
      await pool.query(
        'DELETE FROM system_manual_tab_config WHERE tab_type = ?',
        [tabType]
      );
      return res.json({ success: true });
    }
    const payload = JSON.stringify(config);
    await pool.query(
      `INSERT INTO system_manual_tab_config (tab_type, config_json)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE config_json = VALUES(config_json)`,
      [tabType, payload]
    );
    return res.json({ success: true });
  } catch (err) {
    console.error('Erro PUT /system/manual-tab-config:', err);
    return res.status(500).json({ error: 'Erro ao salvar configuração da aba.' });
  }
});

router.get('/system/module-preferences', async (req, res) => {
  try {
    const moduleId = Number(req.query.moduleId);
    if (!Number.isFinite(moduleId)) {
      return res.status(400).json({ error: 'moduleId inválido.' });
    }
    const [rows] = await pool.query(
      'SELECT sort_options_json, field_options_json FROM system_module_preferences WHERE module_id = ? LIMIT 1',
      [moduleId]
    );
    const sortOptions = rows[0]?.sort_options_json ? JSON.parse(rows[0].sort_options_json) : [];
    const fieldOptions = rows[0]?.field_options_json ? JSON.parse(rows[0].field_options_json) : {};
    return res.json({ sortOptions, fieldOptions });
  } catch (err) {
    console.error('Erro GET /system/module-preferences:', err);
    return res.status(500).json({ error: 'Erro ao buscar preferências do módulo.' });
  }
});

router.put('/system/module-preferences', async (req, res) => {
  try {
    const moduleId = Number(req.query.moduleId);
    if (!Number.isFinite(moduleId)) {
      return res.status(400).json({ error: 'moduleId inválido.' });
    }
    const sortOptions = Array.isArray(req.body?.sortOptions) ? req.body.sortOptions : [];
    const fieldOptions = req.body?.fieldOptions && typeof req.body.fieldOptions === 'object'
      ? req.body.fieldOptions
      : {};
    await pool.query(
      `INSERT INTO system_module_preferences (module_id, sort_options_json, field_options_json)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         sort_options_json = VALUES(sort_options_json),
         field_options_json = VALUES(field_options_json)`,
      [moduleId, JSON.stringify(sortOptions), JSON.stringify(fieldOptions)]
    );
    return res.json({ success: true });
  } catch (err) {
    console.error('Erro PUT /system/module-preferences:', err);
    return res.status(500).json({ error: 'Erro ao salvar preferências do módulo.' });
  }
});

module.exports = router;
