const pool = require('../db');
exports.importInventario = async (rows) => {
  const conn = await pool.getConnection();
  const errors = [];
  let inserted = 0;
  function normalizeInventarioRow(row) {
  return {
    link:
      row.link ||
      row['Link de Internet'] ||
      row['Link'] ||
      '',

    velocidade:
      row.velocidade ||
      row['Velocidade'] ||
      row['Velocidade (DL/UL)'] ||
      '',

    telefone:
      row.telefone ||
      row['Telefone'] ||
      '',

    local:
      row.local ||
      row['Local'] ||
      '',

    endereco:
      row.endereco ||
      row['Endereço'] ||
      row['Endereco'] ||
      '',

    categoria:
      row.categoria ||
      row['Categoria'] ||
      null
  };
}



  try {
    await conn.beginTransaction();

    // Buscar categorias válidas
    const [cats] = await conn.query(
      'SELECT nome FROM categorias'
    );
    const categoriasValidas = cats.map(c => c.nome.toLowerCase());

    const values = [];

   rows.forEach((row, index) => {
  const r = normalizeInventarioRow(row);
if (index === 0) {
  console.log('ROW ORIGINAL:', row);
  console.log('ROW NORMALIZADA:', r);
}

      const linha = index + 1;

      if (!r.link || !r.local) {
        errors.push({
          row: linha,
          field: 'link/local',
          message: 'Link e Local são obrigatórios'
        });
        return;
      }

      if (
        r.categoria &&
        !categoriasValidas.includes(r.categoria.toLowerCase())
      ) {
        r.categoria = null;
      }

      values.push([
        r.link.trim(),
        r.velocidade || '',
        r.telefone || '',
        r.local.trim(),
        r.endereco || '',
        r.categoria || null
      ]);
    });

    // Inserção em lote (chunk)
    const CHUNK_SIZE = 400;
    for (let i = 0; i < values.length; i += CHUNK_SIZE) {
      const chunk = values.slice(i, i + CHUNK_SIZE);

      const [result] = await conn.query(
        `INSERT INTO links 
         (link, velocidade, telefone, local, endereco, categoria)
         VALUES ?`,
        [chunk]
      );

      inserted += result.affectedRows;
    }

    await conn.commit();

    return {
      total: rows.length,
      inserted,
      errors
    };

  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};
exports.importMaquinas = async (rows) => {
  const conn = await pool.getConnection();
  const errors = [];
  let inserted = 0;
  function normalizeMaquinasRow(row) {
  return {
    nome_maquina:
      row.nome_maquina ||
      row['Nome Máquina'] ||
      row['Nome da Máquina'] ||
      row['Nome'] ||
      '',

    patrimonio:
      row.patrimonio ||
      row['Patrimônio'] ||
      row['Patrimonio'] ||
      '',

    local:
      row.local ||
      row['Local'] ||
      '',

    descricao:
      row.descricao ||
      row['Descrição'] ||
      row['Descricao'] ||
      '',

    status:
      row.status ||
      row['Status'] ||
      'Ativa'
  };
}

  try {
    await conn.beginTransaction();

    const values = [];

    rows.forEach((row, index) => {
  const r = normalizeMaquinasRow(row);

      const linha = index + 1;

      if (!r.nome_maquina || !r.local) {
        errors.push({
          row: linha,
          field: 'nome_maquina/local',
          message: 'Nome da máquina e Local são obrigatórios'
        });
        return;
      }

      values.push([
        r.nome_maquina.trim(),
        r.patrimonio || '',
        r.local.trim(),
        r.descricao || '',
        r.status || 'Ativa'
      ]);
    });

    const CHUNK_SIZE = 400;
    for (let i = 0; i < values.length; i += CHUNK_SIZE) {
      const chunk = values.slice(i, i + CHUNK_SIZE);

      const [result] = await conn.query(
        `INSERT INTO maquinas
         (nome_maquina, patrimonio, local, descricao, status)
         VALUES ?`,
        [chunk]
      );

      inserted += result.affectedRows;
    }

    await conn.commit();

    return {
      total: rows.length,
      inserted,
      errors
    };

  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};
