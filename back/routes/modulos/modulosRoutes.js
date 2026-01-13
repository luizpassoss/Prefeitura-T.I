const express = require('express');
const router = express.Router();
const modulosService = require('../../services/modulosService');

// Criar nova aba
router.post('/', async (req, res) => {
  try {
    const { nome, descricao } = req.body;
    if (!nome) return res.status(400).json({ error: 'Nome obrigatório' });

    const modulo = await modulosService.createModulo(nome, descricao);
    res.json(modulo);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar módulo' });
  }
});

// Listar abas
router.get('/', async (req, res) => {
  try {
    const modulos = await modulosService.listModulos();
    res.json(modulos);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar módulos' });
  }
});

// Excluir aba
router.delete('/:id', async (req, res) => {
  try {
    const moduloId = Number(req.params.id);
    if (!moduloId) return res.status(400).json({ error: 'ID inválido' });

    const result = await modulosService.deleteModulo(moduloId);
    if (!result.deleted) return res.status(404).json({ error: 'Módulo não encontrado' });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao excluir módulo' });
  }
});

module.exports = router;
