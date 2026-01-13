
document.addEventListener('DOMContentLoaded', async () => {
  document.querySelectorAll('.modal').forEach(m => {
  m.classList.remove('show');
});
let moduloAtualId = null;
let camposModuloAtual = [];

  let importType = null; // inventario | maquinas
  let importRows = [];
  let importHeaders = [];

/* ===========================
   MÓDULOS DINÂMICOS
   =========================== */
const API_MODULOS = '/api/modulos';

let modulos = [];
let moduloAtual = null;
let moduloCampos = [];
let moduloRegistros = [];

  /* ===========================
     CONFIG
     =========================== */
  const API_URL = 'https://pertinently-unpublished-soila.ngrok-free.dev/api/links';
  const API_MAQUINAS = 'https://pertinently-unpublished-soila.ngrok-free.dev/api/maquinas';

  /* ===========================
     ELEMENTOS GLOBAIS
     =========================== */
  // Inventário
  const tbody = document.getElementById('tbody');
  const pillsArea = document.getElementById('pillsArea');
  const modal = document.getElementById('modal');

  // Máquinas
  const mtbody = document.getElementById('mtbody');
  const machineModal = document.getElementById('machineModal');

  const btnNovaAba = document.getElementById('btnNovaAba');
  

if (btnNovaAba) {
  btnNovaAba.addEventListener('click', openCreateTabModal);
}


  /* ===========================
     ESTADOS
     =========================== */
  let data = [];
  let editIndex = -1;

  let machineData = [];
  let machineEditIndex = -1;
  /* ===========================
   SELEÇÃO (CHECKBOX)
   =========================== */
let selectedInvIds = new Set();
let selectedMaqIds = new Set();

function updateBulkUI() {
  const bulk = document.getElementById('bulkActions');
  const counter = document.getElementById('bulkCounter');

  const count = selectedInvIds.size + selectedMaqIds.size;

  if (count > 0) {
    counter.textContent = `${count} selecionado${count > 1 ? 's' : ''}`;
    bulk.classList.remove('hidden');
  } else {
    bulk.classList.add('hidden');
  }
}


  /* ===========================
     FETCH / INIT
     =========================== */
  async function fetchData(){
    try{
      const res = await fetch(API_URL);
      data = await res.json();
      applyFilters();
    } catch(err){
      console.error('Erro ao buscar links:', err);
      data = [];
      applyFilters();
    }
  }

  async function fetchMachines(){
    try{
      const res = await fetch(API_MAQUINAS);
      machineData = await res.json();
      applyMachineFilters();
    } catch(err){
      console.error('Erro ao buscar máquinas:', err);
      machineData = [];
      applyMachineFilters();
    }
  }

  /* ===========================
     UTIL
     =========================== */
  function escapeHtml(s){ return (s||'').toString().replaceAll('<','&lt;').replaceAll('>','&gt;'); }
  function showModal(el){ el.classList.add('show'); }
  function hideModal(el){ el.classList.remove('show'); }

  /* ===========================
     RENDER INVENTÁRIO
     =========================== */
  function renderTable(list){
    tbody.innerHTML = '';
    if(!list || list.length === 0){
      tbody.innerHTML = '<tr><td colspan="6" style="padding:22px;color:#9fb6d9">Nenhum registro encontrado.</td></tr>';
      updateBulkUI();
      return;
    }

    list.forEach((it, idx) => {
      const tr = document.createElement('tr');
     tr.innerHTML = `
  <td style="text-align:center;">
    <input 
      type="checkbox"
      class="chk-inv"
      data-id="${it.id}"
      ${selectedInvIds.has(it.id) ? 'checked' : ''}
    >
  </td>

 <td>
  <div class="link-cell">
    <div class="link-text">${escapeHtml(it.link)}</div>
    <div class="link-category">${escapeHtml(it.categoria)}</div>
  </div>
</td>



  <td class="small">${escapeHtml(it.velocidade)}</td>
  <td class="small">${escapeHtml(it.telefone)}</td>
  <td>${escapeHtml(it.local)}</td>
  <td>${escapeHtml(it.endereco)}</td>
  <td class="actions">
    <div class="action-group">
    <button class="icon-btn edit" title="Editar" data-idx="${idx}">
      <svg viewBox="0 0 24 24">
        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"/>
        <path d="M14.06 4.94l3.75 3.75"/>
      </svg>
    </button>
   <button class="icon-btn delete" title="Excluir" data-idx="${idx}">
  <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 6h18"/>
    <path d="M8 6v14"/>
    <path d="M16 6v14"/>
    <path d="M5 6l1 16h12l1-16"/>
    <path d="M9 6V4h6v2"/>
  </svg>
</button>
  </div>

  </td>
`;

      tbody.appendChild(tr);
    });

    // Delegação para botões (evita onclick inline)
    tbody.querySelectorAll('button.edit').forEach(b => {
      b.onclick = (e) => openEdit(Number(e.currentTarget.dataset.idx));
    });
    tbody.querySelectorAll('button.delete').forEach(b => {
      b.onclick = (e) => removeItem(Number(e.currentTarget.dataset.idx));
    });
  }
  






const chkAllInv = document.getElementById('chkAllInv');

if (chkAllInv) {
  chkAllInv.onchange = (e) => {
    selectedInvIds.clear();

    tbody.querySelectorAll('.chk-inv').forEach(chk => {
      chk.checked = e.target.checked;

      if (e.target.checked) {
        selectedInvIds.add(Number(chk.dataset.id));
      }
    });

    updateBulkUI();
  };
  const chkAll = document.getElementById('chkAllInv');
if (chkAll) {
  const total = tbody.querySelectorAll('.chk-inv').length;
  const marcados = selectedInvIds.size;

  chkAll.checked = total > 0 && marcados === total;
}

}

tbody.addEventListener('change', (e) => {
  if (!e.target.classList.contains('chk-inv')) return;

  const id = Number(e.target.dataset.id);

  if (e.target.checked) {
    selectedInvIds.add(id);
  } else {
    selectedInvIds.delete(id);

    // desmarca o "Selecionar todos"
    const chkAll = document.getElementById('chkAllInv');
    if (chkAll) chkAll.checked = false;
  }

  updateBulkUI();
});

function normalize(s){
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function getFiltered() {
  const q = (document.getElementById('q')?.value || "").toLowerCase();

  // PEGAR O SELECT APENAS SE EXISTIR (ABA INVENTÁRIO)
  const catEl = document.getElementById('filterCategoryInv');
  const cat = catEl ? catEl.value : "All";

  let list = [...data];

  // FILTRAR CATEGORIA (SOMENTE INVENTÁRIO)
if (cat !== "All") {
  list = list.filter(x =>
    normalize(x.categoria) === normalize(cat)
  );
}



  // BUSCA GERAL
  if (q) {
    list = list.filter(x =>
      (x.link || "").toLowerCase().includes(q) ||
      (x.local || "").toLowerCase().includes(q) ||
      (x.endereco || "").toLowerCase().includes(q) ||
      (x.telefone || "").toLowerCase().includes(q) ||
      (x.velocidade || "").toLowerCase().includes(q) ||
      (x.categoria || "").toLowerCase().includes(q)
    );
  }

  return list;
}


let PREFEITURA_LOGO = null;

async function carregarLogoPrefeitura() {
  try {
    const res = await fetch('Imagens/logo-prefeitura.png');
    const blob = await res.blob();

    PREFEITURA_LOGO = await new Promise(resolve => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });

  } catch (e) {
    console.warn('Logo da prefeitura não carregada:', e);
    PREFEITURA_LOGO = null;
  }
}


  function applyFilters(){ renderTable(getFiltered()); }
  function renderPills({q, cat, tel, vmin, vmax}){
    pillsArea.innerHTML = '';
    if(cat && cat!=='All') pillsArea.append(createPill('Categoria', cat));
    if(q) pillsArea.append(createPill('Busca', q));
    if(tel) pillsArea.append(createPill('Telefone', tel));
    if(vmin) pillsArea.append(createPill('Vel min', vmin));
    if(vmax) pillsArea.append(createPill('Vel max', vmax));
  }
  function createPill(title, val){ const d = document.createElement('div'); d.className = 'pill'; d.textContent = `${title}: ${val}`; return d; }
  window.applyFilters = applyFilters;


  /* ===========================
     MODAL INVENTÁRIO
     =========================== */
  function openModal(){
    editIndex = -1;
    document.getElementById('modalTitle').innerText = 'Novo Registro';
    resetModal();
    showModal(modal);
  }
  function closeModal(){ hideModal(modal); }
  function closeModalIfClicked(e){ if(e.target === modal) closeModal(); }

  function resetModal(){
    const safe = (id, v='') => { const el = document.getElementById(id); if(!el) return; el.value = v; }
    safe('inpCategoria','Prefeitura');
    safe('inpLink','');
    safe('inpLinkOutro',''); if(document.getElementById('inpLinkOutro')) document.getElementById('inpLinkOutro').style.display='none';
    safe('inpVel',''); safe('inpVelOutro',''); if(document.getElementById('inpVelOutro')) document.getElementById('inpVelOutro').style.display='none';
    safe('inpTel',''); safe('inpLocal',''); safe('inpLocalOutro',''); if(document.getElementById('inpLocalOutro')) document.getElementById('inpLocalOutro').style.display='none';
    safe('inpEnd','');
  }

  function openEdit(idx){
    editIndex = idx;
    const it = data[idx];
    if(!it) return;
    document.getElementById('modalTitle').innerText = 'Editar Registro';
    document.getElementById('inpCategoria').value = it.categoria || 'Prefeitura';

    // link
    const linkSelect = document.getElementById('inpLink');
    const linkOutro = document.getElementById('inpLinkOutro');
    if(linkSelect && [...linkSelect.options].some(o=>o.value===it.link)){
      linkSelect.value = it.link; if(linkOutro) linkOutro.style.display='none';
    } else if(linkSelect && linkOutro) {
      linkSelect.value = 'Outro'; linkOutro.style.display='block'; linkOutro.value = it.link;
    }

    // velocidade
    const velSelect = document.getElementById('inpVel'); const velOutro = document.getElementById('inpVelOutro');
    if(velSelect && [...velSelect.options].some(o=>o.value===it.velocidade)){ velSelect.value = it.velocidade; if(velOutro) velOutro.style.display='none'; }
    else if(velSelect && velOutro){ velSelect.value='Outro'; velOutro.style.display='block'; velOutro.value = it.velocidade; }

    // local
    const locSelect = document.getElementById('inpLocal'); const locOutro = document.getElementById('inpLocalOutro');
    if(locSelect && [...locSelect.options].some(o=>o.value===it.local)){ locSelect.value=it.local; if(locOutro) locOutro.style.display='none'; }
    else if(locSelect && locOutro){ locSelect.value='Outro'; locOutro.style.display='block'; locOutro.value = it.local; }

    document.getElementById('inpTel').value = it.telefone||'';
    document.getElementById('inpEnd').value = it.endereco||'';

    showModal(modal);
  }
  document.getElementById('inpLink').addEventListener('change', function () {
  document.getElementById('inpLinkOutro').style.display =
    this.value === 'Outro' ? 'block' : 'none';
});

document.getElementById('inpVel').addEventListener('change', function () {
  document.getElementById('inpVelOutro').style.display =
    this.value === 'Outro' ? 'block' : 'none';
});

document.getElementById('inpLocal').addEventListener('change', function () {
  document.getElementById('inpLocalOutro').style.display =
    this.value === 'Outro' ? 'block' : 'none';
});
const mLocalSelect = document.getElementById('mLocal');
const mLocalOutro = document.getElementById('mLocalOutro');

if (mLocalSelect && mLocalOutro) {
  mLocalSelect.addEventListener('change', function () {
    if (this.value === 'Outro') {
      mLocalOutro.style.display = 'block';
      mLocalOutro.focus();
    } else {
      mLocalOutro.style.display = 'none';
      mLocalOutro.value = '';
    }
  });
}



  /* ===========================
     CRUD INVENTÁRIO
     =========================== */
  // proteger addEventListener (existência dos elementos)
  const safeAdd = (id, ev, fn) => { const el = document.getElementById(id); if(el) el.addEventListener(ev, fn); };

  safeAdd('inpLink','change', function(){ const e = document.getElementById('inpLinkOutro'); if(!e) return; e.style.display = this.value==='Outro' ? 'block' : 'none'; if(this.value!=='Outro') e.value=''; });
  safeAdd('inpVel','change', function(){ const e = document.getElementById('inpVelOutro'); if(!e) return; e.style.display = this.value==='Outro' ? 'block' : 'none'; if(this.value!=='Outro') e.value=''; });
  safeAdd('inpLocal','change', function(){ const e = document.getElementById('inpLocalOutro'); if(!e) return; e.style.display = this.value==='Outro' ? 'block' : 'none'; if(this.value!=='Outro') e.value=''; });

  async function saveItem(){
    const categoria = (document.getElementById('inpCategoria').value || '').trim();
    let link = (document.getElementById('inpLink').value || '').trim(); const linkOutro = (document.getElementById('inpLinkOutro') ? document.getElementById('inpLinkOutro').value.trim() : '');
    if(link==='Outro' && linkOutro) link = linkOutro;
    let velocidade = (document.getElementById('inpVel').value || '').trim(); const velOutro = (document.getElementById('inpVelOutro') ? document.getElementById('inpVelOutro').value.trim() : '');
    if(velocidade==='Outro' && velOutro) velocidade = velOutro;
    let local = (document.getElementById('inpLocal').value || '').trim(); const localOutro = (document.getElementById('inpLocalOutro') ? document.getElementById('inpLocalOutro').value.trim() : '');
    if(local==='Outro' && localOutro) local = localOutro;
    let telefone = (document.getElementById('inpTel').value || '').trim();

// Tira espaços extras e garante padrão
telefone = telefone.replace(/\s+/g, " ").replace(/[^0-9()\- ]/g, "");
 const endereco = (document.getElementById('inpEnd').value || '').trim();

    if(!link || !local){ alert('Preencha ao menos Link e Local.'); return; }

    const item = { categoria, link, velocidade, telefone, local, endereco };

    try {
      if(editIndex >= 0){
        const id = data[editIndex].id;
        await fetch(`${API_URL}/${id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(item) });
      } else {
        const res = await fetch(API_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(item) });
        const novo = await res.json();
        data.push(novo);
      }
      await fetchData();
      closeModal();
    } catch(err){
      console.error('Erro salvar item:', err);
      alert('Erro ao salvar item.');
    }
  }

  async function removeItem(idx){
    if(!confirm('Remover este registro?')) return;
    try {
      const id = data[idx].id;
      await fetch(`${API_URL}/${id}`, { method:'DELETE' });
      await fetchData();
    } catch(err){
      console.error('Erro remover item:', err);
      alert('Erro ao remover item.');
    }
  }
async function loadImageToBase64(url) {
  const res = await fetch(url);
  const blob = await res.blob();

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

function exportInventario(type) {
  const rows = getInventarioExportData();

  if (!rows.length) {
    alert('Nenhum registro para exportar.');
    return;
  }

  if (type === 'pdf' || type === 'both') {
    exportInventarioPDF(rows);
  }

  if (type === 'excel' || type === 'both') {
    exportInventarioExcel(rows);
  }
}


function getInventarioExportData() {
  const base = selectedInvIds.size > 0
    ? data.filter(it => selectedInvIds.has(it.id))
    : getFiltered();

  return base.map(it => ({
    categoria: it.categoria || '',
    link: it.link || '',
    velocidade: it.velocidade || '',
    telefone: it.telefone || '',
    local: it.local || '',
    endereco: it.endereco || ''
  }));
}
function exportInventarioRelatorio() {
  const rows = getInventarioExportData();

  if (!rows.length) {
    alert('Nenhum registro para exportar.');
    return;
  }

  exportInventarioPDF(rows);
  exportInventarioExcel(rows);
}


function exportInventarioPDF(data) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('landscape');

  if (PREFEITURA_LOGO) {
    doc.addImage(PREFEITURA_LOGO, 'PNG', 14, 14, 18, 18);
  }

  doc.setFontSize(14);
  doc.text('PREFEITURA MUNICIPAL', 50, 18);
  doc.setFontSize(10);
  doc.text('Diretoria de Tecnologia da Informação', 50, 25);
 doc.setFontSize(10);
  doc.text('Secretaria de governo', 50, 30);
  doc.setFontSize(16);
  doc.text('Relatório de Inventários', 148, 45, { align: 'center' });

  doc.autoTable({
    startY: 50,
    head: [[ 'Categoria', 'Link', 'Velocidade', 'Telefone', 'Local', 'Endereço' ]],
    body: data.map(r => [
      r.categoria,
      r.link,
      r.velocidade,
      r.telefone,
      r.local,
      r.endereco
    ]),
    theme: 'grid',

    styles: {
      font: 'helvetica',
      fontSize: 9,
      textColor: [31, 41, 55],
      cellPadding: 6,
      lineColor: [229, 231, 235],
      lineWidth: 0.5
    },

    headStyles: {
      fillColor: [243, 244, 246],
      textColor: [17, 24, 39],
      fontStyle: 'bold'
    },

    alternateRowStyles: {
      fillColor: [249, 250, 251]
    }
  });

  doc.save('Relatorio_Inventario_TI.pdf');
}


function exportInventarioExcel(rows) {
  const wb = XLSX.utils.book_new();

  const wsData = [
    ['Prefeitura Municipal de São Francisco do Sul'],
    ['Secretaria Municipal de Tecnologia da Informação'],
    ['Relatório de Links e Conexões'],
    [`Gerado em ${new Date().toLocaleString('pt-BR')}`],
    [],
    ['Categoria', 'Link de Internet', 'Velocidade', 'Telefone', 'Local', 'Endereço']
  ];

  rows.forEach(r => {
    wsData.push([
      r.categoria,
      r.link,
      r.velocidade,
      r.telefone,
      r.local,
      r.endereco
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // ===== MERGES =====
  ws['!merges'] = [
    { s:{r:0,c:0}, e:{r:0,c:5} },
    { s:{r:1,c:0}, e:{r:1,c:5} },
    { s:{r:2,c:0}, e:{r:2,c:5} },
    { s:{r:3,c:0}, e:{r:3,c:5} }
  ];

  // ===== COLUNAS =====
  ws['!cols'] = [
    { wch: 18 },
    { wch: 36 },
    { wch: 18 },
    { wch: 18 },
    { wch: 32 },
    { wch: 48 }
  ];

  // ===== FILTRO =====
  ws['!autofilter'] = {
    ref: `A6:F${rows.length + 6}`
  };

  XLSX.utils.book_append_sheet(wb, ws, 'Inventário TI');

  XLSX.writeFile(
    wb,
    `Relatorio_Inventario_TI_${new Date().toISOString().slice(0,10)}.xlsx`
  );
  // Congelar cabeçalho
ws['!freeze'] = { xSplit: 0, ySplit: 6 };

// Alinhamento vertical
Object.keys(ws).forEach(cell => {
  if (!cell.startsWith('!')) {
    ws[cell].s = {
      alignment: {
        vertical: 'center',
        horizontal: 'left',
        wrapText: true
      }
    };
  }
});

}

  /* ===========================
     RENDER MÁQUINAS
     =========================== */
  function renderMachines(list){
    mtbody.innerHTML = '';
    if(!list || list.length===0){
      mtbody.innerHTML = `<tr><td colspan="5" style="padding:22px;color:#9fb6d9">Nenhuma máquina encontrada.</td></tr>`;
      return;
    }

    list.forEach((it, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
  <td style="text-align:center">
    <input
      type="checkbox"
      class="chk-mq"
      data-id="${it.id}"
      ${selectedMaqIds.has(it.id) ? 'checked' : ''}
    >
  </td>
  <td>${escapeHtml(it.nome_maquina || '')}</td>
  <td>${escapeHtml(it.patrimonio || '')}</td>
  <td>${escapeHtml(it.local || '')}</td>
<td>
  <div class="status-pill status-${normalizeStatus(it.status)}">
    <span class="status-dot"></span>
    <span class="status-text">${it.status || 'Ativa'}</span>
  </div>
</td>



<td>
  <div
    class="desc-preview"
    data-full="${escapeHtml(it.descricao || '')}"
  >
    ${escapeHtml(it.descricao || '')}
  </div>
</td>

      <td class="actions">
 <div class="action-group">
    <button class="icon-btn edit" title="Editar" data-idx="${idx}">
      <svg viewBox="0 0 24 24">
        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"/>
        <path d="M14.06 4.94l3.75 3.75"/>
      </svg>
    </button>
   <button class="icon-btn delete" title="Excluir" data-idx="${idx}">
  <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 6h18"/>
    <path d="M8 6v14"/>
    <path d="M16 6v14"/>
    <path d="M5 6l1 16h12l1-16"/>
    <path d="M9 6V4h6v2"/>
  </svg>
</button>
  </div>
</td>
      `;
      mtbody.appendChild(tr);
    });

     // eventos
  mtbody.querySelectorAll('.icon-btn.edit').forEach(b =>
    b.onclick = e => openMachineEdit(Number(e.currentTarget.dataset.idx))
  );

  mtbody.querySelectorAll('.icon-btn.delete').forEach(b =>
    b.onclick = e => deleteMachine(Number(e.currentTarget.dataset.idx))
  );


if (chkAllMq) {
  chkAllMq.onchange = (e) => {
    selectedMaqIds.clear();

    mtbody.querySelectorAll('.chk-mq').forEach(chk => {
      chk.checked = e.target.checked;
      if (e.target.checked) {
        selectedMaqIds.add(Number(chk.dataset.id));
      }
    });

    updateBulkUI();
  };
}
const chkAll = document.getElementById('chkAllMq');
if (chkAll) {
  const total = mtbody.querySelectorAll('.chk-mq').length;
  chkAll.checked = total > 0 && selectedMaqIds.size === total;
}

  }
  window.applyMachineFilters = applyMachineFilters;

mtbody.addEventListener('change', (e) => {
  if (!e.target.classList.contains('chk-mq')) return;

  const id = Number(e.target.dataset.id);

  if (e.target.checked) {
    selectedMaqIds.add(id);
  } else {
    selectedMaqIds.delete(id);
    document.getElementById('chkAllMq').checked = false;
  }

  updateBulkUI();
});

mtbody.addEventListener('click', (e) => {
  const el = e.target.closest('.desc-preview');
  if (!el) return;

  openDescModal(el);
});


  /* ===========================
     FILTROS MÁQUINAS
     =========================== */
 function applyMachineFilters() {
  const q = (document.getElementById('mq').value || '').trim().toLowerCase();

  let list = [...machineData];

  if (q) {
    list = list.filter(x =>
      (x.nome_maquina || '').toLowerCase().includes(q) ||
      (x.patrimonio || '').toLowerCase().includes(q) ||
      (x.local || '').toLowerCase().includes(q) ||
      (x.descricao || '').toLowerCase().includes(q) ||
      (x.status || '').toLowerCase().includes(q)

    );
  }

  renderMachines(list);
}

  function clearMachineFilters(){ document.getElementById('mq').value=''; document.getElementById('filterMachineCategory').value='All'; applyMachineFilters(); }


const filterCategoryInv = document.getElementById('filterCategoryInv');


  /* ===========================
     MODAL MÁQUINAS
     =========================== */
  function openMachineModal(){
    machineEditIndex = -1;
    document.getElementById('machineModalTitle').innerText = 'Nova Máquina';
    
    if(document.getElementById('mNome')) document.getElementById('mNome').value='';
    if(document.getElementById('mPatrimonio')) document.getElementById('mPatrimonio').value='';
    if(document.getElementById('mLocal')) document.getElementById('mLocal').value='';
    if(document.getElementById('mDescricao')) document.getElementById('mDescricao').value='';
    if (document.getElementById('mStatus')) {
  document.getElementById('mStatus').value = 'Ativa';
}


    showModal(machineModal);
  }
  function closeMachineModal(){ hideModal(machineModal); }
  function closeMachineModalIfClicked(e) {
  if (e.target === machineModal) {
    closeMachineModal();
  }
}


  function openMachineEdit(idx){
    machineEditIndex = idx;
    const it = machineData[idx];
    if(!it) return;
    document.getElementById('machineModalTitle').innerText = 'Editar Máquina';
    document.getElementById('mStatus').value = it.status || 'Ativa';

    if(document.getElementById('mNome')) document.getElementById('mNome').value = it.nome_maquina || '';
    if(document.getElementById('mPatrimonio')) document.getElementById('mPatrimonio').value = it.patrimonio || '';
    const localSelect = document.getElementById('mLocal');
const localOutroInput = document.getElementById('mLocalOutro');

if (localSelect && [...localSelect.options].some(o => o.value === it.local)) {
  localSelect.value = it.local;
  if (localOutroInput) {
    localOutroInput.style.display = 'none';
    localOutroInput.value = '';
  }
} else {
  localSelect.value = 'Outro';
  if (localOutroInput) {
    localOutroInput.style.display = 'block';
    localOutroInput.value = it.local || '';
  }
}

    if(document.getElementById('mDescricao')) document.getElementById('mDescricao').value = it.descricao || '';
    if (document.getElementById('mStatus')) {
  document.getElementById('mStatus').value = it.status || 'Ativa';
}

    showModal(machineModal);
  }

  /* ===========================
     CRUD MÁQUINAS
     =========================== */
async function saveMachine(){
  let local = (document.getElementById('mLocal')?.value || '').trim();
  const localOutro = (document.getElementById('mLocalOutro')?.value || '').trim();

  if (local === 'Outro' && localOutro) {
    local = localOutro;
  }

  const item = {
    nome_maquina: (document.getElementById('mNome')?.value || '').trim(),
    patrimonio: (document.getElementById('mPatrimonio')?.value || '').trim(),
    local,
    descricao: (document.getElementById('mDescricao')?.value || '').trim(),
    status: document.getElementById('mStatus').value
  };

if(!item.local){
  alert("Informe o local da máquina.");
  return;
}


  if(!item.nome_maquina){
    alert("Preencha o nome da máquina.");
    return;
  }

  try {
    if(machineEditIndex >= 0){
      const id = machineData[machineEditIndex].id;

      await fetch(`${API_MAQUINAS}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item)
      });

    } else {

      const res = await fetch(API_MAQUINAS, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item)
      });

      const novo = await res.json();
      machineData.push(novo);
    }

    await fetchMachines();
    closeMachineModal();

  } catch (err) {
    console.error("Erro ao salvar máquina:", err);
    alert("Erro ao salvar máquina.");
  }
}


  async function deleteMachine(idx){
    if(!confirm('Remover esta máquina?')) return;
    try{
      const id = machineData[idx].id;
      await fetch(`${API_MAQUINAS}/${id}`, { method:'DELETE' });
      await fetchMachines();
    } catch(err){
      console.error('Erro deletar máquina:', err);
      alert('Erro ao deletar máquina.');
    }
  }
function drawHeader(doc, titulo, logoBase64) {
  const pageWidth = doc.internal.pageSize.getWidth();

  /* ===== LOGO ===== */
  if (logoBase64) {
    doc.addImage(
      logoBase64,
      'PNG',
      40,   // X
      32,   // Y
      42,   // largura (ANTES: 60)
      42    // altura
    );
  }

  /* ===== TEXTO INSTITUCIONAL ===== */
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Prefeitura Municipal de São Francisco do Sul', 95, 45);

  doc.setFontSize(10);
  doc.setFont('Helvetica', 'normal');
  doc.text('Secretaria Municipal de Tecnologia da Informação', 95, 60);

  /* ===== TÍTULO ===== */
  doc.setFontSize(15);
  doc.setFont('Helvetica', 'bold');
  doc.text(titulo, pageWidth / 2, 105, { align: 'center' });

  /* ===== LINHA ===== */
  doc.setDrawColor(180);
  doc.setLineWidth(0.8);
  doc.line(40, 118, pageWidth - 40, 118);
}


function drawFooter(doc) {
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageCount = doc.internal.getNumberOfPages();

  doc.setFontSize(9);
  doc.setTextColor(120);

  doc.text(
    `Página ${pageCount}`,
    pageWidth / 2,
    pageHeight - 25,
    { align: 'center' }
  );

  doc.text(
    'Documento oficial gerado pelo Sistema de Inventário de T.I',
    40,
    pageHeight - 25
  );
}
function exportMaquinas(type) {
  const rows = getMaquinasExportData();

  if (!rows.length) {
    alert('Nenhuma máquina para exportar.');
    return;
  }

  if (type === 'pdf' || type === 'both') {
    exportMaquinasPDF(rows);
  }

  if (type === 'excel' || type === 'both') {
    exportMaquinasExcel(rows);
  }
}


function getMaquinasExportData() {
  const base = selectedMaqIds.size > 0
    ? machineData.filter(m => selectedMaqIds.has(m.id))
    : machineData;

  return base.map(m => ({
    nome: m.nome_maquina || '',
    patrimonio: m.patrimonio || '',
    local: m.local || '',
    status: m.status || 'Ativa',
    descricao: m.descricao || ''
  }));
}
function exportMaquinasRelatorio() {
  const rows = getMaquinasExportData();

  if (!rows.length) {
    alert('Nenhuma máquina para exportar.');
    return;
  }

  exportMaquinasPDF(rows);
  exportMaquinasExcel(rows);
}

function exportMaquinasPDF(data) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('landscape');

  if (PREFEITURA_LOGO) {
    doc.addImage(PREFEITURA_LOGO, 'PNG', 14, 14, 18, 18);
  }

  doc.setFontSize(14);
  doc.text('PREFEITURA MUNICIPAL', 50, 18);
  doc.setFontSize(10);
  doc.text('Diretoria de Tecnologia da Informação', 50, 25);
 doc.setFontSize(10);
  doc.text('Secretaria de governo', 50, 30);
  doc.setFontSize(16);
  doc.text('Relatório de Máquinas', 148, 45, { align: 'center' });

  doc.autoTable({
    startY: 50,
    head: [[ 'Máquina', 'Patrimônio', 'Local', 'Status', 'Descrição' ]],
    body: data.map(r => [
      r.nome,
      r.patrimonio,
      r.local,
      r.status,
      r.descricao
    ]),
    theme: 'grid',

    styles: {
      fontSize: 9,
      textColor: [31, 41, 55],
      cellPadding: 6,
      lineColor: [229, 231, 235],
      lineWidth: 0.5
    },

    headStyles: {
      fillColor: [243, 244, 246],
      textColor: [17, 24, 39],
      fontStyle: 'bold'
    },

    alternateRowStyles: {
      fillColor: [249, 250, 251]
    }
  });

  doc.save('Relatorio_Maquinas_TI.pdf');
}


function exportMaquinasExcel(rows) {
  const wb = XLSX.utils.book_new();

  const wsData = [
    ['Prefeitura Municipal de São Francisco do Sul'],
    ['Secretaria Municipal de Tecnologia da Informação'],
    ['Relatório de Inventário de Máquinas'],
    [`Gerado em ${new Date().toLocaleString('pt-BR')}`],
    [],
    ['Nome da Máquina', 'Patrimônio', 'Local', 'Status', 'Descrição']
  ];

  rows.forEach(r => {
    wsData.push([
      r.nome,
      r.patrimonio,
      r.local,
      r.status,
      r.descricao
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // ===== MERGES (Cabeçalho) =====
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 4 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 4 } }
  ];

  // ===== LARGURA DAS COLUNAS =====
  ws['!cols'] = [
    { wch: 28 }, // Nome
    { wch: 18 }, // Patrimônio
    { wch: 30 }, // Local
    { wch: 16 }, // Status
    { wch: 50 }  // Descrição
  ];

  // ===== AUTO FILTER =====
  ws['!autofilter'] = {
    ref: `A6:E${rows.length + 6}`
  };

  XLSX.utils.book_append_sheet(wb, ws, 'Máquinas');

  XLSX.writeFile(
    wb,
    `Relatorio_Maquinas_TI_${new Date().toISOString().slice(0, 10)}.xlsx`
  );
  // Congelar cabeçalho
ws['!freeze'] = { xSplit: 0, ySplit: 6 };

// Alinhamento vertical
Object.keys(ws).forEach(cell => {
  if (!cell.startsWith('!')) {
    ws[cell].s = {
      alignment: {
        vertical: 'center',
        horizontal: 'left',
        wrapText: true
      }
    };
  }
});

}



  /* ===========================
     TABS
     =========================== */
  function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav a').forEach(a => a.classList.remove('active'));

    if (tabName === 'inventario') {
      document.getElementById('tabInventario').classList.add('active');
      document.querySelector('.nav a:nth-child(1)').classList.add('active');
    } else {
      document.getElementById('tabMaquinas').classList.add('active');
      document.querySelector('.nav a:nth-child(2)').classList.add('active');
      fetchMachines();
    }
  }
  
// ===========================
// MÁSCARA DE TELEFONE FIXO (47) 2222-2222
// ===========================
const telInput = document.getElementById('inpTel');

if (telInput) {
  telInput.addEventListener('input', function () {
    let v = this.value.replace(/\D/g, ""); // só números

    // Limita a 10 dígitos (47 + 8 dígitos)
    if (v.length > 10) v = v.slice(0, 10);

    // Montagem do telefone fixo
    if (v.length > 0) v = "(" + v;
    if (v.length > 2) v = v.slice(0, 3) + ") " + v.slice(3);
    if (v.length > 8) v = v.slice(0, 9) + "-" + v.slice(9);

    this.value = v;
  });
}
async function deleteSelected() {
  const isInventario = selectedInvIds.size > 0;
  const ids = isInventario
    ? [...selectedInvIds]
    : [...selectedMaqIds];

  if (!ids.length) return;

  if (!confirm(`Excluir ${ids.length} item(ns)?`)) return;

  try {
    for (const id of ids) {
      const url = isInventario
        ? `${API_URL}/${id}`
        : `${API_MAQUINAS}/${id}`;

      await fetch(url, { method: 'DELETE' });
    }

    selectedInvIds.clear();
    selectedMaqIds.clear();
    updateBulkUI();

    isInventario ? fetchData() : fetchMachines();

  } catch (err) {
    console.error('Erro ao excluir selecionados:', err);
    alert('Erro ao excluir itens.');
  }
}

function openDescModal(el) {
  const modal = document.getElementById('descModal');
  const content = document.getElementById('descModalContent');

  content.textContent = el.dataset.full || 'Sem descrição';
  modal.classList.add('show');
}

function closeDescModal(e) {
  if (!e || e.target.id === 'descModal') {
    document.getElementById('descModal').classList.remove('show');
  }
}

function normalizeStatus(status = '') {
  return status
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '');
}

function toggleExportMenu(tipo) {
  const inv = document.getElementById('exportMenuInv');
  const mq  = document.getElementById('exportMenuMq');

  if (tipo === 'inv') {
    inv.classList.toggle('hidden');
    mq.classList.add('hidden');
  } else {
    mq.classList.toggle('hidden');
    inv.classList.add('hidden');
  }
}
function openImportModal(type) {
  importType = type;
  importRows = [];
  importHeaders = [];

  document.getElementById('importTitle').innerText =
    type === 'inventario'
      ? 'Importar Inventário (Links)'
      : 'Importar Máquinas';

  document.getElementById('importPreviewTable').querySelector('thead').innerHTML = '';
  document.getElementById('importPreviewTable').querySelector('tbody').innerHTML = '';
  document.getElementById('importFile').value = '';
  openModalById('importModal');


}

function closeImportModal() {
  document.getElementById('importModal').classList.remove('show');
}

function closeImportModalIfClicked(e) {
  if (e.target.id === 'importModal') closeImportModal();
}
function handleImportFile() {
  const file = document.getElementById('importFile').files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = (e) => {
    const wb = XLSX.read(e.target.result, { type: 'binary' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    importHeaders = data[0];
    importRows = data.slice(1);

    renderImportPreview();
  };

  reader.readAsBinaryString(file);
}
function renderImportPreview() {
  const thead = document.querySelector('#importPreviewTable thead');
  const tbody = document.querySelector('#importPreviewTable tbody');

  thead.innerHTML = `
    <tr>
      ${importHeaders.map(h => `<th>${h}</th>`).join('')}
      <th>Ação</th>
    </tr>
  `;

  tbody.innerHTML = '';

  importRows.forEach((row, idx) => {
    const tr = document.createElement('tr');

    tr.innerHTML = `
      ${row.map((cell, cidx) => `
        <td contenteditable="true"
            oninput="updateImportCell(${idx}, ${cidx}, this.innerText)">
          ${cell ?? ''}
        </td>
      `).join('')}
      <td>
        <button class="icon-btn delete" onclick="removeImportRow(${idx})">
          🗑
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

function updateImportCell(row, col, value) {
  importRows[row][col] = value;
}

function removeImportRow(index) {
  importRows.splice(index, 1);
  renderImportPreview();
}
function mapImportRows() {
  if (importType === 'inventario') {
    return importRows.map(r => ({
      categoria: r[0],
      link: r[1],
      velocidade: r[2],
      telefone: r[3],
      local: r[4],
      endereco: r[5]
    }));
  }

  if (importType === 'maquinas') {
    return importRows.map(r => ({
      nome_maquina: r[0],
      patrimonio: r[1],
      local: r[2],
      status: r[3],
      descricao: r[4]
    }));
  }

  return [];
}
async function confirmImport() {
  const rows = mapImportRows();

  if (!rows.length) {
    alert('Nenhum dado para importar.');
    return;
  }

  const url =
    importType === 'inventario'
      ? '/api/import/inventario'
      : '/api/import/maquinas';

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows })
    });

    const result = await res.json();

    if (result.errors?.length) {
      alert(`Importação concluída com ${result.errors.length} erro(s).`);
      console.table(result.errors);
    } else {
      alert('Importação realizada com sucesso!');
    }

    closeImportModal();
    await fetchData();
await fetchMachines();


  } catch (err) {
    console.error(err);
    alert('Erro ao importar dados.');
  }
}


async function carregarModulos() {
  try {
    const res = await fetch(API_MODULOS);
    modulos = await res.json();
    renderAbasDinamicas();
  } catch (e) {
    console.error('Erro ao carregar módulos:', e);
  }
}

function renderAbasDinamicas() {
  const nav = document.querySelector('.nav');

  // remove abas dinâmicas antigas
  nav.querySelectorAll('.tab-dinamica').forEach(e => e.remove());

  modulos.forEach(mod => {
    const a = document.createElement('a');
    a.className = 'tab-dinamica';
    a.textContent = mod.nome;

   a.onclick = () => {
  // marca active no menu
  document.querySelectorAll('.nav a, .nav .tab-dinamica').forEach(x => x.classList.remove('active'));
  a.classList.add('active');
  abrirModulo(mod);
};


    nav.appendChild(a);
  });
}

async function abrirModulo(mod) {
  moduloAtual = mod;

  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav a').forEach(a => a.classList.remove('active'));

  await carregarCamposModulo();
  await carregarRegistrosModulo();

  renderModuloDinamico();
}

async function carregarCamposModulo() {
  const res = await fetch(`/api/modulos/${moduloAtual.id}/campos`);
  moduloCampos = await res.json();
}

async function carregarRegistrosModulo() {
  const res = await fetch(`/api/modulos/${moduloAtual.id}/registros`);
  moduloRegistros = await res.json();
}

function renderModuloDinamico() {
  const tab = document.getElementById('tabModuloDinamico');
  const thead = document.getElementById('moduloThead');
  const tbody = document.getElementById('moduloTbody');

  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');

  // HEADER
  thead.innerHTML = `
    <tr>
      ${moduloCampos.map(c => `<th>${c.nome}</th>`).join('')}
      <th>Ações</th>
    </tr>
  `;

  // BODY
  tbody.innerHTML = '';

  if (!moduloRegistros.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="${moduloCampos.length + 1}" style="padding:22px;color:#9fb6d9">
          Nenhum registro encontrado.
        </td>
      </tr>`;
    return;
  }

  moduloRegistros.forEach((row, idx) => {
    const tr = document.createElement('tr');

    tr.innerHTML = `
      ${moduloCampos.map(c => `
        <td>${escapeHtml(row[c.nome] || '')}</td>
      `).join('')}
      <td class="actions">
        <button class="icon-btn edit" onclick="editarRegistroModulo(${idx})">✏️</button>
        <button class="icon-btn delete" onclick="excluirRegistroModulo(${row.id})">🗑</button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}
async function excluirRegistroModulo(id) {
  if (!confirm('Remover este registro?')) return;

  await fetch(`/api/modulos/${moduloAtual.id}/registros/${id}`, {
    method: 'DELETE'
  });

  await carregarRegistrosModulo();
  renderModuloDinamico();
}


let newTabFields = [];

function openCreateTabModal() {
  newTabFields = [];
  document.getElementById('fieldsContainer').innerHTML = '';
  document.getElementById('newTabName').value = '';
  openModalById('createTabModal');


}

function closeCreateTabModal(e) {
  if (!e || e.target.id === 'createTabModal') {
    document.getElementById('createTabModal').classList.remove('show');
  }
}
function addField() {
  const idx = newTabFields.length;

  newTabFields.push({
    nome: '',
    tipo: 'texto',
    obrigatorio: false
  });

  const row = document.createElement('div');
  row.className = 'field-row';
  row.dataset.idx = idx;

  row.innerHTML = `
    <input
      type="text"
      placeholder="Nome do campo"
      oninput="newTabFields[${idx}].nome = this.value"
    />

    <select onchange="newTabFields[${idx}].tipo = this.value">
      <option value="texto">Texto</option>
      <option value="numero">Número</option>
      <option value="data">Data</option>
      <option value="select">Lista</option>
    </select>

    <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:#334155;margin:0;">
      <input type="checkbox" onchange="newTabFields[${idx}].obrigatorio = this.checked">
      Obrigatório
    </label>

    <button
      type="button"
      class="field-remove"
      title="Remover campo"
      onclick="removeField(${idx})"
    >✕</button>
  `;

  document.getElementById('fieldsContainer').appendChild(row);
}
function removeField(idx) {
  // marca como removido
  if (newTabFields[idx]) newTabFields[idx].__deleted = true;

  // remove do DOM
  const container = document.getElementById('fieldsContainer');
  const rows = [...container.querySelectorAll('.field-row')];
  rows.forEach(r => {
    if (Number(r.dataset.idx) === idx) r.remove();
  });
}



async function loadDynamicTabs() {
  const res = await fetch('/api/modulos');
  const modulos = await res.json();

  const nav = document.querySelector('.nav');

  modulos.forEach(m => {
    if (document.getElementById(`tab-${m.id}`)) return;

    const a = document.createElement('a');
    a.textContent = m.nome;
    a.onclick = () => abrirModulo(m);

    nav.appendChild(a);
  });
}

async function createNewTab() {
  const nome = document.getElementById('newTabName').value.trim();
  if (!nome) return alert('Informe o nome da aba');

  // 1. cria módulo
  const modRes = await fetch('/api/modulos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome })
  });

  const modulo = await modRes.json();

  // 2. cria campos
  const fields = document.querySelectorAll('.field-row');

  for (let i = 0; i < fields.length; i++) {
    const nomeCampo = fields[i].querySelector('.field-name').value;
    const tipo = fields[i].querySelector('.field-type').value;
    const obrigatorio = fields[i].querySelector('.field-required').checked;

    await fetch(`/api/modulos/${modulo.id}/campos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: nomeCampo,
        tipo,
        obrigatorio,
        ordem: i
      })
    });
  }

  closeCreateTabModal();
  loadDynamicTabs(); // upgrade, não quebra nada
}
async function openModulo(modulo) {
  switchTab('modulo');

  document.getElementById('moduloTitulo').textContent = modulo.nome;

  const campos = await fetch(`/api/modulos/${modulo.id}/campos`).then(r => r.json());
  const registros = await fetch(`/api/modulos/${modulo.id}/registros`).then(r => r.json());

  renderModuloTable(campos, registros);
}
 async function salvarNovoModulo() {
  const nome = document.getElementById('newTabName').value.trim();

  if (!nome) {
    alert('Informe o nome da aba.');
    return;
  }

  if (!newTabFields.length) {
    alert('Adicione ao menos um campo.');
    return;
  }

  const res = await fetch('/api/modulos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome })
  });

  const modulo = await res.json();

const camposValidos = newTabFields
  .filter(f => f && !f.__deleted)
  .map(f => ({
    nome: (f.nome || '').trim(),
    tipo: f.tipo || 'texto',
    obrigatorio: !!f.obrigatorio
  }))
  .filter(f => f.nome);

if (!camposValidos.length) {
  alert('Adicione ao menos um campo com nome válido.');
  return;
}

for (let i = 0; i < camposValidos.length; i++) {
  const f = camposValidos[i];

  await fetch(`/api/modulos/${modulo.id}/campos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nome: f.nome,
      tipo: f.tipo,
      obrigatorio: f.obrigatorio,
      ordem: i
    })
  });
}


  closeCreateTabModal();
  await carregarModulos();
}
function closeAllModals() {
  document.querySelectorAll('.modal.show').forEach(m => m.classList.remove('show'));
}

