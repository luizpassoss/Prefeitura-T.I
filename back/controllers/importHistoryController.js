const importHistoryService = require('../services/importHistoryService');

exports.listHistory = async (req, res) => {
  try {
    const limit = Number(req.query.limit || 10);
    const history = await importHistoryService.listHistory(limit);
    res.json(history);
  } catch (err) {
    console.error('Erro ao listar histórico de importações:', err);
    res.status(500).json({ error: 'Erro ao listar histórico.' });
  }
};

exports.getHistoryById = async (req, res) => {
  try {
    const entry = await importHistoryService.getHistoryById(Number(req.params.id));
    if (!entry) {
      return res.status(404).json({ error: 'Importação não encontrada.' });
    }
    res.json(entry);
  } catch (err) {
    console.error('Erro ao buscar histórico de importação:', err);
    res.status(500).json({ error: 'Erro ao buscar histórico.' });
  }
};

exports.createHistory = async (req, res) => {
  try {
    const entry = await importHistoryService.createHistory(req.body || {});
    res.status(201).json(entry);
  } catch (err) {
    console.error('Erro ao salvar histórico de importação:', err);
    res.status(500).json({ error: 'Erro ao salvar histórico.' });
  }
};

exports.clearHistory = async (_req, res) => {
  try {
    await importHistoryService.clearHistory();
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao limpar histórico de importações:', err);
    res.status(500).json({ error: 'Erro ao limpar histórico.' });
  }
};
