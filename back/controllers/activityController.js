const activityService = require('../services/activityService');

exports.listRecentActions = async (req, res) => {
  try {
    const limit = Number(req.query.limit || 6);
    const actions = await activityService.listRecentActions(limit);
    res.json(actions);
  } catch (err) {
    console.error('Erro ao listar ações recentes:', err);
    res.status(500).json({ error: 'Erro ao listar ações recentes.' });
  }
};

exports.createRecentAction = async (req, res) => {
  try {
    const { message, tag, user } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Mensagem obrigatória.' });
    }
    const created = await activityService.createRecentAction({
      message,
      tag,
      user
    });
    res.status(201).json(created);
  } catch (err) {
    console.error('Erro ao salvar ação recente:', err);
    res.status(500).json({ error: 'Erro ao salvar ação recente.' });
  }
};
