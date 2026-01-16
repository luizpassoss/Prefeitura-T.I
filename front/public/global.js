
window.newTabFields = [];

document.addEventListener('DOMContentLoaded', async () => {
  document.querySelectorAll('.modal').forEach(m => {
  m.classList.remove('show');
});
let moduloAtualId = null;
let camposModuloAtual = [];

  let importType = null; // inventario | maquinas
  let importRows = [];
  let importHeaders = [];
  let importFileName = '';

/* ===========================
   MÓDULOS DINÂMICOS
   =========================== */
  const API_BASE = 'https://pertinently-unpublished-soila.ngrok-free.dev/api';
const API_MODULOS = `${API_BASE}/modulos`;

let modulos = [];
let moduloAtual = null;
let moduloCampos = [];
let moduloRegistros = [];
let moduloEditId = null;
let moduloDeleteTarget = null;
let moduloColumnFilters = {};
let moduloSortState = { key: null, dir: 'asc' };

const sortState = {
  inventory: { key: null, dir: 'asc' },
  machines: { key: null, dir: 'asc' }
};

const IMPORT_HISTORY_KEY = 'ti-import-history';

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
  const themeToggle = document.getElementById('themeToggle');
  

if (btnNovaAba) {
  btnNovaAba.addEventListener('click', openCreateTabModal);
}

  function applyTheme(theme) {
    const isDark = theme === 'dark';
    document.body.classList.toggle('theme-dark', isDark);
    if (themeToggle) {
      themeToggle.setAttribute('aria-pressed', String(isDark));
      themeToggle.setAttribute('title', isDark ? 'Mudar para modo claro' : 'Mudar para modo escuro');
    }
    localStorage.setItem('ti-theme', theme);
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const nextTheme = document.body.classList.contains('theme-dark') ? 'light' : 'dark';
      applyTheme(nextTheme);
    });
  }

  const savedTheme = localStorage.getItem('ti-theme');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(savedTheme || (prefersDark ? 'dark' : 'light'));
  updateFilterBadges();
  renderImportHistory();

  document.querySelectorAll('#tb thead .sortable').forEach((th) => {
    th.addEventListener('click', () => {
      toggleSort(sortState.inventory, th.dataset.sortKey);
      applyFilters();
    });
  });

  document.querySelectorAll('#tabMaquinas thead .sortable').forEach((th) => {
    th.addEventListener('click', () => {
      toggleSort(sortState.machines, th.dataset.sortKey);
      applyMachineFilters();
    });
  });


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
let selectedModuloIds = new Set();

function updateBulkUI() {
  const bulk = document.getElementById('bulkActions');
  const counter = document.getElementById('bulkCounter');

  const count = selectedInvIds.size + selectedMaqIds.size + selectedModuloIds.size;

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
      setTableLoading('tbody', true, 7);
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
      setTableLoading('mtbody', true, 7);
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
  let confirmCallback = null;
  const XLSX_BORDER = {
    top: { style: 'thin', color: { rgb: 'FF000000' } },
    bottom: { style: 'thin', color: { rgb: 'FF000000' } },
    left: { style: 'thin', color: { rgb: 'FF000000' } },
    right: { style: 'thin', color: { rgb: 'FF000000' } }
  };

  function mergeStyle(base = {}, next = {}) {
    return {
      ...base,
      ...next,
      alignment: { ...(base.alignment || {}), ...(next.alignment || {}) },
      font: { ...(base.font || {}), ...(next.font || {}) },
      fill: { ...(base.fill || {}), ...(next.fill || {}) },
      border: { ...(base.border || {}), ...(next.border || {}) }
    };
  }

  function applyRangeStyle(ws, range, style) {
    const decoded = XLSX.utils.decode_range(range);
    for (let r = decoded.s.r; r <= decoded.e.r; r += 1) {
      for (let c = decoded.s.c; c <= decoded.e.c; c += 1) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        if (!ws[cellRef]) continue;
        ws[cellRef].s = mergeStyle(ws[cellRef].s || {}, style);
      }
    }
  }

  function setTableLoading(tbodyId, isLoading, colspan, message = 'Carregando registros...') {
    const tbodyEl = document.getElementById(tbodyId);
    if (!tbodyEl) return;
    if (isLoading) {
      tbodyEl.innerHTML = `
        <tr class="loading-row">
          <td colspan="${colspan}">
            <span class="loading-spinner" aria-hidden="true"></span>
            ${message}
          </td>
        </tr>
      `;
    }
  }

  function focusFirstField(modalEl) {
    if (!modalEl) return;
    requestAnimationFrame(() => {
      const target = modalEl.querySelector('[data-autofocus], input, select, textarea, button');
      if (target) target.focus();
    });
  }

  function buildExcelSheet({ title, headers, rows, colWidths }) {
    const wsData = [
      [title],
      headers,
      ...rows
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const lastCol = XLSX.utils.encode_col(headers.length - 1);
    const lastCell = XLSX.utils.encode_cell({ r: wsData.length - 1, c: headers.length - 1 });

    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }
    ];
    ws['!cols'] = colWidths || headers.map(() => ({ wch: 22 }));

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

    const headerFill = { patternType: 'solid', fgColor: { rgb: 'FFD9D9D9' } };
    applyRangeStyle(ws, `A1:${lastCol}1`, {
      font: { bold: true },
      alignment: { horizontal: 'center' },
      fill: headerFill
    });
    applyRangeStyle(ws, `A2:${lastCol}2`, {
      font: { bold: true },
      alignment: { horizontal: 'center' },
      fill: headerFill
    });
    applyRangeStyle(ws, `A1:${lastCell}`, {
      border: XLSX_BORDER
    });

    return ws;
  }

  function toggleFilters(panelId, button) {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    panel.classList.toggle('hidden');
    if (button) {
      const isOpen = !panel.classList.contains('hidden');
      button.setAttribute('aria-pressed', String(isOpen));
    }
  }