/**
 * Abre um modal por ID (sem conflitar com openModal do inventário).
 * Ex: openModalById('createTabModal')
 */
function openModalById(id) {
  closeAllModals();
  const el = document.getElementById(id);
  if (el) el.classList.add('show');
}





// FECHAR AO CLICAR FORA (SEM QUEBRAR)
document.addEventListener('click', (e) => {
  if (!e.target.closest('.export-wrapper')) {
    document.getElementById('exportMenuInv')?.classList.add('hidden');
    document.getElementById('exportMenuMq')?.classList.add('hidden');
  }
});


  /* ===========================
     EVENTOS GLOBAIS
     =========================== */

document.addEventListener('click', (e) => {
  const inv = document.getElementById('exportMenuInv');
  const mq  = document.getElementById('exportMenuMq');

  if (!e.target.closest('.export-wrapper')) {
    inv?.classList.add('hidden');
    mq?.classList.add('hidden');
  }
});



  /* ===========================
     BIND GLOBAL (expor funções para onclick inline se necessário)
     =========================== */
  window.openModal = openModal;
  window.openMachineModal = openMachineModal;
  window.closeModal = closeModal;
  window.closeMachineModal = closeMachineModal;
  window.saveItem = saveItem;
  window.saveMachine = saveMachine;
  window.switchTab = switchTab;
  window.openEdit = openEdit;
  window.openMachineEdit = openMachineEdit;
  window.removeItem = removeItem;
  window.deleteMachine = deleteMachine;
  window.deleteSelected = deleteSelected;
  window.openDescModal = openDescModal;
  window.closeDescModal = closeDescModal;
  window.closeMachineModalIfClicked = closeMachineModalIfClicked;
  window.exportInventarioRelatorio = exportInventarioRelatorio;
  window.exportMaquinasRelatorio = exportMaquinasRelatorio;
  window.exportInventario = exportInventario;
  window.exportMaquinas = exportMaquinas;
  window.toggleExportMenu = toggleExportMenu;
  window.carregarLogoPrefeitura = carregarLogoPrefeitura;
  window.openImportModal = openImportModal;
  window.closeImportModal = closeImportModal;
  window.closeImportModalIfClicked = closeImportModalIfClicked;
  window.handleImportFile = handleImportFile;
  window.confirmImport = confirmImport;
  window.removeImportRow = removeImportRow;
  window.updateImportCell = updateImportCell;

window.openCreateTabModal = openCreateTabModal;
window.closeCreateTabModal = closeCreateTabModal;
window.addField = addField;
window.salvarNovoModulo = salvarNovoModulo;
window.openModalById = openModalById;
window.removeField = removeField;


  /* ===========================
     INICIALIZAÇÃO
     =========================== */
     await carregarModulos();

  await carregarLogoPrefeitura();
  fetchData();
  fetchMachines();
});