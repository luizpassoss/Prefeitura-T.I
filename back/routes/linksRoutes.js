const express = require('express');
const router = express.Router();
const pool = require('../db');

// =========================
// LISTAR TODOS
// =========================
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
            filters.push(`(link LIKE ? OR local LIKE ? OR endereco LIKE ? OR telefone LIKE ? OR velocidade LIKE ? OR categoria LIKE ?)`);
            params.push(like, like, like, like, like, like);
        }

        const categoria = (req.query.categoria || '').trim();
        if (categoria) {
            filters.push('categoria = ?');
            params.push(categoria);
        }

        const link = (req.query.link || '').trim();
        if (link) {
            filters.push('link LIKE ?');
            params.push(`%${link}%`);
        }

        const velocidade = (req.query.velocidade || '').trim();
        if (velocidade) {
            filters.push('velocidade LIKE ?');
            params.push(`%${velocidade}%`);
        }

        const telefone = (req.query.telefone || '').trim();
        if (telefone) {
            filters.push('telefone LIKE ?');
            params.push(`%${telefone}%`);
        }

        const local = (req.query.local || '').trim();
        if (local) {
            filters.push('local LIKE ?');
            params.push(`%${local}%`);
        }

        const endereco = (req.query.endereco || '').trim();
        if (endereco) {
            filters.push('endereco LIKE ?');
            params.push(`%${endereco}%`);
        }

        const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

        let orderBy = 'id DESC';
        switch (sortKey) {
            case 'link':
            case 'velocidade':
            case 'telefone':
            case 'local':
            case 'endereco':
            case 'categoria':
                orderBy = `${sortKey} ${sortDir}`;
                break;
            case 'issues':
                orderBy = `(
                    (CASE WHEN link IS NULL OR link = '' THEN 2 ELSE 0 END) +
                    (CASE WHEN telefone IS NULL OR telefone = '' THEN 2 ELSE 0 END) +
                    (CASE WHEN local IS NULL OR local = '' THEN 1 ELSE 0 END) +
                    (CASE WHEN endereco IS NULL OR endereco = '' THEN 1 ELSE 0 END) +
                    (CASE WHEN velocidade IS NULL OR velocidade = '' THEN 1 ELSE 0 END)
                ) ${sortDir}, id DESC`;
                break;
            case 'recent':
                orderBy = `id ${sortDir}`;
                break;
            default:
                orderBy = `id ${sortDir}`;
                break;
        }

        const [countRows] = await pool.query(
            `SELECT COUNT(*) as total FROM links ${whereClause}`,
            params
        );
        const total = countRows[0]?.total || 0;
        const offset = (page - 1) * pageSize;

        const [rows] = await pool.query(
            `SELECT * FROM links ${whereClause} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
            [...params, pageSize, offset]
        );

        res.json({
            data: rows,
            total,
            page,
            pageSize
        });
    } catch (err) {
        console.error("Erro GET /links:", err);
        res.status(500).json({ error: 'Erro ao buscar links' });
    }
});

// =========================
// BUSCAR POR ID
// =========================
router.get('/:id', async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM links WHERE id = ?',
            [req.params.id]
        );

        if (rows.length === 0)
            return res.status(404).json({ error: 'Link não encontrado' });

        res.json(rows[0]);
    } catch (err) {
        console.error("Erro GET /links/:id:", err);
        res.status(500).json({ error: 'Erro ao buscar link' });
    }
});

// =========================
// CRIAR LINK
// =========================
router.post('/', async (req, res) => {
    const { categoria, link, velocidade, telefone, local, endereco } = req.body;

    if (!categoria || !link || !local) {
        return res.status(400).json({ error: "Campos obrigatórios ausentes" });
    }

    try {
        const [result] = await pool.query(
            `INSERT INTO links (categoria, link, velocidade, telefone, local, endereco)
             VALUES (?,?,?,?,?,?)`,
            [categoria, link, velocidade, telefone, local, endereco]
        );

        const newItem = {
            id: result.insertId,
            categoria,
            link,
            velocidade,
            telefone,
            local,
            endereco
        };

        res.json(newItem);
    } catch (err) {
        console.error("Erro POST /links:", err);
        res.status(500).json({ error: 'Erro ao criar link' });
    }
});

// =========================
// ATUALIZAR LINK
// =========================
router.put('/:id', async (req, res) => {
    const { categoria, link, velocidade, telefone, local, endereco } = req.body;

    try {
        const [check] = await pool.query(
            'SELECT id FROM links WHERE id = ?',
            [req.params.id]
        );

        if (check.length === 0)
            return res.status(404).json({ error: 'Link não encontrado' });

        await pool.query(
            `UPDATE links
             SET categoria=?, link=?, velocidade=?, telefone=?, local=?, endereco=?
             WHERE id=?`,
            [categoria, link, velocidade, telefone, local, endereco, req.params.id]
        );

        res.json({
            id: req.params.id,
            categoria,
            link,
            velocidade,
            telefone,
            local,
            endereco
        });

    } catch (err) {
        console.error("Erro PUT /links/:id:", err);
        res.status(500).json({ error: 'Erro ao atualizar link' });
    }
});

// =========================
// DELETAR LINK
// =========================
router.delete('/:id', async (req, res) => {
    try {
        const [check] = await pool.query(
            'SELECT id FROM links WHERE id=?',
            [req.params.id]
        );

        if (check.length === 0)
            return res.status(404).json({ error: "Link não encontrado" });

        await pool.query(
            'DELETE FROM links WHERE id=?',
            [req.params.id]
        );

        res.json({ success: true });

    } catch (err) {
        console.error("Erro DELETE /links/:id:", err);
        res.status(500).json({ error: 'Erro ao deletar link' });
    }
});

module.exports = router;