function showMessage(message, title = 'Aviso') {
    const titleEl = document.getElementById('systemMessageTitle');
    const textEl = document.getElementById('systemMessageText');
    const modalEl = document.getElementById('systemMessageModal');
    if (titleEl) titleEl.textContent = title;
    if (textEl) textEl.textContent = message;
    if (modalEl) {
      openModalById('systemMessageModal');
    } else {
      console.warn('[UI] Modal systemMessageModal não encontrado.');
    }
  }

  function closeSystemMessageModal(e) {
    const modalEl = document.getElementById('systemMessageModal');
    if (!modalEl) return;
    if (!e || e.target.id === 'systemMessageModal') {
      modalEl.classList.remove('show');
    }
  }

  function showConfirm(message, onConfirm, title = 'Confirmar ação') {
    confirmCallback = onConfirm;
    const titleEl = document.getElementById('systemConfirmTitle');
    const textEl = document.getElementById('systemConfirmText');
    const modalEl = document.getElementById('systemConfirmModal');
    if (titleEl) titleEl.textContent = title;
    if (textEl) textEl.textContent = message;
    if (modalEl) {
      openModalById('systemConfirmModal');
    } else {
      console.warn('[UI] Modal systemConfirmModal não encontrado.');
    }
  }

  function closeSystemConfirmModal(e) {
    const modalEl = document.getElementById('systemConfirmModal');
    if (!modalEl) return;
    if (!e || e.target.id === 'systemConfirmModal') {
      modalEl.classList.remove('show');
    }
  }

  function confirmSystemAction() {
    if (typeof confirmCallback === 'function') {
      confirmCallback();
    }
    confirmCallback = null;
    closeSystemConfirmModal();
  }

  function showImportWarning(message) {
    const validationEl = document.getElementById('importValidation');
    if (validationEl) {
      validationEl.innerHTML = `<div>${message}</div>`;
      validationEl.classList.remove('hidden');
      return;
    }
    showMessage(message);
  }

  function openHelpPanel(title, content) {
    const panel = document.getElementById('helpPanel');
    const overlay = document.getElementById('helpPanelOverlay');
    const titleEl = document.getElementById('helpPanelTitle');
    const contentEl = document.getElementById('helpPanelContent');
    if (!panel || !overlay || !titleEl || !contentEl) return;
    titleEl.textContent = title || 'Ajuda';
    contentEl.textContent = content || '';
    panel.classList.remove('hidden');
    overlay.classList.remove('hidden');
  }

  function closeHelpPanel() {
    const panel = document.getElementById('helpPanel');
    const overlay = document.getElementById('helpPanelOverlay');
    panel?.classList.add('hidden');
    overlay?.classList.add('hidden');
  }

  /* ===========================
     RENDER INVENTÁRIO
     =========================== */
  function renderTable(list){
    tbody.innerHTML = '';
    if(!list || list.length === 0){
      tbody.innerHTML = '<tr><td colspan="7" style="padding:22px;color:#9fb6d9">Nenhum registro encontrado.</td></tr>';
      updateBulkUI();
      return;
    }

    list.forEach((it, idx) => {
      const tr = document.createElement('tr');
     tr.innerHTML = `
  <td class="checkbox-cell" style="text-align:center;">
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

function getInputValue(id) {
  return (document.getElementById(id)?.value || '').trim().toLowerCase();
}

function isValidPhoneNumber(value) {
  const digits = (value || '').replace(/\D/g, '');
  if (!digits) return true;
  return digits.length >= 8 && digits.length <= 11;
}

function isValidEmail(value) {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function applyPhoneMask(value) {
  const digits = (value || '').replace(/\D/g, '').slice(0, 11);
  if (!digits) return '';
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  return digits
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
}

function applyDateMask(value) {
  const digits = (value || '').replace(/\D/g, '').slice(0, 8);
  if (!digits) return '';
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function normalizeDateValue(value) {
  if (!value) return '';
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    const [day, month, year] = trimmed.split('/');
    return `${year}-${month}-${day}`;
  }
  return trimmed;
}

function normalizeSortValue(value) {
  if (value === null || value === undefined) return '';
  const str = value.toString().trim();
  const numeric = Number(str.replace(',', '.'));
  if (!Number.isNaN(numeric) && str !== '') return numeric;
  return str.toLowerCase();
}

function sortWithIndex(list, getValue, dir = 'asc') {
  const multiplier = dir === 'desc' ? -1 : 1;
  return list
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const av = normalizeSortValue(getValue(a.item));
      const bv = normalizeSortValue(getValue(b.item));
      if (av < bv) return -1 * multiplier;
      if (av > bv) return 1 * multiplier;
      return a.index - b.index;
    })
    .map(({ item }) => item);
}

function updateSortIndicators(scopeSelector, state) {
  document.querySelectorAll(`${scopeSelector} .sortable`).forEach((th) => {
    th.classList.remove('asc', 'desc');
    th.setAttribute('aria-sort', 'none');
    if (th.dataset.sortKey === state.key) {
      th.classList.add(state.dir);
      th.setAttribute('aria-sort', state.dir === 'asc' ? 'ascending' : 'descending');
    }
  });
}

function toggleSort(state, key) {
  if (state.key === key) {
    state.dir = state.dir === 'asc' ? 'desc' : 'asc';
  } else {
    state.key = key;
    state.dir = 'asc';
  }
}

function getCurrentUserName() {
  return localStorage.getItem('ti-user') || 'Usuário atual';
}

function loadImportHistory() {
  try {
    return JSON.parse(localStorage.getItem(IMPORT_HISTORY_KEY)) || [];
  } catch (err) {
    return [];
  }
}

function saveImportHistory(items) {
  localStorage.setItem(IMPORT_HISTORY_KEY, JSON.stringify(items));
}

function recordImportHistory(entry) {
  const history = loadImportHistory();
  history.unshift(entry);
  saveImportHistory(history.slice(0, 10));
  renderImportHistory();
}

function formatHistoryDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('pt-BR');
}

function renderImportHistory() {
  const tbody = document.querySelector('#importHistoryTable tbody');
  if (!tbody) return;
  const history = loadImportHistory();
  if (!history.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="padding:12px;color:#94a3b8">Nenhuma importação registrada.</td></tr>';
    return;
  }
  tbody.innerHTML = history.map((item) => `
    <tr>
      <td>${formatHistoryDate(item.date)}</td>
      <td>${escapeHtml(item.user)}</td>
      <td>${escapeHtml(item.file)}</td>
      <td><span class="import-status ${item.status}">${item.statusLabel}</span></td>
      <td class="actions">
        <button class="btn secondary" type="button" onclick="reprocessImport('${item.id}')">Reprocessar</button>
      </td>
    </tr>
  `).join('');
}

function clearImportHistory() {
  saveImportHistory([]);
  renderImportHistory();
}

function getFiltered() {
  const q = (document.getElementById('q')?.value || "").toLowerCase();

  // PEGAR O SELECT APENAS SE EXISTIR (ABA INVENTÁRIO)
  const catEl = document.getElementById('filterCategoryInv');
  const cat = catEl ? catEl.value : "All";
  const valueFilter = (document.getElementById('filterValueInv')?.value || '').trim().toLowerCase();
  const localFilter = (document.getElementById('filterLocalInv')?.value || '').trim().toLowerCase();
  const velFilter = (document.getElementById('filterVelInv')?.value || '').trim().toLowerCase();
  const telFilter = (document.getElementById('filterTelInv')?.value || '').trim().toLowerCase();
  const linkColumnFilter = getInputValue('invFilterLink');
  const velColumnFilter = getInputValue('invFilterVel');
  const telColumnFilter = getInputValue('invFilterTel');
  const localColumnFilter = getInputValue('invFilterLocal');
  const enderecoColumnFilter = getInputValue('invFilterEndereco');

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

  if (localFilter) {
    list = list.filter(x => (x.local || '').toLowerCase().includes(localFilter));
  }

  if (velFilter) {
    list = list.filter(x => (x.velocidade || '').toLowerCase().includes(velFilter));
  }

  if (telFilter) {
    list = list.filter(x => (x.telefone || '').toLowerCase().includes(telFilter));
  }

  if (linkColumnFilter) {
    list = list.filter(x => (x.link || '').toLowerCase().includes(linkColumnFilter));
  }

  if (velColumnFilter) {
    list = list.filter(x => (x.velocidade || '').toLowerCase().includes(velColumnFilter));
  }

  if (telColumnFilter) {
    list = list.filter(x => (x.telefone || '').toLowerCase().includes(telColumnFilter));
  }

  if (localColumnFilter) {
    list = list.filter(x => (x.local || '').toLowerCase().includes(localColumnFilter));
  }

  if (enderecoColumnFilter) {
    list = list.filter(x => (x.endereco || '').toLowerCase().includes(enderecoColumnFilter));
  }

  if (valueFilter) {
    list = list.filter(x => {
      const fields = {
        link: x.link,
        velocidade: x.velocidade,
        telefone: x.telefone,
        local: x.local,
        endereco: x.endereco,
        categoria: x.categoria
      };
      return Object.values(fields).some(val =>
        (val || '').toString().toLowerCase().includes(valueFilter)
      );
    });
  }

  return list;
}

function updateFilterBadge(type, count) {
  const badge = document.querySelector(`[data-filter-badge="${type}"]`);
  if (!badge) return;
  if (count > 0) {
    badge.textContent = String(count);
    badge.classList.remove('hidden');
  } else {
    badge.textContent = '';
    badge.classList.add('hidden');
  }
}

function updateFilterBadges() {
  const q = (document.getElementById('q')?.value || '').trim();
  const cat = (document.getElementById('filterCategoryInv')?.value || 'All');
  const value = (document.getElementById('filterValueInv')?.value || '').trim();
  const local = (document.getElementById('filterLocalInv')?.value || '').trim();
  const vel = (document.getElementById('filterVelInv')?.value || '').trim();
  const tel = (document.getElementById('filterTelInv')?.value || '').trim();
  const invLink = (document.getElementById('invFilterLink')?.value || '').trim();
  const invVel = (document.getElementById('invFilterVel')?.value || '').trim();
  const invTel = (document.getElementById('invFilterTel')?.value || '').trim();
  const invLocal = (document.getElementById('invFilterLocal')?.value || '').trim();
  const invEnd = (document.getElementById('invFilterEndereco')?.value || '').trim();
  const invCount = [q, value, local, vel, tel, invLink, invVel, invTel, invLocal, invEnd].filter(Boolean).length + (cat !== 'All' ? 1 : 0);

  const mq = (document.getElementById('mq')?.value || '').trim();
  const status = (document.getElementById('filterMachineStatus')?.value || 'All');
  const mqLocal = (document.getElementById('filterMachineLocal')?.value || '').trim();
  const mqNome = (document.getElementById('mqFilterNome')?.value || '').trim();
  const mqPatrimonio = (document.getElementById('mqFilterPatrimonio')?.value || '').trim();
  const mqLocalCol = (document.getElementById('mqFilterLocal')?.value || '').trim();
  const mqStatusCol = (document.getElementById('mqFilterStatus')?.value || '').trim();
  const mqDescricao = (document.getElementById('mqFilterDescricao')?.value || '').trim();
  const mqCount = [mq, mqLocal, mqNome, mqPatrimonio, mqLocalCol, mqStatusCol, mqDescricao].filter(Boolean).length + (status !== 'All' ? 1 : 0);

  const modSearch = (document.getElementById('moduloSearch')?.value || '').trim();
  const modValue = (document.getElementById('moduloFilterValue')?.value || '').trim();
  const modColumnFilters = Object.values(moduloColumnFilters || {}).filter(value => value?.trim());
  const modCount = [modSearch, modValue, ...modColumnFilters].filter(Boolean).length;

  updateFilterBadge('inventory', invCount);
  updateFilterBadge('machines', mqCount);
  updateFilterBadge('modules', modCount);
}

function clearInventoryFilters() {
  const catEl = document.getElementById('filterCategoryInv');
  if (catEl) catEl.value = 'All';
  const valueEl = document.getElementById('filterValueInv');
  if (valueEl) valueEl.value = '';
  const localEl = document.getElementById('filterLocalInv');
  if (localEl) localEl.value = '';
  const velEl = document.getElementById('filterVelInv');
  if (velEl) velEl.value = '';
  const telEl = document.getElementById('filterTelInv');
  if (telEl) telEl.value = '';
  const headerFilters = ['invFilterLink', 'invFilterVel', 'invFilterTel', 'invFilterLocal', 'invFilterEndereco'];
  headerFilters.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  applyFilters();
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


  function applyFilters(){
    let filtered = getFiltered();
    if (sortState.inventory.key) {
      const key = sortState.inventory.key;
      filtered = sortWithIndex(filtered, item => item[key], sortState.inventory.dir);
    }
    renderTable(filtered);
    updateSortIndicators('#tb thead', sortState.inventory);
    updateFilterBadges();
  }
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
    focusFirstField(modal);
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
    focusFirstField(modal);
  }
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
  safeAdd('inpTel', 'input', function() { this.value = applyPhoneMask(this.value); });

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

    const missingFields = [];
    if (!link) missingFields.push('Link');
    if (!local) missingFields.push('Local');
    if (missingFields.length) {
      showMessage(`Campo${missingFields.length > 1 ? 's' : ''} obrigatório${missingFields.length > 1 ? 's' : ''}: ${missingFields.join(' e ')}.`);
      return;
    }

    if (telefone && !isValidPhoneNumber(telefone)) {
      showMessage('Telefone inválido. Informe DDD + número (8 a 11 dígitos).');
      return;
    }

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
      showMessage('Erro ao salvar item.');
    }
  }

  async function removeItem(idx){
    const item = data[idx];
    const deletedItem = item ? {
      categoria: item.categoria || '',
      link: item.link || '',
      velocidade: item.velocidade || '',
      telefone: item.telefone || '',
      local: item.local || '',
      endereco: item.endereco || ''
    } : null;
    showConfirm('Remover este registro?', async () => {
      try {
        const id = data[idx].id;
        await fetch(`${API_URL}/${id}`, { method:'DELETE' });
        await fetchData();
        if (deletedItem) {
          showUndoToast({ type: 'inventario', items: [deletedItem] });
        }
      } catch(err){
        console.error('Erro remover item:', err);
        showMessage('Erro ao remover item.');
      }
    }, 'Confirmar exclusão');
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
    showMessage('Nenhum registro para exportar.');
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
    showMessage('Nenhum registro para exportar.');
    return;
  }

  exportInventarioPDF(rows);
  exportInventarioExcel(rows);
}


function exportInventarioPDF(data) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('landscape');
  drawHeader(doc, 'Relatório de Inventários', PREFEITURA_LOGO);

  doc.autoTable({
    startY: 70,
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
      fontSize: 8,
      textColor: [75, 85, 99],
      cellPadding: 3,
      lineColor: [229, 231, 235],
      lineWidth: 0.5,
      halign: 'center'
    },

    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center'
    },

    alternateRowStyles: {
      fillColor: [249, 250, 251]
    },
    columnStyles: {
      1: { halign: 'left', cellWidth: 54 },
      4: { halign: 'left', cellWidth: 30 },
      5: { halign: 'left', cellWidth: 54 }
    }
  });

  drawFooter(doc);
  doc.save('Relatorio_Inventario_TI.pdf');
}


function exportInventarioExcel(rows) {
  const wb = XLSX.utils.book_new();

  const headers = ['Categoria', 'Link', 'Velocidade', 'Telefone', 'Local', 'Endereço'];
  const rowsData = rows.map(r => ([
    r.categoria || '',
    r.link,
    r.velocidade,
    r.telefone,
    r.local,
    r.endereco
  ]));

  const ws = buildExcelSheet({
    title: 'PREFEITURA',
    headers,
    rows: rowsData,
    colWidths: [
      { wch: 20 },
      { wch: 54 },
      { wch: 16 },
      { wch: 16 },
      { wch: 18 },
      { wch: 26 }
    ]
  });

  XLSX.utils.book_append_sheet(wb, ws, 'Inventário TI');

  XLSX.writeFile(
    wb,
    `Relatorio_Inventario_TI_${new Date().toISOString().slice(0,10)}.xlsx`
  );
}

  /* ===========================
     RENDER MÁQUINAS
     =========================== */
  function renderMachines(list){
    mtbody.innerHTML = '';
    if(!list || list.length===0){
      mtbody.innerHTML = `<tr><td colspan="7" style="padding:22px;color:#9fb6d9">Nenhuma máquina encontrada.</td></tr>`;
      return;
    }

    list.forEach((it, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
  <td class="checkbox-cell" style="text-align:center">
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
  const statusFilter = (document.getElementById('filterMachineStatus')?.value || 'All').toLowerCase();
  const localFilter = (document.getElementById('filterMachineLocal')?.value || '').trim().toLowerCase();
  const nomeColumnFilter = getInputValue('mqFilterNome');
  const patrimonioColumnFilter = getInputValue('mqFilterPatrimonio');
  const localColumnFilter = getInputValue('mqFilterLocal');
  const statusColumnFilter = getInputValue('mqFilterStatus');
  const descricaoColumnFilter = getInputValue('mqFilterDescricao');

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

  if (statusFilter !== 'all') {
    list = list.filter(x => (x.status || '').toLowerCase() === statusFilter);
  }

  if (localFilter) {
    list = list.filter(x => (x.local || '').toLowerCase().includes(localFilter));
  }

  if (nomeColumnFilter) {
    list = list.filter(x => (x.nome_maquina || '').toLowerCase().includes(nomeColumnFilter));
  }

  if (patrimonioColumnFilter) {
    list = list.filter(x => (x.patrimonio || '').toLowerCase().includes(patrimonioColumnFilter));
  }

  if (localColumnFilter) {
    list = list.filter(x => (x.local || '').toLowerCase().includes(localColumnFilter));
  }

  if (statusColumnFilter) {
    list = list.filter(x => (x.status || '').toLowerCase().includes(statusColumnFilter));
  }

  if (descricaoColumnFilter) {
    list = list.filter(x => (x.descricao || '').toLowerCase().includes(descricaoColumnFilter));
  }

  if (sortState.machines.key) {
    const key = sortState.machines.key;
    list = sortWithIndex(list, item => item[key], sortState.machines.dir);
  }

  renderMachines(list);
  updateSortIndicators('#tabMaquinas thead', sortState.machines);
  updateFilterBadges();
}

function clearMachineFilters(){
  const mqEl = document.getElementById('mq');
  if (mqEl) mqEl.value = '';
  const statusEl = document.getElementById('filterMachineStatus');
  if (statusEl) statusEl.value = 'All';
  const localEl = document.getElementById('filterMachineLocal');
  if (localEl) localEl.value = '';
  const headerFilters = ['mqFilterNome', 'mqFilterPatrimonio', 'mqFilterLocal', 'mqFilterStatus', 'mqFilterDescricao'];
  headerFilters.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  applyMachineFilters();
  }


const filterCategoryInv = document.getElementById('filterCategoryInv');


  /* ===========================
     MODAL MÁQUINAS
     =========================== */
  const MACHINE_PREFIXES = ['PMSFS-DT', 'SMSSFS-DT'];

  function parseMachineName(nome = '') {
    const trimmed = (nome || '').trim();
    const match = MACHINE_PREFIXES.find(prefix => trimmed.startsWith(`${prefix}-`));
    if (match) {
      return { prefix: match, numero: trimmed.slice(match.length + 1) };
    }
    return { prefix: MACHINE_PREFIXES[0], numero: trimmed };
  }

  function buildMachineName() {
    const prefix = document.getElementById('mNomePrefix')?.value || MACHINE_PREFIXES[0];
    const numero = (document.getElementById('mNomeNumero')?.value || '').trim();
    if (!numero) return '';
    return `${prefix}-${numero}`;
  }

  function openMachineModal(){
    machineEditIndex = -1;
    document.getElementById('machineModalTitle').innerText = 'Nova Máquina';
    
    if(document.getElementById('mNomePrefix')) document.getElementById('mNomePrefix').value = MACHINE_PREFIXES[0];
    if(document.getElementById('mNomeNumero')) document.getElementById('mNomeNumero').value = '';
    if(document.getElementById('mPatrimonio')) document.getElementById('mPatrimonio').value='';
    if(document.getElementById('mLocal')) document.getElementById('mLocal').value='';
    if(document.getElementById('mDescricao')) document.getElementById('mDescricao').value='';
    if (document.getElementById('mStatus')) {
  document.getElementById('mStatus').value = 'Ativa';
}


    showModal(machineModal);
    focusFirstField(machineModal);
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

    const parsedName = parseMachineName(it.nome_maquina || '');
    if(document.getElementById('mNomePrefix')) document.getElementById('mNomePrefix').value = parsedName.prefix;
    if(document.getElementById('mNomeNumero')) document.getElementById('mNomeNumero').value = parsedName.numero;
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
    focusFirstField(machineModal);
  }

  /* ===========================
     CRUD MÁQUINAS
     =========================== */
async function saveMachine(){
  let local = (document.getElementById('mLocal')?.value || '').trim();
  const localOutro = (document.getElementById('mLocalOutro')?.value || '').trim();
  const machineNumber = (document.getElementById('mNomeNumero')?.value || '').trim();

  if (local === 'Outro' && localOutro) {
    local = localOutro;
  }

  const item = {
    nome_maquina: buildMachineName(),
    patrimonio: (document.getElementById('mPatrimonio')?.value || '').trim(),
    local,
    descricao: (document.getElementById('mDescricao')?.value || '').trim(),
    status: document.getElementById('mStatus').value
  };

if(!item.local){
  showMessage("Informe o local da máquina.");
  return;
}

  if(!machineNumber){
    showMessage("Informe o número da máquina.");
    return;
  }

  if (!/^\d+$/.test(machineNumber)) {
    showMessage("Número da máquina inválido. Use apenas números.");
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
    showMessage("Erro ao salvar máquina.");
  }
}


  async function deleteMachine(idx){
    const item = machineData[idx];
    const deletedItem = item ? {
      nome_maquina: item.nome_maquina || '',
      patrimonio: item.patrimonio || '',
      local: item.local || '',
      descricao: item.descricao || '',
      status: item.status || 'Ativa'
    } : null;
    showConfirm('Remover esta máquina?', async () => {
      try{
        const id = machineData[idx].id;
        await fetch(`${API_MAQUINAS}/${id}`, { method:'DELETE' });
        await fetchMachines();
        if (deletedItem) {
          showUndoToast({ type: 'maquinas', items: [deletedItem] });
        }
      } catch(err){
        console.error('Erro deletar máquina:', err);
        showMessage('Erro ao deletar máquina.');
      }
    }, 'Confirmar exclusão');
  }
function drawHeader(doc, titulo, logoBase64) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageMargin = 24;
  const titleY = 52;
  const ruleY = 60;

  /* ===== LOGO ===== */
  if (logoBase64) {
    doc.addImage(
      logoBase64,
      'PNG',
      pageMargin,   // X
      18,   // Y
      16,   // largura
      16    // altura
    );
  }

  /* ===== TEXTO INSTITUCIONAL ===== */
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Prefeitura Municipal de São Francisco do Sul', pageMargin + 22, 26);

  doc.setFontSize(9);
  doc.setFont('Helvetica', 'normal');
  doc.text('Secretaria Municipal de Tecnologia da Informação', pageMargin + 22, 34);

  /* ===== TÍTULO ===== */
  doc.setFontSize(13);
  doc.setFont('Helvetica', 'bold');
  doc.text(titulo, pageWidth / 2, titleY, { align: 'center' });

  /* ===== LINHA ===== */
  doc.setDrawColor(200);
  doc.setLineWidth(0.5);
  doc.line(pageMargin, ruleY, pageWidth - pageMargin, ruleY);
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
    pageHeight - 18,
    { align: 'center' }
  );

  doc.text(
    'Documento oficial gerado pelo Sistema de Inventário de T.I',
    24,
    pageHeight - 18
  );
}
function exportMaquinas(type) {
  const rows = getMaquinasExportData();

  if (!rows.length) {
    showMessage('Nenhuma máquina para exportar.');
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
    showMessage('Nenhuma máquina para exportar.');
    return;
  }

  exportMaquinasPDF(rows);
  exportMaquinasExcel(rows);
}

function exportMaquinasPDF(data) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('landscape');
  drawHeader(doc, 'Relatório de Máquinas', PREFEITURA_LOGO);

  doc.autoTable({
    startY: 70,
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
      fontSize: 8,
      textColor: [75, 85, 99],
      cellPadding: 3,
      lineColor: [229, 231, 235],
      lineWidth: 0.5,
      halign: 'center'
    },

    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center'
    },

    alternateRowStyles: {
      fillColor: [249, 250, 251]
    },
    columnStyles: {
      0: { halign: 'left', cellWidth: 42 },
      2: { halign: 'left', cellWidth: 34 },
      4: { halign: 'left', cellWidth: 70 }
    }
  });

  drawFooter(doc);
  doc.save('Relatorio_Maquinas_TI.pdf');
}


function exportMaquinasExcel(rows) {
  const wb = XLSX.utils.book_new();

  const headers = ['Nome da Máquina', 'Patrimônio', 'Local', 'Status', 'Descrição'];
  const rowsData = rows.map(r => ([
    r.nome_maquina,
    r.patrimonio,
    r.local,
    r.status,
    r.descricao
  ]));

  const ws = buildExcelSheet({
    title: 'PREFEITURA',
    headers,
    rows: rowsData,
    colWidths: [
      { wch: 30 },
      { wch: 16 },
      { wch: 20 },
      { wch: 14 },
      { wch: 40 }
    ]
  });

  XLSX.utils.book_append_sheet(wb, ws, 'Máquinas');

  XLSX.writeFile(
    wb,
    `Relatorio_Maquinas_TI_${new Date().toISOString().slice(0, 10)}.xlsx`
  );
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

let undoState = { timer: null, payload: null };

function hideUndoToast() {
  const toast = document.getElementById('undoToast');
  if (toast) toast.classList.add('hidden');
  if (undoState.timer) clearTimeout(undoState.timer);
  undoState = { timer: null, payload: null };
}

async function restoreDeletedItems(payload) {
  if (!payload) return;
  try {
    if (payload.type === 'inventario') {
      await Promise.all(payload.items.map(item =>
        fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item)
        })
      ));
      await fetchData();
    } else if (payload.type === 'maquinas') {
      await Promise.all(payload.items.map(item =>
        fetch(API_MAQUINAS, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item)
        })
      ));
      await fetchMachines();
    } else if (payload.type === 'modulo') {
      await Promise.all(payload.items.map(item =>
        fetch(`${API_MODULOS}/${payload.moduloId}/registros`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ valores: item })
        })
      ));
      await carregarRegistrosModulo();
      renderModuloDinamico();
    }
    showMessage('Exclusão desfeita com sucesso.');
  } catch (err) {
    console.error('Erro ao desfazer exclusão:', err);
    showMessage('Não foi possível desfazer a exclusão.');
  } finally {
    hideUndoToast();
  }
}

function showUndoToast(payload) {
  const toast = document.getElementById('undoToast');
  const text = document.getElementById('undoToastText');
  const button = document.getElementById('undoToastButton');
  if (!toast || !text || !button) return;

  const count = payload.items.length;
  text.textContent = `${count} item${count > 1 ? 's' : ''} excluído${count > 1 ? 's' : ''}.`;
  button.onclick = () => restoreDeletedItems(payload);

  toast.classList.remove('hidden');
  if (undoState.timer) clearTimeout(undoState.timer);
  undoState = {
    payload,
    timer: setTimeout(() => hideUndoToast(), 6000)
  };
}
async function deleteSelected() {
  const isInventario = selectedInvIds.size > 0;
  const isMaquinas = !isInventario && selectedMaqIds.size > 0;
  const isModulo = !isInventario && !isMaquinas && selectedModuloIds.size > 0;
  const ids = isInventario
    ? [...selectedInvIds]
    : isMaquinas
      ? [...selectedMaqIds]
      : [...selectedModuloIds];

  if (!ids.length) return;

  const deletedItems = isInventario
    ? data.filter(item => ids.includes(item.id)).map(item => ({
      categoria: item.categoria || '',
      link: item.link || '',
      velocidade: item.velocidade || '',
      telefone: item.telefone || '',
      local: item.local || '',
      endereco: item.endereco || ''
    }))
    : isMaquinas
      ? machineData.filter(item => ids.includes(item.id)).map(item => ({
        nome_maquina: item.nome_maquina || '',
        patrimonio: item.patrimonio || '',
        local: item.local || '',
        descricao: item.descricao || '',
        status: item.status || 'Ativa'
      }))
      : moduloRegistros
        .filter(item => ids.includes(item.id))
        .map(item => {
          const valores = {};
          moduloCampos.forEach(campo => {
            valores[campo.nome] = item[campo.nome] ?? '';
          });
          return valores;
        });

  showConfirm(`Excluir ${ids.length} item(ns)?`, async () => {
    try {
      if (isModulo && !moduloAtual?.id) {
        showMessage('Selecione uma aba personalizada.');
        return;
      }
      for (const id of ids) {
        const url = isInventario
          ? `${API_URL}/${id}`
          : isMaquinas
            ? `${API_MAQUINAS}/${id}`
            : `${API_MODULOS}/${moduloAtual.id}/registros/${id}`;

        await fetch(url, { method: 'DELETE' });
      }

      selectedInvIds.clear();
      selectedMaqIds.clear();
      selectedModuloIds.clear();
      updateBulkUI();

      if (isInventario) {
        fetchData();
      } else if (isMaquinas) {
        fetchMachines();
      } else if (isModulo) {
        await carregarRegistrosModulo();
        renderModuloDinamico();
      }

      if (deletedItems.length) {
        showUndoToast({
          type: isInventario ? 'inventario' : isMaquinas ? 'maquinas' : 'modulo',
          items: deletedItems,
          moduloId: moduloAtual?.id
        });
      }

    } catch (err) {
      console.error('Erro ao excluir selecionados:', err);
      showMessage('Erro ao excluir itens.');
    }
  }, 'Confirmar exclusão');
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
  const mod = document.getElementById('exportMenuMod');

  if (tipo === 'inv') {
    inv.classList.toggle('hidden');
    mq.classList.add('hidden');
    mod?.classList.add('hidden');
  } else if (tipo === 'mq') {
    mq.classList.toggle('hidden');
    inv.classList.add('hidden');
    mod?.classList.add('hidden');
  } else if (tipo === 'mod') {
    mod?.classList.toggle('hidden');
    inv.classList.add('hidden');
    mq.classList.add('hidden');
  }
}
function openImportModal(type) {
  importType = type;
  importRows = [];
  importHeaders = [];
  importFileName = '';

  document.getElementById('importTitle').innerText =
    type === 'inventario'
      ? 'Importar Inventário (Links)'
      : type === 'maquinas'
        ? 'Importar Máquinas'
        : `Importar ${moduloAtual?.nome || 'Módulo'}`;

  document.getElementById('importPreviewTable').querySelector('thead').innerHTML = '';
  document.getElementById('importPreviewTable').querySelector('tbody').innerHTML = '';
  document.getElementById('importFile').value = '';
  const fileName = document.getElementById('importFileName');
  if (fileName) fileName.textContent = 'Nenhum arquivo selecionado';
  const validationEl = document.getElementById('importValidation');
  if (validationEl) {
    validationEl.classList.add('hidden');
    validationEl.innerHTML = '';
  }
  document.getElementById('importStepUpload')?.classList.remove('hidden');
  document.getElementById('importStepPreview')?.classList.add('hidden');
  const actionBtn = document.getElementById('importActionBtn');
  if (actionBtn) {
    actionBtn.textContent = 'Confirmar Importação';
    actionBtn.disabled = false;
  }
  openModalById('importModal');
  renderImportHistory();


}

function closeImportModal() {
  document.getElementById('importModal').classList.remove('show');
  document.getElementById('importStepPreview')?.classList.add('hidden');
  document.getElementById('importStepUpload')?.classList.remove('hidden');
  importFileName = '';
  const validationEl = document.getElementById('importValidation');
  if (validationEl) {
    validationEl.classList.add('hidden');
    validationEl.innerHTML = '';
  }
  const fileName = document.getElementById('importFileName');
  if (fileName) fileName.textContent = 'Nenhum arquivo selecionado';
  const actionBtn = document.getElementById('importActionBtn');
  if (actionBtn) {
    actionBtn.textContent = 'Confirmar Importação';
    actionBtn.disabled = false;
  }
}

function closeImportModalIfClicked(e) {
  if (e.target.id === 'importModal') closeImportModal();
}
function handleImportFile() {
  const file = document.getElementById('importFile').files[0];
  const fileName = document.getElementById('importFileName');
  importFileName = file?.name || '';
  if (fileName) {
    fileName.textContent = file?.name || 'Nenhum arquivo selecionado';
  }
  if (!file) return;

  const reader = new FileReader();

  reader.onload = (e) => {
    const wb = XLSX.read(e.target.result, { type: 'binary' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
    const cleaned = data.map(row => (row || []).map(cell => (cell ?? '').toString().trim()));
    const validHeaders = {
      inventario: ['categoria', 'link', 'link de internet', 'descricao', 'descrição', 'quantidade', 'velocidade', 'telefone', 'local', 'endereco', 'endereço', 'observacoes', 'observações'],
      maquinas: ['nome', 'maquina', 'máquina', 'nome maquina', 'nome da maquina', 'patrimonio', 'patrimônio', 'local', 'status', 'descricao', 'descrição', 'observacoes', 'observações'],
      modulo: (moduloCampos || []).map(c => normalizeHeader(c.nome))
    };

    const headerCandidates = cleaned.map((row, index) => {
      const normalized = row.map(cell => normalizeHeader(cell));
      const nonEmptyCount = normalized.filter(cell => cell).length;
      const score = normalized.reduce((acc, cell) => {
        if (!cell) return acc;
        const list = validHeaders[importType] || [];
        return list.includes(cell) ? acc + 1 : acc;
      }, 0);
      return { index, score, row, normalized, nonEmptyCount };
    });

    const bestCandidate = headerCandidates
      .filter(item => item.score > 0 && item.nonEmptyCount > 0)
      .sort((a, b) => (b.score - a.score) || (b.nonEmptyCount - a.nonEmptyCount))[0];

    if (!bestCandidate) {
      const fallbackIndex = cleaned.findIndex(row => row.filter(cell => cell).length > 1);
      const headerIndex = fallbackIndex >= 0 ? fallbackIndex : cleaned.findIndex(row => row.some(cell => cell));
      importHeaders = headerIndex >= 0 ? cleaned[headerIndex] : [];
      importRows = cleaned
        .slice((headerIndex >= 0 ? headerIndex + 1 : 0))
        .filter(row => row.some(cell => `${cell ?? ''}`.trim() !== ''));
      renderImportPreview();
      return;
    }

    importHeaders = bestCandidate.row;
    importRows = cleaned
      .slice(bestCandidate.index + 1)
      .filter(row => row.some(cell => `${cell ?? ''}`.trim() !== ''))
      .filter(row => {
        const normalizedRow = row.map(cell => normalizeHeader(cell));
        return normalizedRow.join('|') !== bestCandidate.normalized.join('|');
      });

    renderImportPreview();
  };

  reader.readAsBinaryString(file);
}

function getImportSchema() {
  if (importType === 'inventario') {
    return {
      required: [
        { label: 'Link', keys: ['link', 'link de internet', 'internet', 'descricao', 'descrição'], fallbackIndex: 0 },
        { label: 'Local', keys: ['local'], fallbackIndex: 4 }
      ]
    };
  }

  if (importType === 'maquinas') {
    return {
      required: [
        { label: 'Nome da Máquina', keys: ['nome', 'nome maquina', 'nome da maquina', 'maquina', 'máquina'], fallbackIndex: 0 },
        { label: 'Local', keys: ['local'], fallbackIndex: 2 }
      ]
    };
  }

  return { required: [] };
}

function resolveImportColumnIndex(headerMap, keys, fallbackIndex) {
  for (const key of keys) {
    const idx = headerMap[normalizeHeader(key)];
    if (idx !== undefined) return idx;
  }
  if (fallbackIndex !== undefined && fallbackIndex < importHeaders.length) {
    return fallbackIndex;
  }
  return null;
}

function validateImportRows() {
  if (importType === 'modulo') {
    return { issues: [], cellIssues: new Set(), errorCount: 0 };
  }

  const headerMap = importHeaders.reduce((acc, header, idx) => {
    const key = normalizeHeader(header);
    if (key) acc[key] = idx;
    return acc;
  }, {});

  const schema = getImportSchema();
  const issues = [];
  const cellIssues = new Set();
  let errorCount = 0;

  const resolved = schema.required.map(req => {
    const idx = resolveImportColumnIndex(headerMap, req.keys, req.fallbackIndex);
    if (idx === null) {
      issues.push(`Coluna obrigatória não encontrada: ${req.label}.`);
    }
    return { ...req, idx };
  });

  importRows.forEach((row, rowIdx) => {
    resolved.forEach(req => {
      if (req.idx === null) return;
      const value = (row[req.idx] ?? '').toString().trim();
      if (!value) {
        cellIssues.add(`${rowIdx}-${req.idx}`);
        errorCount += 1;
      }
    });
  });

  return { issues, cellIssues, errorCount };
}
function renderImportPreview() {
  const thead = document.querySelector('#importPreviewTable thead');
  const tbody = document.querySelector('#importPreviewTable tbody');
  const preview = document.getElementById('importStepPreview');
  const actionBtn = document.getElementById('importActionBtn');
  const uploadStep = document.getElementById('importStepUpload');
  const validationEl = document.getElementById('importValidation');

  thead.innerHTML = `
    <tr>
      ${importHeaders.map(h => `<th>${h}</th>`).join('')}
      <th>Ação</th>
    </tr>
  `;

  tbody.innerHTML = '';

  const validation = validateImportRows();
  const cellIssues = validation.cellIssues;

  importRows.forEach((row, idx) => {
    const tr = document.createElement('tr');

    tr.innerHTML = `
      ${row.map((cell, cidx) => `
        <td contenteditable="true"
            data-row="${idx}"
            data-col="${cidx}"
            class="${cellIssues.has(`${idx}-${cidx}`) ? 'import-error' : ''}"
            oninput="updateImportCell(${idx}, ${cidx}, this.innerText)">
          ${cell ?? ''}
        </td>
      `).join('')}
      <td>
        <button class="icon-btn delete" onclick="removeImportRow(${idx})">
          <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18"/>
            <path d="M8 6v14"/>
            <path d="M16 6v14"/>
            <path d="M5 6l1 16h12l1-16"/>
            <path d="M9 6V4h6v2"/>
          </svg>
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  });

  preview?.classList.remove('hidden');
  uploadStep?.classList.add('hidden');
  if (actionBtn) {
    actionBtn.textContent = `Importar ${importRows.length} linha(s)`;
    actionBtn.disabled = false;
  }

  if (validationEl) {
    if (validation.issues.length || validation.errorCount > 0) {
      const issuesText = validation.issues.length
        ? `<div>Campos ausentes serão importados em branco:</div><ul>${validation.issues.map(issue => `<li>${issue}</li>`).join('')}</ul>`
        : '';
      const rowsText = validation.errorCount > 0
        ? `<div>Existem ${validation.errorCount} célula(s) obrigatória(s) vazia(s). Você pode importar e editar depois.</div>`
        : '';
      validationEl.innerHTML = `${issuesText}${rowsText}`;
      validationEl.classList.remove('hidden');
    } else {
      validationEl.classList.add('hidden');
      validationEl.innerHTML = '';
    }
  }
}

