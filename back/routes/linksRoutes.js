const express = require('express');
const router = express.Router();
const pool = require('../db');

// =========================
// LISTAR TODOS
// =========================
router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM links ORDER BY id DESC'
        );
        res.json(rows);
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
