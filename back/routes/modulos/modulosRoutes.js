const express = require('express');
const router = express.Router();
const modulosService = require('../../services/modulosService');

// Criar nova aba
router.post('/', async (req, res) => {
  try {
    const { nome } = req.body;
    if (!nome) return res.status(400).json({ error: 'Nome obrigatório' });

    const modulo = await modulosService.createModulo(nome);
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

module.exports = router;