function updateImportCell(row, col, value) {
  importRows[row][col] = value;
  applyImportValidation();
}

function removeImportRow(index) {
  importRows.splice(index, 1);
  renderImportPreview();
}

function applyImportValidation() {
  const validation = validateImportRows();
  const validationEl = document.getElementById('importValidation');
  const actionBtn = document.getElementById('importActionBtn');

  document.querySelectorAll('#importPreviewTable tbody td[data-row]').forEach(td => {
    const key = `${td.dataset.row}-${td.dataset.col}`;
    td.classList.toggle('import-error', validation.cellIssues.has(key));
  });

  if (actionBtn) {
    actionBtn.disabled = false;
  }

  if (validationEl) {
    if (validation.issues.length || validation.errorCount > 0) {
      const issuesText = validation.issues.length
        ? `<div>Campos ausentes serão importados em branco:</div><ul>${validation.issues.map(issue => `<li>${issue}</li>`).join('')}</ul>`
        : '';
      const rowsText = validation.errorCount > 0
        ? `<div>Existem ${validation.errorCount} célula(s) obrigatória(s) vazia(s). Você pode importar e editar depois.</div>`
        : '';
      validationEl.innerHTML = `${issuesText}${rowsText}`;
      validationEl.classList.remove('hidden');
    } else {
      validationEl.classList.add('hidden');
      validationEl.innerHTML = '';
    }
  }
}
function mapImportRows() {
  const headerMap = importHeaders.reduce((acc, header, idx) => {
    const key = normalizeHeader(header);
    if (key) acc[key] = idx;
    return acc;
  }, {});

  const getValue = (row, keys, fallbackIndex) => {
    for (const key of keys) {
      const idx = headerMap[normalizeHeader(key)];
      if (idx !== undefined) return row[idx];
    }
    return row[fallbackIndex];
  };

  if (importType === 'inventario') {
    return importRows.map(r => ({
      categoria: getValue(r, ['categoria'], 0),
      link: getValue(r, ['link', 'link de internet', 'internet', 'descricao', 'descrição'], 0),
      velocidade: getValue(r, ['velocidade', 'velocidade dl/ul', 'download', 'upload'], 2),
      telefone: getValue(r, ['telefone', 'contato'], 3),
      local: getValue(r, ['local'], 4),
      endereco: getValue(r, ['endereco', 'endereço'], 5)
    }));
  }

  if (importType === 'maquinas') {
    return importRows.map(r => ({
      nome_maquina: getValue(r, ['nome', 'nome maquina', 'nome da maquina', 'máquina', 'maquina'], 0),
      patrimonio: getValue(r, ['patrimonio', 'patrimônio'], 1),
      local: getValue(r, ['local'], 2),
      status: getValue(r, ['status'], 3),
      descricao: getValue(r, ['descricao', 'descrição'], 4)
    }));
  }

  return [];
}

