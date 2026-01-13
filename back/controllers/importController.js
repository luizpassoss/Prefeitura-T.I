const importService = require('../services/importService');

exports.importInventario = async (req, res) => {
  try {
    const rows = req.body.rows;

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({
        error: 'Nenhum dado enviado para importação'
      });
    }

    const result = await importService.importInventario(rows);

    res.json(result);

  } catch (err) {
    console.error('Erro import inventário:', err);
    res.status(500).json({ error: 'Erro ao importar inventário' });
  }
};

exports.importMaquinas = async (req, res) => {
  try {
    const rows = req.body.rows;

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({
        error: 'Nenhum dado enviado para importação'
      });
    }

    const result = await importService.importMaquinas(rows);

    res.json(result);

  } catch (err) {
    console.error('Erro import máquinas:', err);
    res.status(500).json({ error: 'Erro ao importar máquinas' });
  }
};
