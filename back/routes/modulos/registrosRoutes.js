const express = require('express');
const router = express.Router();
const service = require('../../services/modulosService');

// Criar registro
router.post('/:moduloId/registros', async (req, res) => {
  try {
    const { moduloId } = req.params;
    const { valores } = req.body;

    const result = await service.createRegistro(moduloId, valores);
    res.json(result);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Listar registros (pivotado)
router.get('/:moduloId/registros', async (req, res) => {
  try {
    const rows = await service.listRegistros(req.params.moduloId);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar registros' });
  }
});

// Atualizar registro
router.put('/:moduloId/registros/:registroId', async (req, res) => {
  try {
    const { moduloId, registroId } = req.params;
    const { valores } = req.body;

    const result = await service.updateRegistro(moduloId, registroId, valores);
    if (!result.updated) return res.status(404).json({ error: 'Registro não encontrado' });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Excluir registro
router.delete('/:moduloId/registros/:registroId', async (req, res) => {
  try {
    const { moduloId, registroId } = req.params;

    const result = await service.deleteRegistro(moduloId, registroId);
    if (!result.deleted) return res.status(404).json({ error: 'Registro não encontrado' });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao excluir registro' });
  }
});

module.exports = router;