function mapModuloImportRows() {
  const headerMap = {};
  importHeaders.forEach((h, idx) => {
    const key = normalizeHeader(h);
    if (key) headerMap[key] = idx;
  });

  const camposMap = moduloCampos.map(c => ({
    nome: c.nome,
    key: normalizeHeader(c.nome)
  }));

  return importRows.map((row) => {
    const valores = {};
    camposMap.forEach(campo => {
      const idx = headerMap[campo.key];
      valores[campo.nome] = idx !== undefined ? row[idx] : '';
    });
    return valores;
  });
}

async function runModuloImport(rows, moduleId) {
  let successCount = 0;
  const errors = [];

  for (let i = 0; i < rows.length; i++) {
    try {
      await fetch(`${API_MODULOS}/${moduleId}/registros`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valores: rows[i] })
      });
      successCount += 1;
    } catch (err) {
      errors.push({ linha: i + 2, erro: err.message });
    }
  }

  return { successCount, errorCount: errors.length, errors };
}

async function executeImport({ type, rows, moduleId }) {
  if (type === 'modulo') {
    const result = await runModuloImport(rows, moduleId);
    return {
      status: result.errorCount > 0 ? 'warning' : 'success',
      statusLabel: result.errorCount > 0 ? 'Com avisos' : 'Concluída',
      ...result
    };
  }

  const url =
    type === 'inventario'
      ? `${API_BASE}/import/inventario`
      : `${API_BASE}/import/maquinas`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows })
  });

  const result = await res.json();

  if (result.errors?.length) {
    return {
      status: 'warning',
      statusLabel: 'Com avisos',
      errorCount: result.errors.length,
      result
    };
  }

  return { status: 'success', statusLabel: 'Concluída', errorCount: 0, result };
}

