const express = require('express');
const router = express.Router();
const service = require('../../services/modulosService');

// Criar campo
router.post('/:moduloId/campos', async (req, res) => {
  try {
    const { moduloId } = req.params;
    const { nome, tipo, obrigatorio, ordem } = req.body;

    const campo = await service.createCampo(
      moduloId,
      nome,
      tipo,
      obrigatorio,
      ordem
    );

    res.json(campo);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar campo' });
  }
});

// Listar campos
router.get('/:moduloId/campos', async (req, res) => {
  try {
    const campos = await service.listCampos(req.params.moduloId);
    res.json(campos);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar campos' });
  }
});

module.exports = router;
