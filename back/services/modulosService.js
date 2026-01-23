const pool = require('../db');

// ============================
// MÓDULOS
// ============================
exports.createModulo = async (nome, descricao) => {
  const slug = nome.toLowerCase().replace(/\s+/g, '_');

  try {
    const [result] = await pool.query(
      'INSERT INTO modulos (nome, slug, descricao) VALUES (?, ?, ?)',
      [nome, slug, descricao || null]
    );

    return { id: result.insertId, nome, slug, descricao: descricao || null };
  } catch (err) {
    if (err.code !== 'ER_BAD_FIELD_ERROR') {
      throw err;
    }

    const [result] = await pool.query(
      'INSERT INTO modulos (nome, slug) VALUES (?, ?)',
      [nome, slug]
    );

    return { id: result.insertId, nome, slug, descricao: null };
  }
};

exports.listModulos = async () => {
  const [rows] = await pool.query('SELECT * FROM modulos ORDER BY id');
  return rows;
};

exports.updateModulo = async (moduloId, nome, descricao) => {
  const slug = nome.toLowerCase().replace(/\s+/g, '_');

  try {
    const [result] = await pool.query(
      'UPDATE modulos SET nome = ?, slug = ?, descricao = ? WHERE id = ?',
      [nome, slug, descricao || null, moduloId]
    );

    return { updated: result.affectedRows > 0, modulo: { id: moduloId, nome, slug, descricao: descricao || null } };
  } catch (err) {
    if (err.code !== 'ER_BAD_FIELD_ERROR') {
      throw err;
    }

    const [result] = await pool.query(
      'UPDATE modulos SET nome = ?, slug = ? WHERE id = ?',
      [nome, slug, moduloId]
    );

    return { updated: result.affectedRows > 0, modulo: { id: moduloId, nome, slug, descricao: null } };
  }
};

exports.deleteModulo = async (moduloId) => {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    await conn.query(
      `DELETE v
       FROM modulo_valores v
       JOIN modulo_registros r ON v.registro_id = r.id
       WHERE r.modulo_id = ?`,
      [moduloId]
    );

    await conn.query('DELETE FROM modulo_registros WHERE modulo_id = ?', [moduloId]);
    await conn.query('DELETE FROM modulo_campos WHERE modulo_id = ?', [moduloId]);
    const [result] = await conn.query('DELETE FROM modulos WHERE id = ?', [moduloId]);

    await conn.commit();
    return { deleted: result.affectedRows > 0 };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

// ============================
// CAMPOS
// ============================
exports.createCampo = async (moduloId, nome, tipo, obrigatorio, ordem) => {
  const [result] = await pool.query(
    `INSERT INTO modulo_campos
     (modulo_id, nome, tipo, obrigatorio, ordem)
     VALUES (?, ?, ?, ?, ?)`,
    [moduloId, nome, tipo, !!obrigatorio, ordem || 0]
  );

  return { id: result.insertId, nome, tipo };
};

exports.listCampos = async (moduloId) => {
  const [rows] = await pool.query(
    'SELECT * FROM modulo_campos WHERE modulo_id = ? ORDER BY ordem',
    [moduloId]
  );
  return rows;
};

// ============================
// REGISTROS
// ============================
exports.createRegistro = async (moduloId, valores) => {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [reg] = await conn.query(
      'INSERT INTO modulo_registros (modulo_id) VALUES (?)',
      [moduloId]
    );

    const registroId = reg.insertId;

    const [campos] = await conn.query(
      'SELECT id, nome, obrigatorio FROM modulo_campos WHERE modulo_id = ?',
      [moduloId]
    );

    for (const campo of campos) {
      if (campo.obrigatorio && !valores[campo.nome]) {
        throw new Error(`Campo obrigatório: ${campo.nome}`);
      }

      await conn.query(
        `INSERT INTO modulo_valores
         (registro_id, campo_id, valor)
         VALUES (?, ?, ?)`,
        [registroId, campo.id, valores[campo.nome] || null]
      );
    }

    await conn.commit();
    return { success: true, registroId };

  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

// ============================
// LISTAR REGISTROS (PIVOT)
// ============================
exports.listRegistros = async (moduloId) => {
  const [rows] = await pool.query(
    `
    SELECT r.id, c.nome, v.valor
    FROM modulo_registros r
    JOIN modulo_valores v ON v.registro_id = r.id
    JOIN modulo_campos c ON c.id = v.campo_id
    WHERE r.modulo_id = ?
    `,
    [moduloId]
  );

  const map = {};

  rows.forEach(r => {
    if (!map[r.id]) map[r.id] = { id: r.id };
    map[r.id][r.nome] = r.valor;
  });

  return Object.values(map);
};

exports.updateRegistro = async (moduloId, registroId, valores) => {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [registros] = await conn.query(
      'SELECT id FROM modulo_registros WHERE id = ? AND modulo_id = ?',
      [registroId, moduloId]
    );

    if (!registros.length) {
      await conn.rollback();
      return { updated: false };
    }

    const [campos] = await conn.query(
      'SELECT id, nome, obrigatorio FROM modulo_campos WHERE modulo_id = ?',
      [moduloId]
    );

    for (const campo of campos) {
      if (campo.obrigatorio && !valores[campo.nome]) {
        throw new Error(`Campo obrigatório: ${campo.nome}`);
      }

      const valor = valores[campo.nome] ?? null;
      const [result] = await conn.query(
        `UPDATE modulo_valores
         SET valor = ?
         WHERE registro_id = ? AND campo_id = ?`,
        [valor, registroId, campo.id]
      );

      if (result.affectedRows === 0) {
        await conn.query(
          `INSERT INTO modulo_valores (registro_id, campo_id, valor)
           VALUES (?, ?, ?)`,
          [registroId, campo.id, valor]
        );
      }
    }

    await conn.commit();
    return { updated: true };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

exports.deleteRegistro = async (moduloId, registroId) => {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [registros] = await conn.query(
      'SELECT id FROM modulo_registros WHERE id = ? AND modulo_id = ?',
      [registroId, moduloId]
    );

    if (!registros.length) {
      await conn.rollback();
      return { deleted: false };
    }

    await conn.query('DELETE FROM modulo_valores WHERE registro_id = ?', [registroId]);
    await conn.query(
      'DELETE FROM modulo_registros WHERE id = ? AND modulo_id = ?',
      [registroId, moduloId]
    );

    await conn.commit();
    return { deleted: true };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};