async function reprocessImport(id) {
  const history = loadImportHistory();
  const entry = history.find(item => item.id === id);
  if (!entry) {
    showMessage('Importação não encontrada no histórico.');
    return;
  }

  try {
    const result = await executeImport({
      type: entry.type,
      rows: entry.rows || [],
      moduleId: entry.moduleId
    });

    recordImportHistory({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      date: new Date().toISOString(),
      user: getCurrentUserName(),
      file: `Reprocessado: ${entry.file}`,
      status: result.status,
      statusLabel: result.statusLabel,
      type: entry.type,
      rows: entry.rows || [],
      moduleId: entry.moduleId || null
    });

    if (entry.type === 'modulo') {
      await carregarRegistrosModulo();
      renderModuloDinamico();
    } else {
      await fetchData();
      await fetchMachines();
    }

    showMessage(`Reprocessamento concluído (${result.statusLabel}).`);
  } catch (err) {
    console.error(err);
    showMessage('Erro ao reprocessar importação.');
    recordImportHistory({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      date: new Date().toISOString(),
      user: getCurrentUserName(),
      file: `Reprocessado: ${entry.file}`,
      status: 'error',
      statusLabel: 'Falhou',
      type: entry.type,
      rows: entry.rows || [],
      moduleId: entry.moduleId || null
    });
  }
}

