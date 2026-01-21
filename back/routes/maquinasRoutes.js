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
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const pageSizeRaw = parseInt(req.query.pageSize, 10) || 20;
    const pageSize = Math.min(Math.max(pageSizeRaw, 5), 200);
    const sortKey = (req.query.sortKey || '').toLowerCase();
    const sortDir = req.query.sortDir === 'asc' ? 'ASC' : 'DESC';

    const filters = [];
    const params = [];

    const q = (req.query.q || '').trim();
    if (q) {
      const like = `%${q}%`;
      filters.push(`(nome_maquina LIKE ? OR patrimonio LIKE ? OR local LIKE ? OR descricao LIKE ? OR status LIKE ?)`);
      params.push(like, like, like, like, like);
    }

    const status = (req.query.status || '').trim();
    if (status) {
      filters.push('status = ?');
      params.push(status);
    }

    const statusLike = (req.query.status_like || '').trim();
    if (statusLike) {
      filters.push('status LIKE ?');
      params.push(`%${statusLike}%`);
    }

    const nome_maquina = (req.query.nome_maquina || '').trim();
    if (nome_maquina) {
      filters.push('nome_maquina LIKE ?');
      params.push(`%${nome_maquina}%`);
    }

    const patrimonio = (req.query.patrimonio || '').trim();
    if (patrimonio) {
      filters.push('patrimonio LIKE ?');
      params.push(`%${patrimonio}%`);
    }

    const local = (req.query.local || '').trim();
    if (local) {
      filters.push('local LIKE ?');
      params.push(`%${local}%`);
    }

    const descricao = (req.query.descricao || '').trim();
    if (descricao) {
      filters.push('descricao LIKE ?');
      params.push(`%${descricao}%`);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    let orderBy = 'id DESC';
    switch (sortKey) {
      case 'nome_maquina':
      case 'patrimonio':
      case 'local':
      case 'status':
      case 'descricao':
        orderBy = `${sortKey} ${sortDir}`;
        break;
      case 'issues':
        orderBy = `(
          (CASE WHEN LOWER(status) = 'manutenção' THEN 3 WHEN LOWER(status) = 'inativa' THEN 2 ELSE 0 END) +
          (CASE WHEN patrimonio IS NULL OR patrimonio = '' THEN 2 ELSE 0 END) +
          (CASE WHEN descricao IS NULL OR descricao = '' THEN 1 ELSE 0 END) +
          (CASE WHEN local IS NULL OR local = '' THEN 1 ELSE 0 END)
        ) ${sortDir}, id DESC`;
        break;
      case 'status_priority':
        orderBy = `(CASE
          WHEN LOWER(status) = 'manutenção' THEN 0
          WHEN LOWER(status) = 'inativa' THEN 1
          WHEN LOWER(status) = 'ativa' THEN 2
          ELSE 3
        END) ${sortDir}, id DESC`;
        break;
      case 'recent':
        orderBy = `id ${sortDir}`;
        break;
      default:
        orderBy = `id ${sortDir}`;
        break;
    }

    const [countRows] = await pool.query(
      `SELECT COUNT(*) as total FROM maquinas ${whereClause}`,
      params
    );
    const total = countRows[0]?.total || 0;
    const offset = (page - 1) * pageSize;

    const [rows] = await pool.query(
      `SELECT * FROM maquinas ${whereClause} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    res.json({
      data: rows,
      total,
      page,
      pageSize
    });
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
