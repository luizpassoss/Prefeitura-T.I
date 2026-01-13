const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');

// Conexão com o banco
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '', // ajuste se tiver senha
  database: 'inventario',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// =============================
// LISTAR TODAS AS MÁQUINAS
// =============================
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT * FROM maquinas 
      ORDER BY id DESC
    `);

    res.json(rows);
  } catch (err) {
    console.error('Erro ao listar máquinas:', err);
    res.status(500).json({ error: 'Erro ao buscar máquinas' });
  }
});


// =============================
// CRIAR NOVA MÁQUINA
// =============================
router.post('/', async (req, res) => {
  try {
    const { nome_maquina, patrimonio, local, descricao, status = 'Ativa'} = req.body;

    if (!nome_maquina) {
      return res.status(400).json({ error: "Campos obrigatórios faltando." });
    }

    const [result] = await pool.query(
      `INSERT INTO maquinas (nome_maquina, patrimonio, local, descricao, status)
       VALUES (?, ?, ?, ?, ?)`,
      [nome_maquina, patrimonio || '', local || '', descricao || '', status || '']
    );

    const [newRecord] = await pool.query(
      `SELECT * FROM maquinas WHERE id = ?`,
      [result.insertId]
    );

    res.json(newRecord[0]);

  } catch (err) {
    console.error('Erro ao criar máquina:', err);
    res.status(500).json({ error: 'Erro ao criar máquina' });
  }
});



// =============================
// EDITAR MÁQUINA
// =============================
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nome_maquina, patrimonio, local, descricao, status } = req.body;

    await pool.query(
      `UPDATE maquinas 
       SET  nome_maquina=?, patrimonio=?, local=?, descricao=?, status=?
       WHERE id=?`,
      [nome_maquina, patrimonio || '', local || '', descricao || '', status || '', id]
    );

    const [updatedRecord] = await pool.query(`SELECT * FROM maquinas WHERE id = ?`, [id]);

    res.json(updatedRecord[0]);

  } catch (err) {
    console.error('Erro ao atualizar máquina:', err);
    res.status(500).json({ error: 'Erro ao atualizar máquina' });
  }
});


// =============================
// DELETAR MÁQUINA
// =============================
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(`DELETE FROM maquinas WHERE id=?`, [id]);

    res.json({ success: true });

  } catch (err) {
    console.error('Erro ao remover máquina:', err);
    res.status(500).json({ error: 'Erro ao remover máquina' });
  }
});

module.exports = router;