function normalizeHeader(value = '') {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function columnLetter(index) {
  let result = '';
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}
async function confirmImport() {
  const validation = validateImportRows();
  if (validation.issues.length || validation.errorCount > 0) {
    showImportWarning('Existem campos obrigatórios vazios. Você pode importar e ajustar depois.');
  }
  if (importType === 'modulo' && !moduloAtual?.id) {
    showImportWarning('Selecione uma aba personalizada antes de importar.');
    return;
  }
  const rows = importType === 'modulo' ? mapModuloImportRows() : mapImportRows();
  const fileName = importFileName || 'Importação manual';

  if (!rows.length) {
    showImportWarning('Nenhum dado para importar.');
    return;
  }

  try {
    const result = await executeImport({
      type: importType,
      rows,
      moduleId: importType === 'modulo' ? moduloAtual?.id : null
    });

    if (result.status === 'warning') {
      showImportWarning(`Importação concluída com ${result.errorCount || result.errors?.length || 0} erro(s).`);
      if (result.errors?.length) console.table(result.errors);
    } else {
      showMessage('Importação realizada com sucesso!');
    }

    recordImportHistory({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      date: new Date().toISOString(),
      user: getCurrentUserName(),
      file: fileName,
      status: result.status,
      statusLabel: result.statusLabel,
      type: importType,
      rows,
      moduleId: importType === 'modulo' ? moduloAtual?.id : null
    });

    closeImportModal();

    if (importType === 'modulo') {
      await carregarRegistrosModulo();
      renderModuloDinamico();
    } else {
      await fetchData();
      await fetchMachines();
    }
  } catch (err) {
    console.error(err);
    showMessage('Erro ao importar dados.');
    recordImportHistory({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      date: new Date().toISOString(),
      user: getCurrentUserName(),
      file: fileName,
      status: 'error',
      statusLabel: 'Falhou',
      type: importType,
      rows,
      moduleId: importType === 'modulo' ? moduloAtual?.id : null
    });
  }
}

async function importarRegistrosModulo() {
  if (!moduloAtual?.id) {
    showImportWarning('Selecione uma aba personalizada antes de importar.');
    return;
  }

  if (!importRows.length) {
    showImportWarning('Nenhum dado para importar.');
    return;
  }

  const headerMap = {};
  importHeaders.forEach((h, idx) => {
    const key = normalizeHeader(h);
    if (key) headerMap[key] = idx;
  });

  const camposMap = moduloCampos.map(c => ({
    nome: c.nome,
    key: normalizeHeader(c.nome)
  }));

  const hasMatch = camposMap.some(c => headerMap[c.key] !== undefined);
  if (!hasMatch) {
    showImportWarning('Os cabeçalhos da planilha não correspondem aos campos do módulo. Os dados serão importados em branco para os campos ausentes.');
  }

  const rows = mapModuloImportRows();
  const result = await executeImport({ type: 'modulo', rows, moduleId: moduloAtual.id });

  if (result.errorCount > 0) {
    console.table(result.errors);
    showMessage(`Importação concluída com ${result.errorCount} erro(s).`);
  } else {
    showMessage(`Importação concluída: ${result.successCount} registro(s).`);
  }

  await carregarRegistrosModulo();
  renderModuloDinamico();
}

function exportModulo(tipo) {
  if (!moduloCampos.length || !moduloRegistros.length) {
    showMessage('Nenhum registro para exportar.');
    return;
  }

  if (tipo === 'excel') {
    exportModuloExcel();
  } else if (tipo === 'pdf') {
    exportModuloPDF();
  } else if (tipo === 'both') {
    exportModuloPDF();
    exportModuloExcel();
  }
}

function exportModuloExcel() {
  const headers = moduloCampos.map(c => c.nome);
  const rows = moduloRegistros.map(row => (
    headers.map(h => row[h] || '')
  ));

  const worksheet = buildExcelSheet({
    title: (moduloAtual?.nome || 'Prefeitura').toUpperCase(),
    headers,
    rows
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Modulo');

  XLSX.writeFile(
    workbook,
    `${moduloAtual?.nome || 'modulo'}_${new Date().toISOString().slice(0, 10)}.xlsx`
  );
}

function exportModuloPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('landscape');
  const headers = moduloCampos.map(c => c.nome);
  const data = moduloRegistros.map(row =>
    headers.map(h => row[h] || '')
  );

  drawHeader(doc, `Relatório de ${moduloAtual?.nome || 'Módulo'}`, PREFEITURA_LOGO);

  doc.autoTable({
    startY: 70,
    head: [headers],
    body: data,
    theme: 'grid',
    styles: {
      fontSize: 8,
      textColor: [75, 85, 99],
      cellPadding: 3,
      lineColor: [229, 231, 235],
      lineWidth: 0.5,
      halign: 'center',
      cellWidth: 'wrap'
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center'
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251]
    }
  });

  drawFooter(doc);
  doc.save(`Relatorio_${moduloAtual?.nome || 'modulo'}_TI.pdf`);
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
  const addButton = nav.querySelector('.btn-add-tab');

  // remove abas dinâmicas antigas
  nav.querySelectorAll('.tab-dinamica').forEach(e => e.remove());
  nav.querySelectorAll('.tab-dinamica-wrapper').forEach(e => e.remove());

  modulos.forEach(mod => {
    const wrapper = document.createElement('div');
    wrapper.className = 'tab-dinamica-wrapper';

    const a = document.createElement('a');
    a.className = 'tab-dinamica';
    a.dataset.moduloId = mod.id;
    a.textContent = mod.nome;

   a.onclick = () => {
  // marca active no menu
  document.querySelectorAll('.nav a, .nav .tab-dinamica').forEach(x => x.classList.remove('active'));
  a.classList.add('active');
  abrirModulo(mod);
};

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'tab-delete';
    deleteBtn.title = 'Excluir aba';
    deleteBtn.innerHTML = '✕';
    deleteBtn.onclick = async (e) => {
      e.stopPropagation();
      openConfirmDeleteModulo(mod);
    };

    wrapper.appendChild(a);
    wrapper.appendChild(deleteBtn);
    if (addButton) {
      nav.insertBefore(wrapper, addButton);
    } else {
      nav.appendChild(wrapper);
    }
  });
}

function openConfirmDeleteModulo(mod) {
  moduloDeleteTarget = mod;
  const text = document.getElementById('confirmDeleteModuloText');
  if (text) {
    text.textContent = `Tem certeza que deseja excluir a aba "${mod.nome}"?`;
  }
  openModalById('confirmDeleteModuloModal');
}

function closeConfirmDeleteModulo(e) {
  if (!e || e.target.id === 'confirmDeleteModuloModal') {
    document.getElementById('confirmDeleteModuloModal').classList.remove('show');
  }
}

async function confirmDeleteModulo() {
  if (!moduloDeleteTarget) return;

  try {
    await fetch(`${API_MODULOS}/${moduloDeleteTarget.id}`, { method: 'DELETE' });
    await carregarModulos();

    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    switchTab('inventario');
  } catch (e) {
    console.error('Erro ao excluir módulo:', e);
    showMessage('Erro ao excluir a aba.');
  } finally {
    moduloDeleteTarget = null;
    closeConfirmDeleteModulo();
  }
}

async function abrirModulo(mod) {
  moduloAtual = mod;

  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav a, .nav .tab-dinamica').forEach(a => a.classList.remove('active'));
  const activeTab = document.querySelector(`.nav [data-modulo-id="${mod.id}"]`);
  if (activeTab) activeTab.classList.add('active');

  document.getElementById('moduloTitulo').textContent = mod.nome;
  document.getElementById('moduloDescricao').textContent = mod.descricao || 'Tabela personalizada';

  await carregarCamposModulo();
  await carregarRegistrosModulo();

  renderModuloDinamico();
}

async function carregarCamposModulo() {
  const res = await fetch(`${API_MODULOS}/${moduloAtual.id}/campos`);
  moduloCampos = await res.json();
}

async function carregarRegistrosModulo() {
  const colspan = (moduloCampos?.length || 0) + 2;
  if (colspan > 1) {
    setTableLoading('moduloTbody', true, colspan);
  }
  const res = await fetch(`${API_MODULOS}/${moduloAtual.id}/registros`);
  moduloRegistros = await res.json();
}

function renderModuloDinamico() {
  const tab = document.getElementById('tabModuloDinamico');
  const thead = document.getElementById('moduloThead');
  const tbody = document.getElementById('moduloTbody');

  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');

  const filtered = getModuloFiltrado();

  // HEADER
  thead.innerHTML = `
    <tr>
      <th class="checkbox-cell">
        <input type="checkbox" id="chkAllMod">
      </th>
      ${moduloCampos.map(c => `
        <th class="sortable" data-sort-key="${c.nome}">
          ${c.nome} <span class="sort-indicator"></span>
        </th>
      `).join('')}
      <th class="actions-header">Ações</th>
    </tr>
    <tr class="table-filters">
      <th class="checkbox-cell"></th>
      ${moduloCampos.map(c => `
        <th>
          <input
            class="table-filter-input"
            data-field="${c.nome}"
            placeholder="Filtrar ${c.nome}"
          />
        </th>
      `).join('')}
      <th></th>
    </tr>
  `;

  thead.querySelectorAll('.table-filter-input').forEach((input) => {
    const field = input.dataset.field;
    input.value = moduloColumnFilters[field] || '';
    input.addEventListener('input', (event) => {
      const field = event.target.dataset.field;
      moduloColumnFilters[field] = event.target.value;
      filtrarModulo();
    });
  });

  thead.querySelectorAll('.sortable').forEach((th) => {
    th.addEventListener('click', () => {
      toggleSort(moduloSortState, th.dataset.sortKey);
      renderModuloDinamico();
    });
  });

  updateSortIndicators('#moduloThead', moduloSortState);

  // BODY
  tbody.innerHTML = '';

  let sorted = filtered;
  if (moduloSortState.key) {
    const key = moduloSortState.key;
    const dir = moduloSortState.dir;
    sorted = [...filtered].sort((a, b) => {
      const av = normalizeSortValue(a.row?.[key]);
      const bv = normalizeSortValue(b.row?.[key]);
      if (av < bv) return dir === 'asc' ? -1 : 1;
      if (av > bv) return dir === 'asc' ? 1 : -1;
      return a.idx - b.idx;
    });
  }

  if (!sorted.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="${moduloCampos.length + 2}" style="padding:22px;color:#9fb6d9">
          Nenhum registro encontrado.
        </td>
      </tr>`;
    const chkAllMod = document.getElementById('chkAllMod');
    if (chkAllMod) chkAllMod.checked = false;
    updateBulkUI();
    return;
  }

  sorted.forEach(({ row, idx }) => {
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td class="checkbox-cell">
        <input
          type="checkbox"
          class="chk-mod"
          data-id="${row.id}"
          ${selectedModuloIds.has(row.id) ? 'checked' : ''}
        >
      </td>
      ${moduloCampos.map(c => `
        <td>${renderModuloCell(c.nome, row[c.nome])}</td>
      `).join('')}
      <td class="actions">
        <div class="action-group">
          <button class="icon-btn edit mod-edit" title="Editar" data-idx="${idx}">
            <svg viewBox="0 0 24 24">
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"/>
              <path d="M14.06 4.94l3.75 3.75"/>
            </svg>
          </button>
          <button class="icon-btn delete mod-delete" title="Excluir" data-id="${row.id}">
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

  tbody.querySelectorAll('.mod-edit').forEach(btn => {
    btn.onclick = (e) => editarRegistroModulo(Number(e.currentTarget.dataset.idx));
  });
  tbody.querySelectorAll('.mod-delete').forEach(btn => {
    btn.onclick = (e) => excluirRegistroModulo(Number(e.currentTarget.dataset.id));
  });

  const chkAllMod = document.getElementById('chkAllMod');
  if (chkAllMod) {
    chkAllMod.onchange = (e) => {
      selectedModuloIds.clear();

      tbody.querySelectorAll('.chk-mod').forEach(chk => {
        chk.checked = e.target.checked;
        if (e.target.checked) {
          selectedModuloIds.add(Number(chk.dataset.id));
        }
      });

      updateBulkUI();
    };

    const total = tbody.querySelectorAll('.chk-mod').length;
    chkAllMod.checked = total > 0 && selectedModuloIds.size === total;
  }
}

const moduloTbody = document.getElementById('moduloTbody');
if (moduloTbody) {
  moduloTbody.addEventListener('change', (e) => {
    if (!e.target.classList.contains('chk-mod')) return;

    const id = Number(e.target.dataset.id);

    if (e.target.checked) {
      selectedModuloIds.add(id);
    } else {
      selectedModuloIds.delete(id);
      const chkAllMod = document.getElementById('chkAllMod');
      if (chkAllMod) chkAllMod.checked = false;
    }

    updateBulkUI();
  });
}

function renderModuloCell(fieldName, value) {
  const label = (value ?? '').toString();
  const formatted = formatDateForTable(label);
  const normalizedField = (fieldName || '').toString().toLowerCase();
  if (normalizedField.includes('status')) {
    const display = label || 'Ativa';
    return `
      <div class="status-pill status-${normalizeStatus(display)}">
        <span class="status-dot"></span>
        <span class="status-text">${escapeHtml(display)}</span>
      </div>
    `;
  }
  return escapeHtml(formatted);
}

function formatDateForTable(value) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T|\s)/);
  if (!match) return value;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function getModuloFiltrado() {
  const q = (document.getElementById('moduloSearch')?.value || '').trim().toLowerCase();
  const valueFilter = (document.getElementById('moduloFilterValue')?.value || '').trim().toLowerCase();
  const columnFilters = Object.entries(moduloColumnFilters)
    .filter(([, value]) => value && value.trim())
    .map(([field, value]) => [field, value.trim().toLowerCase()]);
  if (!q) {
    let filtered = moduloRegistros.map((row, idx) => ({ row, idx }));
    if (valueFilter) {
      filtered = filtered.filter(({ row }) =>
        moduloCampos.some(campo =>
          (row[campo.nome] || '').toString().toLowerCase().includes(valueFilter)
        )
      );
    }
    if (columnFilters.length) {
      filtered = filtered.filter(({ row }) =>
        columnFilters.every(([field, value]) =>
          (row[field] || '').toString().toLowerCase().includes(value)
        )
      );
    }
    return filtered;
  }

  let filtered = moduloRegistros
    .map((row, idx) => ({ row, idx }))
    .filter(({ row }) =>
      moduloCampos.some(campo =>
        (row[campo.nome] || '').toString().toLowerCase().includes(q)
      )
    );
  if (valueFilter) {
    filtered = filtered.filter(({ row }) =>
      moduloCampos.some(campo =>
        (row[campo.nome] || '').toString().toLowerCase().includes(valueFilter)
      )
    );
  }
  if (columnFilters.length) {
    filtered = filtered.filter(({ row }) =>
      columnFilters.every(([field, value]) =>
        (row[field] || '').toString().toLowerCase().includes(value)
      )
    );
  }
  return filtered;
}

function clearModuloFilters() {
  const searchEl = document.getElementById('moduloSearch');
  if (searchEl) searchEl.value = '';
  const valueEl = document.getElementById('moduloFilterValue');
  if (valueEl) valueEl.value = '';
  moduloColumnFilters = {};
  document.querySelectorAll('#moduloThead .table-filter-input').forEach((input) => {
    input.value = '';
  });
  filtrarModulo();
}

function filtrarModulo() {
  renderModuloDinamico();
  updateFilterBadges();
}
async function excluirRegistroModulo(id) {
  const item = moduloRegistros.find(row => row.id === id);
  const deletedItem = item ? (() => {
    const valores = {};
    moduloCampos.forEach(campo => {
      valores[campo.nome] = item[campo.nome] ?? '';
    });
    return valores;
  })() : null;
  showConfirm('Remover este registro?', async () => {
    await fetch(`${API_MODULOS}/${moduloAtual.id}/registros/${id}`, {
      method: 'DELETE'
    });

    selectedModuloIds.delete(id);
    updateBulkUI();
    await carregarRegistrosModulo();
    renderModuloDinamico();
    if (deletedItem) {
      showUndoToast({ type: 'modulo', items: [deletedItem], moduloId: moduloAtual.id });
    }
  }, 'Confirmar exclusão');
}

function openNovoRegistroModulo() {
  moduloEditId = null;
  document.getElementById('moduloRegistroTitulo').textContent = 'Novo Registro';
  renderFormularioModulo();
  openModalById('moduloRegistroModal');
}

function editarRegistroModulo(idx) {
  const registro = moduloRegistros[idx];
  if (!registro) return;
  moduloEditId = registro.id;
  document.getElementById('moduloRegistroTitulo').textContent = 'Editar Registro';
  renderFormularioModulo(registro);
  openModalById('moduloRegistroModal');
}

function closeModuloRegistroModal(e) {
  if (!e || e.target.id === 'moduloRegistroModal') {
    document.getElementById('moduloRegistroModal').classList.remove('show');
  }
}

function renderFormularioModulo(valores = {}) {
  const container = document.getElementById('moduloFormFields');
  container.innerHTML = '';

  moduloCampos.forEach((campo, index) => {
    const field = document.createElement('div');
    field.className = 'form-full';

    const label = document.createElement('label');
    label.textContent = campo.nome;

    const typeMap = {
      numero: 'number',
      data: 'text',
      email: 'email'
    };

    let input;
    const normalizedName = normalizeHeader(campo.nome);
    const isNomeMaquina = normalizedName.includes('nomemaquina');
    if (isNomeMaquina) {
      const wrapper = document.createElement('div');
      wrapper.className = 'machine-name-group';

      const prefixSelect = document.createElement('select');
      const prefixes = ['PMSFS-DT', 'SMSSFS-DT'];
      prefixes.forEach(prefix => {
        const option = document.createElement('option');
        option.value = prefix;
        option.textContent = prefix;
        prefixSelect.appendChild(option);
      });

      const numberInput = document.createElement('input');
      numberInput.type = 'text';
      numberInput.placeholder = 'Número';

      input = document.createElement('input');
      input.type = 'hidden';

      const currentValue = valores[campo.nome] || '';
      const matchedPrefix = prefixes.find(prefix => currentValue.startsWith(prefix));
      if (matchedPrefix) {
        prefixSelect.value = matchedPrefix;
        numberInput.value = currentValue.replace(matchedPrefix, '').replace(/^[-\s]+/, '');
      } else if (prefixes.length) {
        prefixSelect.value = prefixes[0];
        numberInput.value = currentValue;
      }

      const syncValue = () => {
        const prefix = prefixSelect.value;
        const suffix = numberInput.value.trim();
        input.value = suffix ? `${prefix}-${suffix}` : prefix;
      };

      prefixSelect.addEventListener('change', syncValue);
      numberInput.addEventListener('input', syncValue);
      syncValue();

      if (index === 0) {
        numberInput.dataset.autofocus = 'true';
      }

      wrapper.appendChild(prefixSelect);
      wrapper.appendChild(numberInput);
      field.appendChild(label);
      field.appendChild(wrapper);
      field.appendChild(input);
    } else if (campo.tipo === 'select') {
      input = document.createElement('select');
      const options = getSelectOptionsForCampo(campo);
      options.forEach(optionValue => {
        const option = document.createElement('option');
        option.value = optionValue;
        option.textContent = optionValue;
        input.appendChild(option);
      });
      const currentValue = valores[campo.nome] || '';
      if (currentValue && !options.includes(currentValue)) {
        const option = document.createElement('option');
        option.value = currentValue;
        option.textContent = currentValue;
        input.appendChild(option);
      }
      input.value = currentValue;
    } else {
      input = document.createElement('input');
      input.type = typeMap[campo.tipo] || 'text';
      input.value = valores[campo.nome] || '';
      if (campo.tipo === 'data') {
        input.placeholder = 'dd/mm/aaaa';
        input.inputMode = 'numeric';
      }
    }

    input.dataset.field = campo.nome;
    input.dataset.type = campo.tipo || 'texto';
    input.dataset.required = campo.obrigatorio ? 'true' : 'false';
    if (index === 0) {
      input.dataset.autofocus = 'true';
    }

    if (!isNomeMaquina) {
      if (campo.tipo === 'data') {
        input.addEventListener('input', (event) => {
          event.target.value = applyDateMask(event.target.value);
        });
      }
      const normalizedFieldName = normalizeHeader(campo.nome);
      if (campo.tipo === 'email') {
        input.addEventListener('blur', (event) => {
          event.target.value = event.target.value.trim().toLowerCase();
        });
      }
      if (normalizedFieldName.includes('telefone')) {
        input.addEventListener('input', (event) => {
          event.target.value = applyPhoneMask(event.target.value);
        });
      }
      field.appendChild(label);
      field.appendChild(input);
    }
    container.appendChild(field);
  });
}

async function salvarRegistroModulo() {
  if (!moduloAtual?.id) {
    showMessage('Selecione uma aba personalizada.');
    return;
  }

  const inputs = [...document.querySelectorAll('#moduloFormFields [data-field]')];
  const valores = {};

  for (const input of inputs) {
    const nome = input.dataset.field;
    const valor = input.value?.trim();
    const tipo = input.dataset.type || 'texto';
    if (input.dataset.required === 'true' && !valor) {
      showMessage(`Preencha o campo obrigatório: ${nome}`);
      return;
    }
    const normalizedFieldName = normalizeHeader(nome);
    if (valor && tipo === 'email' && !isValidEmail(valor)) {
      showMessage(`E-mail inválido no campo: ${nome}`);
      return;
    }
    if (valor && normalizedFieldName.includes('telefone') && !isValidPhoneNumber(valor)) {
      showMessage(`Telefone inválido no campo: ${nome}`);
      return;
    }
    if (valor && tipo === 'data') {
      const normalized = normalizeDateValue(valor);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
        showMessage(`Data inválida no campo: ${nome}`);
        return;
      }
      valores[nome] = normalized;
    } else {
      valores[nome] = valor || '';
    }
  }

  const url = moduloEditId
    ? `${API_MODULOS}/${moduloAtual.id}/registros/${moduloEditId}`
    : `${API_MODULOS}/${moduloAtual.id}/registros`;
  const method = moduloEditId ? 'PUT' : 'POST';

  await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ valores })
  });

  closeModuloRegistroModal();
  await carregarRegistrosModulo();
  renderModuloDinamico();
}

function openNovoRegistroModulo() {
  moduloEditId = null;
  document.getElementById('moduloRegistroTitulo').textContent = 'Novo Registro';
  renderFormularioModulo();
  openModalById('moduloRegistroModal');
}

let newTabFields = window.newTabFields;

const tabTemplates = {
  inventario: [
    { nome: 'Link de Internet', tipo: 'select', obrigatorio: true },
    { nome: 'Velocidade (DL/UL)', tipo: 'select', obrigatorio: false },
    { nome: 'Telefone', tipo: 'texto', obrigatorio: false },
    { nome: 'Local', tipo: 'select', obrigatorio: true },
    { nome: 'Endereço', tipo: 'texto', obrigatorio: false },
    { nome: 'Categoria', tipo: 'select', obrigatorio: false }
  ],
  maquinas: [
    { nome: 'Nome Máquina', tipo: 'texto', obrigatorio: true },
    { nome: 'Patrimônio', tipo: 'texto', obrigatorio: false },
    { nome: 'Local', tipo: 'select', obrigatorio: false },
    { nome: 'Status', tipo: 'select', obrigatorio: false },
    { nome: 'Descrição', tipo: 'texto', obrigatorio: false }
  ]
};

const fieldPresetMap = Object.entries(tabTemplates).reduce((acc, [group, fields]) => {
  fields.forEach(field => {
    const key = `${group}:${field.nome}`;
    acc[key] = { ...field, group };
  });
  return acc;
}, {});

let fieldDragInitialized = false;

function applyFieldPreset(idx, presetKey) {
  const preset = fieldPresetMap[presetKey];
  if (!preset) return;

  const row = document.querySelector(`.field-row[data-idx="${idx}"]`);
  if (!row) return;

  const nameInput = row.querySelector('.field-name');
  const typeSelect = row.querySelector('.field-type');
  const requiredInput = row.querySelector('.field-required');

  if (nameInput) nameInput.value = preset.nome;
  if (typeSelect) typeSelect.value = preset.tipo;
  if (requiredInput) requiredInput.checked = preset.obrigatorio;

  if (newTabFields[idx]) {
    newTabFields[idx].nome = preset.nome;
    newTabFields[idx].tipo = preset.tipo;
    newTabFields[idx].obrigatorio = preset.obrigatorio;
  }
}

function getFieldRowsData() {
  const rows = [...document.querySelectorAll('#fieldsContainer .field-row')];
  return rows.map(row => ({
    nome: row.querySelector('.field-name')?.value.trim() || '',
    tipo: row.querySelector('.field-type')?.value || 'texto',
    obrigatorio: !!row.querySelector('.field-required')?.checked
  }));
}

function rebuildFieldRowsFromDOM() {
  const container = document.getElementById('fieldsContainer');
  if (!container) return;
  const rowsData = getFieldRowsData().filter(row => row.nome);
  newTabFields = [];
  window.newTabFields = newTabFields;
  container.innerHTML = '';
  rowsData.forEach(row => addFieldWithValues(row));
}

function validateDuplicateFields(fields) {
  const seen = new Map();
  const duplicates = new Set();
  fields.forEach(field => {
    const key = normalizeHeader(field.nome);
    if (!key) return;
    if (seen.has(key)) {
      duplicates.add(field.nome);
    } else {
      seen.set(key, field.nome);
    }
  });
  if (duplicates.size) {
    showMessage(`Campos duplicados encontrados: ${[...duplicates].join(', ')}`);
    return false;
  }
  return true;
}

function initFieldDragAndDrop() {
  if (fieldDragInitialized) return;
  const container = document.getElementById('fieldsContainer');
  if (!container) return;
  fieldDragInitialized = true;

  container.addEventListener('dragstart', event => {
    const handle = event.target.closest('.field-drag');
    if (!handle) return;
    const row = handle.closest('.field-row');
    if (!row) return;
    row.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'move';
  });

  container.addEventListener('dragend', event => {
    const row = event.target.closest('.field-row');
    if (row) row.classList.remove('dragging');
  });

  container.addEventListener('dragover', event => {
    const row = event.target.closest('.field-row');
    const dragging = container.querySelector('.field-row.dragging');
    if (!row || !dragging || row === dragging) return;
    event.preventDefault();
    const rect = row.getBoundingClientRect();
    const shouldInsertAfter = event.clientY > rect.top + rect.height / 2;
    container.insertBefore(dragging, shouldInsertAfter ? row.nextSibling : row);
  });

  container.addEventListener('drop', event => {
    if (!container.querySelector('.field-row.dragging')) return;
    event.preventDefault();
    rebuildFieldRowsFromDOM();
  });
}

const inventoryLocalOptions = [
  'Prefeitura Sede',
  'Multiuso',
  'Sec. de Obras',
  'Sec. de Obras - Diretoria de Balneários',
  'Sec. de Administração - Patrimônio',
  'Sec. Atendimento ao Cidadão - Shopping',
  'Sec. de Esporte - Ginásio',
  'Sec. de Esporte - Terminal Walter Gama Lobo',
  'Sec. Meio Ambiente - CBEA',
  'Sec. de Obras - Cemitério',
  'Sec. de Obras - Gerência Ervino',
  'Sec. de Obras - Gerência Distrito do Saí',
  'PAV - Ponto de Atendimento Virtual',
  'NAC - Núcleo de Atendimento ao Cidadão',
  'Sec. Pesca - Gerência',
  'Sec. Pesca - Viveiro de Mudas',
  'CAPS',
  'UPA',
  'Cine Teatro',
  'Biblioteca',
  'Museu',
  'CRAS',
  'CREAS',
  'PAE',
  'Polícia Militar',
  'Bombeiros',
  'Conselho Tutelar',
  'Sec. de Turismo',
  'Sec. de Educação',
  'Sec. de Saúde',
  'Sec. de Assistência Social',
  'Sec. de Administração',
  'Sec. de Obras - Garagem',
  'Sec. de Obras - Recolhimento Animais',
  'Sec. de Obras - Estações',
  'Sec. de Obras - Usina Asfalto',
  'Sec. de Obras - Rodoviária',
  'Sec. de Obras - Campings',
  'Sec. de Obras - Garagem Ervino',
  'Sec. de Obras - Garagem Itacolomi',
  'Sec. de Obras - Garagem Saí',
  'Sec. de Obras - Garagem Rocio',
  'Sec. de Obras - Garagem Paulas',
  'Sec. de Obras - Garagem Ubatuba',
  'Sec. de Obras - Garagem Bela Vista',
  'Sec. de Obras - Garagem Primavera',
  'Outro'
];

const machineLocalOptions = [
  'Prefeitura',
  'Secretaria de Saúde',
  'Secretaria de Educação',
  'Central de veiculos',
  'Outro'
];

const selectOptionsMap = {
  status: ['Ativa', 'Manutenção', 'Inativa'],
  categoria: [
    'Prefeitura',
    'Educação',
    'Saúde',
    'Assistência Cultural',
    'Fundação Cultural'
  ],
  'link de internet': [
    'Link Dedicado',
    'Interconexão (CONCENTRADOR)',
    'Interconexão',
    'Banda Larga',
    'Outro'
  ],
  'velocidade (dl/ul)': ['800/800', '1400/1400', '400/400', '100/100', 'Outro']
};

function getSelectOptionsForCampo(campo) {
  const nome = (campo.nome || '').toLowerCase();
  if (nome === 'local') {
    return Array.from(new Set([...inventoryLocalOptions, ...machineLocalOptions]));
  }
  if (selectOptionsMap[nome]) {
    return selectOptionsMap[nome];
  }
  return [];
}

function openCreateTabModal() {
  newTabFields = [];
  window.newTabFields = newTabFields;
  document.getElementById('fieldsContainer').innerHTML = '';
  document.getElementById('newTabName').value = '';
  document.getElementById('newTabDescription').value = '';
  const templateSelect = document.getElementById('newTabTemplate');
  if (templateSelect) templateSelect.value = 'custom';
  initFieldDragAndDrop();
  openModalById('createTabModal');
}

function closeCreateTabModal(e) {
  if (!e || e.target.id === 'createTabModal') {
    document.getElementById('createTabModal').classList.remove('show');
  }
}

function applyTabTemplate() {
  const templateSelect = document.getElementById('newTabTemplate');
  if (!templateSelect) return;
  const templateKey = templateSelect.value;
  const container = document.getElementById('fieldsContainer');
  if (!container) return;

  newTabFields = [];
  window.newTabFields = newTabFields;
  container.innerHTML = '';

  if (templateKey === 'custom') return;
  const templateFields = tabTemplates[templateKey] || [];
  templateFields.forEach(field => addFieldWithValues(field));
}

function addFieldWithValues({ nome = '', tipo = 'texto', obrigatorio = false } = {}) {
  const idx = newTabFields.length;

  newTabFields.push({
    nome,
    tipo,
    obrigatorio
  });

  const row = document.createElement('div');
  row.className = 'field-row';
  row.dataset.idx = idx;

  const presetOptions = Object.entries(fieldPresetMap)
    .map(([key, value]) => `<option value="${key}">${value.group === 'inventario' ? 'Inventário' : 'Máquinas'}: ${value.nome}</option>`)
    .join('');

  row.innerHTML = `
    <select class="field-preset" onchange="applyFieldPreset(${idx}, this.value)">
      <option value="" disabled selected>Usar campo de outra aba</option>
      ${presetOptions}
    </select>

    <input
      type="text"
      class="field-name"
      placeholder="Nome do campo"
      value="${escapeHtml(nome)}"
      oninput="window.newTabFields[${idx}].nome = this.value"
    />

    <select class="field-type" onchange="window.newTabFields[${idx}].tipo = this.value">
      <option value="texto">Texto</option>
      <option value="numero">Número</option>
      <option value="data">Data</option>
      <option value="email">E-mail</option>
      <option value="select">Lista</option>
    </select>

    <label class="field-required-label">
      <input class="field-required" type="checkbox" ${obrigatorio ? 'checked' : ''} onchange="window.newTabFields[${idx}].obrigatorio = this.checked">
      Obrigatório
    </label>

    <button
      type="button"
      class="field-drag"
      title="Arraste para reordenar"
      draggable="true"
    >↕</button>

    <button
      type="button"
      class="field-remove"
      title="Remover campo"
      onclick="removeField(${idx})"
    >✕</button>
  `;

  document.getElementById('fieldsContainer').appendChild(row);
  initFieldDragAndDrop();

  const typeSelect = row.querySelector('.field-type');
  if (typeSelect) {
    typeSelect.value = tipo;
  }
}

function addField() {
  addFieldWithValues();
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
  const res = await fetch(API_MODULOS);
  const modulos = await res.json();

  const nav = document.querySelector('.nav');

  modulos.forEach(m => {
    if (document.getElementById(`tab-${m.id}`)) return;

    const a = document.createElement('a');
    a.className = 'tab-dinamica';
    a.dataset.moduloId = m.id;
    a.textContent = m.nome;
    a.onclick = () => abrirModulo(m);

    nav.appendChild(a);
  });
}

async function createNewTab() {
  const nome = document.getElementById('newTabName').value.trim();
  const descricao = document.getElementById('newTabDescription').value.trim();
  if (!nome) {
    showMessage('Informe o nome da aba');
    return;
  }

  // 1. cria módulo
  const modRes = await fetch(API_MODULOS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome, descricao })
  });

  const modulo = await modRes.json();

  // 2. cria campos
  const fields = document.querySelectorAll('.field-row');
  const fieldsData = [...fields].map(row => ({
    nome: row.querySelector('.field-name')?.value.trim(),
    tipo: row.querySelector('.field-type')?.value || 'texto',
    obrigatorio: !!row.querySelector('.field-required')?.checked
  })).filter(field => field.nome);

  if (!fieldsData.length) {
    showMessage('Adicione ao menos um campo com nome válido.');
    return;
  }

  if (!validateDuplicateFields(fieldsData)) {
    return;
  }

  for (let i = 0; i < fieldsData.length; i++) {
    const field = fieldsData[i];
    if (!field) continue;

    await fetch(`${API_MODULOS}/${modulo.id}/campos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: field.nome,
        tipo: field.tipo,
        obrigatorio: field.obrigatorio,
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
  document.getElementById('moduloDescricao').textContent = modulo.descricao || 'Tabela personalizada';

  const campos = await fetch(`${API_MODULOS}/${modulo.id}/campos`).then(r => r.json());
  const registros = await fetch(`${API_MODULOS}/${modulo.id}/registros`).then(r => r.json());

  renderModuloTable(campos, registros);
}
async function salvarNovoModulo() {
  const nome = document.getElementById('newTabName').value.trim();
  const descricao = document.getElementById('newTabDescription').value.trim();

  if (!nome) {
    showMessage('Informe o nome da aba.');
    return;
  }

  const fieldRows = [...document.querySelectorAll('#fieldsContainer .field-row')];

  if (!fieldRows.length) {
    showMessage('Adicione ao menos um campo.');
    return;
  }

  const res = await fetch(API_MODULOS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome, descricao })
  });

  const modulo = await res.json();

const camposValidos = fieldRows
  .map(row => ({
    nome: row.querySelector('.field-name')?.value.trim(),
    tipo: row.querySelector('.field-type')?.value || 'texto',
    obrigatorio: !!row.querySelector('.field-required')?.checked
  }))
  .filter(f => f.nome);

if (!camposValidos.length) {
  showMessage('Adicione ao menos um campo com nome válido.');
  return;
}

if (!validateDuplicateFields(camposValidos)) {
  return;
}

for (let i = 0; i < camposValidos.length; i++) {
  const f = camposValidos[i];

  await fetch(`${API_MODULOS}/${modulo.id}/campos`, {
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

function closeModalByEsc(modalEl) {
  if (!modalEl) return;
  switch (modalEl.id) {
    case 'modal':
      closeModal();
      break;
    case 'machineModal':
      closeMachineModal();
      break;
    case 'descModal':
      closeDescModal();
      break;
    case 'importModal':
      closeImportModal();
      break;
    case 'createTabModal':
      closeCreateTabModal();
      break;
    case 'moduloRegistroModal':
      closeModuloRegistroModal();
      break;
    case 'confirmDeleteModuloModal':
      closeConfirmDeleteModulo();
      break;
    case 'systemMessageModal':
      closeSystemMessageModal();
      break;
    case 'systemConfirmModal':
      closeSystemConfirmModal();
      break;
    default:
      modalEl.classList.remove('show');
      break;
  }
}

/**
 * Abre um modal por ID (sem conflitar com openModal do inventário).
 * Ex: openModalById('createTabModal')
 */
function openModalById(id) {
  closeAllModals();
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove('hidden');
    el.classList.add('show');
    focusFirstField(el);
  }
}





// FECHAR AO CLICAR FORA (SEM QUEBRAR)
document.addEventListener('click', (e) => {
  if (!e.target.closest('.export-wrapper')) {
    document.getElementById('exportMenuInv')?.classList.add('hidden');
    document.getElementById('exportMenuMq')?.classList.add('hidden');
    document.getElementById('exportMenuMod')?.classList.add('hidden');
  }
});


  /* ===========================
     EVENTOS GLOBAIS
     =========================== */

document.addEventListener('click', (e) => {
  const inv = document.getElementById('exportMenuInv');
  const mq  = document.getElementById('exportMenuMq');
  const mod = document.getElementById('exportMenuMod');

  if (!e.target.closest('.export-wrapper')) {
    inv?.classList.add('hidden');
    mq?.classList.add('hidden');
    mod?.classList.add('hidden');
  }
});

document.addEventListener('click', (e) => {
  const link = e.target.closest('.help-link');
  if (!link) return;
  const tip = link.closest('.help-tip');
  if (!tip) return;
  const title = tip.dataset.helpTitle || 'Ajuda';
  const content = tip.dataset.helpMore || tip.dataset.help || '';
  openHelpPanel(title, content);
});

function getActiveSearchInput() {
  if (document.getElementById('tabInventario')?.classList.contains('active')) {
    return document.getElementById('q');
  }
  if (document.getElementById('tabMaquinas')?.classList.contains('active')) {
    return document.getElementById('mq');
  }
  if (document.getElementById('tabModuloDinamico')?.classList.contains('active')) {
    return document.getElementById('moduloSearch');
  }
  return null;
}

function isTypingField(el) {
  if (!el) return false;
  const tag = el.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || el.isContentEditable;
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const openModals = [...document.querySelectorAll('.modal.show')];
    const topModal = openModals[openModals.length - 1];
    if (topModal) {
      closeModalByEsc(topModal);
    }
    return;
  }

  if (e.key === '/' && !isTypingField(document.activeElement)) {
    const input = getActiveSearchInput();
    if (input) {
      e.preventDefault();
      input.focus();
      input.select();
    }
    return;
  }

  if (e.key === 'Enter' && !e.shiftKey && document.activeElement?.tagName !== 'TEXTAREA') {
    const openModals = [...document.querySelectorAll('.modal.show')];
    const topModal = openModals[openModals.length - 1];
    if (!topModal || !topModal.contains(document.activeElement)) return;
    switch (topModal.id) {
      case 'modal':
        saveItem();
        break;
      case 'machineModal':
        saveMachine();
        break;
      case 'moduloRegistroModal':
        salvarRegistroModulo();
        break;
      case 'createTabModal':
        salvarNovoModulo();
        break;
      case 'importModal':
        confirmImport();
        break;
      default:
        break;
    }
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
  window.exportModulo = exportModulo;
  window.toggleExportMenu = toggleExportMenu;
  window.carregarLogoPrefeitura = carregarLogoPrefeitura;
  window.toggleFilters = toggleFilters;
  window.clearInventoryFilters = clearInventoryFilters;
  window.clearMachineFilters = clearMachineFilters;
  window.clearModuloFilters = clearModuloFilters;
  window.clearImportHistory = clearImportHistory;
  window.reprocessImport = reprocessImport;
  window.openImportModal = openImportModal;
  window.closeImportModal = closeImportModal;
  window.closeImportModalIfClicked = closeImportModalIfClicked;
  window.handleImportFile = handleImportFile;
  window.confirmImport = confirmImport;
  window.removeImportRow = removeImportRow;
  window.updateImportCell = updateImportCell;
  window.closeHelpPanel = closeHelpPanel;

  window.openCreateTabModal = openCreateTabModal;
  window.closeCreateTabModal = closeCreateTabModal;
  window.applyTabTemplate = applyTabTemplate;
  window.addField = addField;
  window.salvarNovoModulo = salvarNovoModulo;
window.openModalById = openModalById;
window.removeField = removeField;
window.openNovoRegistroModulo = openNovoRegistroModulo;
window.editarRegistroModulo = editarRegistroModulo;
window.closeModuloRegistroModal = closeModuloRegistroModal;
window.salvarRegistroModulo = salvarRegistroModulo;
window.filtrarModulo = filtrarModulo;
window.openConfirmDeleteModulo = openConfirmDeleteModulo;
window.closeConfirmDeleteModulo = closeConfirmDeleteModulo;
window.confirmDeleteModulo = confirmDeleteModulo;
window.closeSystemMessageModal = closeSystemMessageModal;
window.closeSystemConfirmModal = closeSystemConfirmModal;
window.confirmSystemAction = confirmSystemAction;


  /* ===========================
     INICIALIZAÇÃO
     =========================== */
     await carregarModulos();

  await carregarLogoPrefeitura();
  fetchData();
  fetchMachines();
});
