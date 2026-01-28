
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
  let importColumnMap = [];
  let importHasHeaderRow = false;
  let importRawRows = [];
  let importHeaderMode = 'auto';

/* ===========================
   MÓDULOS DINÂMICOS
   =========================== */
  const API_BASE = `${window.location.origin}/api`;
const API_MODULOS = `${API_BASE}/modulos`;

let modulos = [];
let moduloAtual = null;
let moduloCampos = [];
let moduloRegistros = [];
let moduloEditId = null;
let moduloDeleteTarget = null;
let moduloColumnFilters = {};
let moduloSmartFilters = {};
let moduloSmartSearchText = '';
let moduloSortState = { key: null, dir: 'asc' };
let manageTabContext = null;
let manualTabContext = null;

let globalLoadingCount = 0;
const rowHighlightQueue = {
  inventario: new Set(),
  maquinas: new Set(),
  modulo: new Set()
};
let inventoryFlashAfterFetch = false;
let machinesFlashAfterFetch = false;
let moduloFlashAfterFetch = false;

function updateGlobalLoader() {
  const loader = document.getElementById('globalLoader');
  if (!loader) return;
  loader.classList.toggle('hidden', globalLoadingCount === 0);
}

function showGlobalLoader() {
  globalLoadingCount += 1;
  updateGlobalLoader();
}

function hideGlobalLoader() {
  globalLoadingCount = Math.max(0, globalLoadingCount - 1);
  updateGlobalLoader();
}

if (!window.__globalFetchWrapped) {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    showGlobalLoader();
    try {
      return await originalFetch(...args);
    } finally {
      hideGlobalLoader();
    }
  };
  window.__globalFetchWrapped = true;
}

function queueRowHighlight(scope, id) {
  const bucket = rowHighlightQueue[scope];
  if (!bucket || !id) return;
  bucket.add(Number(id));
}

function applyRowHighlights(scope, tbodyId) {
  const bucket = rowHighlightQueue[scope];
  const tbodyEl = document.getElementById(tbodyId);
  if (!bucket || !tbodyEl) return;
  bucket.forEach((id) => {
    const row = tbodyEl.querySelector(`tr[data-id="${id}"]`);
    if (row) row.classList.add('table-row-highlight');
  });
  if (bucket.size) {
    setTimeout(() => {
      bucket.forEach((id) => {
        const row = tbodyEl.querySelector(`tr[data-id="${id}"]`);
        row?.classList.remove('table-row-highlight');
      });
      bucket.clear();
    }, 2200);
  }
}

function flashTableRows(tbodyId) {
  const tbodyEl = document.getElementById(tbodyId);
  if (!tbodyEl) return;
  tbodyEl.querySelectorAll('tr').forEach((row) => row.classList.add('table-row-flash'));
  setTimeout(() => {
    tbodyEl.querySelectorAll('tr').forEach((row) => row.classList.remove('table-row-flash'));
  }, 1200);
}

function setButtonLoading(button, isLoading) {
  if (!button) return;
  if (isLoading) {
    if (button.classList.contains('is-loading')) return;
    button.dataset.originalLabel = button.innerHTML;
    button.innerHTML = '<span class="btn-spinner" aria-hidden="true"></span>';
    button.classList.add('is-loading');
    button.setAttribute('aria-busy', 'true');
  } else if (button.classList.contains('is-loading')) {
    button.innerHTML = button.dataset.originalLabel || button.innerHTML;
    button.classList.remove('is-loading');
    button.removeAttribute('aria-busy');
  }
}

const manualTabFieldConfig = {
  inventario: [
    { key: 'link', label: 'Link de Internet' },
    { key: 'velocidade', label: 'Velocidade (DL/UL)' },
    { key: 'telefone', label: 'Telefone' },
    { key: 'local', label: 'Local' },
    { key: 'endereco', label: 'Endereço' }
  ],
  maquinas: [
    { key: 'nome_maquina', label: 'Nome Máquina' },
    { key: 'patrimonio', label: 'Patrimônio' },
    { key: 'local', label: 'Local' },
    { key: 'status', label: 'Status' },
    { key: 'descricao', label: 'Descrição' }
  ]
};

const manualCustomFieldStore = {
  inventario: [],
  maquinas: []
};
const manualCustomValuesStore = {
  inventario: {},
  maquinas: {}
};
const manualCustomLoadState = {
  inventario: { fields: false, values: false },
  maquinas: { fields: false, values: false }
};
const manualTabConfigStore = {
  inventario: null,
  maquinas: null
};
const manualTabConfigLoadState = {
  inventario: false,
  maquinas: false
};
const modulePreferencesStore = new Map();
const modulePreferencesLoadState = new Map();

function getManualCustomFields(tabType) {
  return manualCustomFieldStore[tabType] || [];
}

function setManualCustomFields(tabType, fields) {
  manualCustomFieldStore[tabType] = Array.isArray(fields) ? fields : [];
}

function getManualCustomValues(tabType) {
  return manualCustomValuesStore[tabType] || {};
}

function setManualCustomValues(tabType, values) {
  manualCustomValuesStore[tabType] = values && typeof values === 'object' ? values : {};
}

async function fetchManualCustomFields(tabType) {
  const res = await fetch(`${API_BASE}/manual-custom-fields?tabType=${tabType}`);
  if (!res.ok) throw new Error('Falha ao carregar campos personalizados.');
  const fields = await res.json();
  const sanitized = Array.isArray(fields)
    ? fields.filter(field => field?.key && field?.label)
    : [];
  setManualCustomFields(tabType, sanitized);
  manualCustomLoadState[tabType].fields = true;
  return sanitized;
}

async function fetchManualCustomValues(tabType) {
  const res = await fetch(`${API_BASE}/manual-custom-values?tabType=${tabType}`);
  if (!res.ok) throw new Error('Falha ao carregar valores personalizados.');
  const payload = await res.json();
  const values = payload?.data && typeof payload.data === 'object' ? payload.data : {};
  setManualCustomValues(tabType, values);
  manualCustomLoadState[tabType].values = true;
  return values;
}

async function ensureManualCustomDataLoaded(tabType) {
  const state = manualCustomLoadState[tabType];
  if (!state?.fields) {
    await fetchManualCustomFields(tabType);
  }
  if (!state?.values) {
    await fetchManualCustomValues(tabType);
  }
}

async function createManualCustomField(tabType, field) {
  const res = await fetch(`${API_BASE}/manual-custom-fields`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tabType, key: field.key, label: field.label })
  });
  if (!res.ok) {
    throw new Error('Falha ao salvar campo personalizado.');
  }
  const saved = await res.json();
  setManualCustomFields(tabType, [...getManualCustomFields(tabType), saved]);
  manualCustomLoadState[tabType].fields = true;
  return saved;
}

async function replaceManualCustomValues(tabType, itemId, values) {
  if (!itemId) return;
  const res = await fetch(`${API_BASE}/manual-custom-values?tabType=${tabType}&itemId=${itemId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ values })
  });
  if (!res.ok) {
    throw new Error('Falha ao salvar valores personalizados.');
  }
}

async function deleteManualCustomValues(tabType, itemId) {
  if (!itemId) return;
  const res = await fetch(`${API_BASE}/manual-custom-values?tabType=${tabType}&itemId=${itemId}`, {
    method: 'DELETE'
  });
  if (!res.ok) {
    throw new Error('Falha ao remover valores personalizados.');
  }
}

async function setManualCustomValuesForItem(tabType, itemId, values) {
  if (!itemId) return;
  const sanitized = {};
  Object.entries(values || {}).forEach(([key, value]) => {
    const nextValue = String(value || '').trim();
    if (nextValue) {
      sanitized[key] = nextValue;
    }
  });
  await replaceManualCustomValues(tabType, itemId, sanitized);
  const allValues = { ...getManualCustomValues(tabType) };
  if (Object.keys(sanitized).length) {
    allValues[itemId] = sanitized;
  } else {
    delete allValues[itemId];
  }
  setManualCustomValues(tabType, allValues);
  manualCustomLoadState[tabType].values = true;
}

async function removeManualCustomValuesForItem(tabType, itemId) {
  if (!itemId) return;
  await deleteManualCustomValues(tabType, itemId);
  const allValues = { ...getManualCustomValues(tabType) };
  if (allValues[itemId]) {
    delete allValues[itemId];
    setManualCustomValues(tabType, allValues);
  }
  manualCustomLoadState[tabType].values = true;
}

function getManualFieldDefinitions(tabType) {
  const baseFields = manualTabFieldConfig[tabType] || [];
  return [...baseFields, ...getManualCustomFields(tabType)];
}

function normalizeManualFieldKey(value = '') {
  return normalizeHeader(value)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function generateUniqueManualFieldKey(tabType, baseKey) {
  const existing = new Set(getManualFieldDefinitions(tabType).map(field => field.key));
  if (!existing.has(baseKey)) return baseKey;
  let counter = 2;
  while (existing.has(`${baseKey}_${counter}`)) {
    counter += 1;
  }
  return `${baseKey}_${counter}`;
}

function getManualTabConfig(tabType) {
  const defaults = getManualFieldDefinitions(tabType);
  const defaultOrder = defaults.map(field => field.key);
  const storedConfig = manualTabConfigStore[tabType];
  if (!storedConfig) {
    return { order: defaultOrder, labels: {}, hidden: [] };
  }
  try {
    const parsed = storedConfig;
    const order = Array.isArray(parsed.order) ? parsed.order.slice() : defaultOrder.slice();
    defaultOrder.forEach((key) => {
      if (!order.includes(key)) {
        order.push(key);
      }
    });
    return {
      order,
      labels: parsed.labels || {},
      hidden: Array.isArray(parsed.hidden) ? parsed.hidden : []
    };
  } catch (e) {
    return { order: defaultOrder, labels: {}, hidden: [] };
  }
}

async function fetchManualTabConfig(tabType) {
  const res = await fetch(`${API_BASE}/system/manual-tab-config?tabType=${tabType}`);
  if (!res.ok) {
    throw new Error('Falha ao carregar configurações de colunas.');
  }
  const payload = await res.json();
  const config = payload?.config && typeof payload.config === 'object' ? payload.config : null;
  manualTabConfigStore[tabType] = config;
  manualTabConfigLoadState[tabType] = true;
  return getManualTabConfig(tabType);
}

async function ensureManualTabConfigLoaded(tabType) {
  if (!manualTabConfigLoadState[tabType]) {
    await fetchManualTabConfig(tabType);
  }
}

async function saveManualTabConfig(tabType, config) {
  manualTabConfigStore[tabType] = config;
  manualTabConfigLoadState[tabType] = true;
  const res = await fetch(`${API_BASE}/system/manual-tab-config?tabType=${tabType}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config })
  });
  if (!res.ok) {
    throw new Error('Falha ao salvar configurações de colunas.');
  }
}

function ensureManualTabColumns(tabType) {
  const tabId = tabType === 'inventario' ? 'tabInventario' : 'tabMaquinas';
  const tab = document.getElementById(tabId);
  if (!tab) return;
  const headerRow = tab.querySelector('thead tr');
  const filterRow = tab.querySelector('thead tr.table-filters');
  if (!headerRow || !filterRow) return;
  const actionsHeader = headerRow.querySelector('th.actions-header');
  const filterActions = filterRow.querySelector('th.actions-header');
  const allowedKeys = new Set(getManualFieldDefinitions(tabType).map(field => field.key));
  headerRow.querySelectorAll('th[data-field]').forEach((th) => {
    if (!allowedKeys.has(th.dataset.field)) {
      th.remove();
    }
  });
  filterRow.querySelectorAll('th').forEach((th) => {
    const input = th.querySelector('[data-field]');
    if (input && !allowedKeys.has(input.dataset.field)) {
      th.remove();
    }
  });
  const customFields = getManualCustomFields(tabType);
  customFields.forEach((field) => {
    if (headerRow.querySelector(`th[data-field="${field.key}"]`)) return;
    const th = document.createElement('th');
    th.dataset.field = field.key;
    th.textContent = field.label;
    headerRow.insertBefore(th, actionsHeader);

    const filterTh = document.createElement('th');
    const input = document.createElement('input');
    input.className = 'table-filter-input';
    input.dataset.field = field.key;
    input.dataset.custom = 'true';
    input.placeholder = `Filtrar ${field.label.toLowerCase()}`;
    input.addEventListener('input', () => {
      if (tabType === 'inventario') {
        applyFilters();
      } else {
        applyMachineFilters();
      }
    });
    filterTh.appendChild(input);
    filterRow.insertBefore(filterTh, filterActions);
  });
}

function getManualTableColspan(tabType) {
  const baseCount = 7;
  return baseCount + getManualCustomFields(tabType).length;
}

function countManualCustomFilters(tabType) {
  const tabId = tabType === 'inventario' ? 'tabInventario' : 'tabMaquinas';
  const tab = document.getElementById(tabId);
  if (!tab) return 0;
  return [...tab.querySelectorAll('.table-filter-input[data-custom="true"]')]
    .filter((input) => input.value.trim()).length;
}

function applyManualCustomFilters(list, tabType) {
  const customFields = getManualCustomFields(tabType);
  if (!customFields.length) return list;
  const values = getManualCustomValues(tabType);
  const tabId = tabType === 'inventario' ? 'tabInventario' : 'tabMaquinas';
  const tab = document.getElementById(tabId);
  if (!tab) return list;
  return list.filter((item) => {
    return customFields.every((field) => {
      const input = tab.querySelector(`.table-filter-input[data-field="${field.key}"]`);
      const filterValue = (input?.value || '').trim().toLowerCase();
      if (!filterValue) return true;
      const itemValue = (values[item.id]?.[field.key] || '').toLowerCase();
      return itemValue.includes(filterValue);
    });
  });
}

function renderManualCustomFields(tabType, itemId = null) {
  const containerId = tabType === 'inventario' ? 'manualCustomFieldsInv' : 'manualCustomFieldsMaq';
  const container = document.getElementById(containerId);
  if (!container) return;
  const fields = getManualCustomFields(tabType);
  if (!fields.length) {
    container.innerHTML = '';
    container.classList.add('hidden');
    return;
  }
  const values = getManualCustomValues(tabType);
  const itemValues = itemId ? values[itemId] || {} : {};
  container.classList.remove('hidden');
  container.innerHTML = fields.map(field => `
    <div>
      <label>${escapeHtml(field.label)}</label>
      <input type="text" data-manual-custom-field="${field.key}" value="${escapeHtml(itemValues[field.key] || '')}" />
    </div>
  `).join('');
}

function collectManualCustomFieldValues(tabType) {
  const containerId = tabType === 'inventario' ? 'manualCustomFieldsInv' : 'manualCustomFieldsMaq';
  const container = document.getElementById(containerId);
  if (!container) return {};
  const values = {};
  container.querySelectorAll('input[data-manual-custom-field]').forEach((input) => {
    values[input.dataset.manualCustomField] = input.value;
  });
  return values;
}

const sortState = {
  inventory: { key: null, dir: 'asc' },
  machines: { key: null, dir: 'asc' }
};

const paginationState = {
  inventory: { page: 1, pageSize: 20, total: 0, isLoading: false },
  machines: { page: 1, pageSize: 20, total: 0, isLoading: false },
  modules: { page: 1, pageSize: 20, total: 0, isLoading: false }
};
let inventoryFilterTimeout = null;
let machineFilterTimeout = null;

  /* ===========================
     CONFIG
     =========================== */
  const API_URL = `${API_BASE}/links`;
  const API_MAQUINAS = `${API_BASE}/maquinas`;

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

function shouldIgnoreRowToggle(target) {
  return Boolean(target.closest('button, a, input, select, textarea, .action-group, .icon-btn, .desc-preview'));
}

function toggleRowCheckbox(row, selector) {
  const checkbox = row.querySelector(selector);
  if (!checkbox) return;
  checkbox.checked = !checkbox.checked;
  checkbox.dispatchEvent(new Event('change', { bubbles: true }));
}
  

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
let actionToastTimeout = null;
let actionToastLeftTimeout = null;
let importWarningVisible = false;
let importWarningDismissed = false;
let notificationItems = [];
let notificationsClearedAt = null;
let notificationsSuppressed = false;
const NOTIFICATION_DISMISSED_KEY = 'ti-notification-dismissed';
let dismissedNotificationIds = loadDismissedNotifications();
let guidedExportState = {
  dataset: 'inventario',
  scope: 'filtered',
  format: 'both'
};
let guidedExportBound = false;
let recentActions = [];

  updateFilterBadges();
  renderImportHistory();

  initSortMenu('sortMenuInv', sortState.inventory, applyFilters);
  initSortMenu('sortMenuMq', sortState.machines, applyMachineFilters);
  initSortOrderToggle('inventory', sortState.inventory, applyFilters);
  initSortOrderToggle('machines', sortState.machines, applyMachineFilters);
  initSortOrderToggle('modules', moduloSortState, renderModuloDinamico);
  initSortQuickButtons('inventory', sortState.inventory, applyFilters);
  initSortQuickButtons('machines', sortState.machines, applyMachineFilters);
  try {
    await Promise.all([
      ensureManualCustomDataLoaded('inventario'),
      ensureManualCustomDataLoaded('maquinas')
    ]);
    await Promise.all([
      ensureManualTabConfigLoaded('inventario'),
      ensureManualTabConfigLoaded('maquinas')
    ]);
  } catch (err) {
    console.error('Erro ao carregar campos personalizados:', err);
  }
  ensureManualTabColumns('inventario');
  ensureManualTabColumns('maquinas');
  applyManualTabLabels('inventario');
  applyManualTabLabels('maquinas');
  initPaginationControls();
  renderNotifications();
  renderRecentActions();
  const notificationToggle = document.getElementById('notificationToggle');
  if (notificationToggle) {
    notificationToggle.addEventListener('click', () => toggleNotificationPanel());
  }
  document.addEventListener('click', (event) => {
    const panel = document.getElementById('notificationPanel');
    const toggle = document.getElementById('notificationToggle');
    if (!panel || !toggle) return;
    if (!panel.classList.contains('hidden') && !panel.contains(event.target) && !toggle.contains(event.target)) {
      closeNotificationPanel();
    }
  });

function showActionToastWithId(toastId, message, duration, getTimeoutRef, setTimeoutRef) {
  const toast = document.getElementById(toastId);
  if (!toast) return;
  const text = toast.querySelector('.action-toast-text');
  if (text) text.textContent = message;
  toast.classList.remove('hidden');
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });
  const currentTimeout = getTimeoutRef();
  if (currentTimeout) clearTimeout(currentTimeout);
  const nextTimeout = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.classList.add('hidden');
    }, 250);
  }, duration);
  setTimeoutRef(nextTimeout);
}

async function fetchRecentActions(limit = 6) {
  try {
    const res = await fetch(`${API_BASE}/activity?limit=${limit}`);
    if (!res.ok) throw new Error('Falha ao carregar ações recentes.');
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn('Erro ao buscar ações recentes:', err);
    return [];
  }
}

function formatRecentTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

async function renderRecentActions() {
  const list = document.getElementById('dashboardRecentList');
  const empty = document.getElementById('dashboardRecentEmpty');
  if (!list || !empty) return;
  recentActions = await fetchRecentActions();
  if (!recentActions.length) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  list.innerHTML = recentActions.map((item) => `
    <li class="dashboard-recent-item">
      <div class="dashboard-recent-content">
        <span class="dashboard-recent-title">${escapeHtml(item.message)}</span>
      <span class="dashboard-recent-meta">${formatRecentTimestamp(item.created_at || item.date)}</span>
    </div>
    <span class="dashboard-recent-tag">${escapeHtml(item.tag || 'Ação')}</span>
  </li>
  `).join('');
}

async function addRecentAction(message, tag = 'Ação') {
  if (!message) return;
  try {
    await fetch(`${API_BASE}/activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        tag,
        user: getCurrentUserName()
      })
    });
  } catch (err) {
    console.warn('Erro ao registrar ação recente:', err);
  } finally {
    renderRecentActions();
  }
}

function showActionToast(message, duration = 3200) {
  void addRecentAction(message);
  showActionToastWithId(
    'actionToast',
    message,
    duration,
    () => actionToastTimeout,
    (value) => { actionToastTimeout = value; }
  );
}

function showActionToastLeft(message, duration = 3200) {
  void addRecentAction(message);
  showActionToastWithId(
    'actionToastLeft',
    message,
    duration,
    () => actionToastLeftTimeout,
    (value) => { actionToastLeftTimeout = value; }
  );
}

function showImportWarningNotice(message) {
  const notice = document.getElementById('importWarningNotice');
  if (!notice) return;
  const text = notice.querySelector('.import-warning-text');
  if (text) text.textContent = message;
  notice.classList.remove('hidden');
  importWarningVisible = true;
}

function hideImportWarningNotice() {
  const notice = document.getElementById('importWarningNotice');
  if (!notice) return;
  notice.classList.add('hidden');
  importWarningVisible = false;
}

function dismissImportWarningNotice() {
  importWarningDismissed = true;
  hideImportWarningNotice();
}

function toggleNotificationPanel(forceOpen = null) {
  const panel = document.getElementById('notificationPanel');
  const toggle = document.getElementById('notificationToggle');
  if (!panel || !toggle) return;
  const shouldOpen = forceOpen !== null ? forceOpen : panel.classList.contains('hidden');
  panel.classList.toggle('hidden', !shouldOpen);
  toggle.setAttribute('aria-expanded', String(shouldOpen));
}

function closeNotificationPanel() {
  toggleNotificationPanel(false);
}

function clearNotifications() {
  notificationsClearedAt = Date.now();
  notificationItems = [];
  notificationsSuppressed = true;
  dismissedNotificationIds = new Set();
  saveDismissedNotifications(dismissedNotificationIds);
  renderNotifications();
  closeNotificationPanel();
}

function refreshNotifications() {
  notificationsSuppressed = false;
  updateNotifications(true);
  toggleNotificationPanel(true);
}

function buildNotificationItem(id, title, description, count, options = {}) {
  return {
    id,
    title,
    description,
    count,
    priority: options.priority || 'low',
    action: options.action || null,
    actionLabel: options.actionLabel || 'Ver detalhes'
  };
}

function loadDismissedNotifications() {
  const stored = localStorage.getItem(NOTIFICATION_DISMISSED_KEY);
  if (!stored) return new Set();
  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed);
  } catch (e) {
    return new Set();
  }
}

function saveDismissedNotifications(nextSet) {
  localStorage.setItem(NOTIFICATION_DISMISSED_KEY, JSON.stringify([...nextSet]));
}

function dismissNotification(id) {
  if (!id) return;
  dismissedNotificationIds.add(id);
  saveDismissedNotifications(dismissedNotificationIds);
  notificationItems = notificationItems.filter(item => item.id !== id);
  renderNotifications();
}

function openNotificationFilters(panelId) {
  const panel = document.getElementById(panelId);
  if (panelId === 'moduleFilters') {
    openModuleFiltersModal();
    return;
  }
  if (!panel) return;
  if (panel.classList.contains('hidden')) {
    toggleFilters(panelId);
  }
}

function handleNotificationAction(id) {
  const item = notificationItems.find(entry => entry.id === id);
  if (!item?.action) return;
  const { type } = item.action;
  if (type === 'inventario') {
    switchTab('inventario');
    openNotificationFilters('inventoryFilters');
  } else if (type === 'maquinas') {
    switchTab('maquinas');
    openNotificationFilters('machineFilters');
  } else if (type === 'modulo' && moduloAtual) {
    abrirModulo(moduloAtual);
    openNotificationFilters('moduleFilters');
  }
}

function collectNotifications() {
  const items = [];
  if (Array.isArray(data)) {
    const missingTelefone = data.filter(item => !String(item.telefone || '').trim()).length;
    const missingEndereco = data.filter(item => !String(item.endereco || '').trim()).length;
    if (missingTelefone) {
      items.push(buildNotificationItem(
        'inv-telefone',
        `${missingTelefone} registro(s) sem telefone`,
        'Revise o Inventário para completar os contatos.',
        missingTelefone,
        { priority: 'medium', action: { type: 'inventario' } }
      ));
    }
    if (missingEndereco) {
      items.push(buildNotificationItem(
        'inv-endereco',
        `${missingEndereco} registro(s) sem endereço`,
        'Inclua o endereço para facilitar a localização.',
        missingEndereco,
        { priority: 'medium', action: { type: 'inventario' } }
      ));
    }
  }
  if (Array.isArray(machineData)) {
    const emManutencao = machineData.filter(item => String(item.status || '').toLowerCase() === 'manutenção').length;
    const inativas = machineData.filter(item => String(item.status || '').toLowerCase() === 'inativa').length;
    const semPatrimonio = machineData.filter(item => !String(item.patrimonio || '').trim()).length;
    if (emManutencao) {
      items.push(buildNotificationItem(
        'maq-manutencao',
        `${emManutencao} máquina(s) em manutenção`,
        'Verifique prioridades e atualize o status quando necessário.',
        emManutencao,
        { priority: 'high', action: { type: 'maquinas' } }
      ));
    }
    if (inativas) {
      items.push(buildNotificationItem(
        'maq-inativa',
        `${inativas} máquina(s) inativas`,
        'Considere revisar o destino ou reativação.',
        inativas,
        { priority: 'high', action: { type: 'maquinas' } }
      ));
    }
    if (semPatrimonio) {
      items.push(buildNotificationItem(
        'maq-patrimonio',
        `${semPatrimonio} máquina(s) sem patrimônio`,
        'Inclua o patrimônio para controle e auditoria.',
        semPatrimonio,
        { priority: 'medium', action: { type: 'maquinas' } }
      ));
    }
  }
  if (moduloAtual?.id) {
    const totalRegistros = Array.isArray(moduloRegistros) ? moduloRegistros.length : 0;
    const totalCampos = Array.isArray(moduloCampos) ? moduloCampos.length : 0;
    const emptyCells = countModuloEmptyCells();
    if (totalCampos && totalRegistros === 0) {
      items.push(buildNotificationItem(
        'mod-sem-registros',
        'Módulo sem registros',
        'Adicione registros para começar a preencher a aba personalizada.',
        1,
        { priority: 'medium', action: { type: 'modulo' } }
      ));
    }
    if (emptyCells) {
      items.push(buildNotificationItem(
        'mod-campos-vazios',
        `${emptyCells} campo(s) vazio(s) no módulo`,
        'Revise os registros para completar as informações.',
        emptyCells,
        { priority: 'low', action: { type: 'modulo' } }
      ));
    }
  }
  return items;
}

function renderNotifications() {
  const list = document.getElementById('notificationList');
  const badge = document.getElementById('notificationBadge');
  if (!list || !badge) return;
  const items = notificationItems;
  const total = items.reduce((sum, item) => sum + (item.count || 0), 0);
  badge.textContent = total;
  badge.classList.toggle('hidden', total === 0);
  if (!items.length) {
    list.innerHTML = '<div class="notification-item"><strong>Tudo em dia</strong><span>Sem pendências encontradas.</span></div>';
    return;
  }
  list.innerHTML = items.map(item => `
    <div class="notification-item is-${item.priority}" data-id="${item.id}">
      <div class="notification-item-content">
        <strong>${item.title}</strong>
        <span>${item.description}</span>
      </div>
      <div class="notification-item-actions">
        ${item.action ? `<button type="button" class="notification-action" onclick="handleNotificationAction('${item.id}')">${item.actionLabel}</button>` : ''}
        <button type="button" class="notification-dismiss" onclick="dismissNotification('${item.id}')">Dispensar</button>
      </div>
    </div>
  `).join('');
}

function updateNotifications(force = false) {
  if (notificationsSuppressed && !force) return;
  const items = collectNotifications()
    .filter(item => !dismissedNotificationIds.has(item.id));
  if (notificationsClearedAt) {
    const hasNew = items.some(item => item.count > 0);
    if (!hasNew) {
      notificationItems = [];
      renderNotifications();
      return;
    }
  }
  notificationItems = items;
  renderNotifications();
}

function updateInventorySummary() {
  const total = data.length;
  const missingPhone = data.filter(item => !String(item.telefone || '').trim()).length;
  const missingAddress = data.filter(item => !String(item.endereco || '').trim()).length;
  const missingLocal = data.filter(item => !String(item.local || '').trim()).length;
  const totalEl = document.getElementById('inventoryTotal');
  const phoneEl = document.getElementById('inventoryMissingPhone');
  const addressEl = document.getElementById('inventoryMissingAddress');
  const localEl = document.getElementById('inventoryMissingLocal');
  if (totalEl) totalEl.textContent = total;
  if (phoneEl) phoneEl.textContent = missingPhone;
  if (addressEl) addressEl.textContent = missingAddress;
  if (localEl) localEl.textContent = missingLocal;
}

function updateMachineSummary() {
  const total = machineData.length;
  const maintenance = machineData.filter(item => String(item.status || '').toLowerCase() === 'manutenção').length;
  const inactive = machineData.filter(item => String(item.status || '').toLowerCase() === 'inativa').length;
  const missingAsset = machineData.filter(item => !String(item.patrimonio || '').trim()).length;
  const totalEl = document.getElementById('machinesTotal');
  const maintEl = document.getElementById('machinesMaintenance');
  const inactiveEl = document.getElementById('machinesInactive');
  const assetEl = document.getElementById('machinesMissingAsset');
  if (totalEl) totalEl.textContent = total;
  if (maintEl) maintEl.textContent = maintenance;
  if (inactiveEl) inactiveEl.textContent = inactive;
  if (assetEl) assetEl.textContent = missingAsset;
}

function countModuloEmptyCells() {
  if (!Array.isArray(moduloRegistros) || !Array.isArray(moduloCampos)) return 0;
  return moduloRegistros.reduce((total, row) => {
    return total + moduloCampos.filter(campo => !String(row?.[campo.nome] ?? '').trim()).length;
  }, 0);
}

function updateModuleSummary() {
  const totalRecords = Array.isArray(moduloRegistros) ? moduloRegistros.length : 0;
  const totalFields = Array.isArray(moduloCampos) ? moduloCampos.length : 0;
  const emptyCells = countModuloEmptyCells();
  const { modCount } = getActiveFilterCounts();
  const totalEl = document.getElementById('moduleTotalRecords');
  const fieldsEl = document.getElementById('moduleTotalFields');
  const emptyEl = document.getElementById('moduleEmptyCells');
  const filtersEl = document.getElementById('moduleActiveFilters');
  if (totalEl) totalEl.textContent = totalRecords;
  if (fieldsEl) fieldsEl.textContent = totalFields;
  if (emptyEl) emptyEl.textContent = emptyCells;
  if (filtersEl) filtersEl.textContent = modCount;
}

function formatDashboardTimestamp(date = new Date()) {
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function updateDashboardSummary() {
  const inventoryTotal = Number(paginationState.inventory.total || data.length || 0);
  const machinesTotal = Number(paginationState.machines.total || machineData.length || 0);
  const inventoryPending = data.filter(item =>
    !String(item.telefone || '').trim() ||
    !String(item.endereco || '').trim() ||
    !String(item.local || '').trim()
  ).length;
  const machinesMaintenance = machineData.filter(item =>
    String(item.status || '').toLowerCase() === 'manutenção'
  ).length;
  const machinesInactive = machineData.filter(item =>
    String(item.status || '').toLowerCase() === 'inativa'
  ).length;
  const machinesMissingAsset = machineData.filter(item =>
    !String(item.patrimonio || '').trim()
  ).length;
  const moduleRecords = Array.isArray(moduloRegistros) ? moduloRegistros.length : 0;
  const moduleEmptyCells = countModuloEmptyCells();

  const invTotalEl = document.getElementById('dashboardInventoryTotal');
  const invPendingEl = document.getElementById('dashboardInventoryPending');
  const machinesTotalEl = document.getElementById('dashboardMachinesTotal');
  const machinesMaintEl = document.getElementById('dashboardMachinesMaintenance');
  const machinesInactiveEl = document.getElementById('dashboardMachinesInactive');
  const machinesMissingEl = document.getElementById('dashboardMachinesMissingAsset');
  const moduleRecordsEl = document.getElementById('dashboardModuleRecords');
  const moduleEmptyEl = document.getElementById('dashboardModuleEmptyCells');
  const updatedAtEl = document.getElementById('dashboardUpdatedAt');

  if (invTotalEl) invTotalEl.textContent = inventoryTotal;
  if (invPendingEl) invPendingEl.textContent = `${inventoryPending} pendência${inventoryPending === 1 ? '' : 's'}`;
  if (machinesTotalEl) machinesTotalEl.textContent = machinesTotal;
  if (machinesMaintEl) machinesMaintEl.textContent = `${machinesMaintenance} em manutenção`;
  if (machinesInactiveEl) machinesInactiveEl.textContent = machinesInactive;
  if (machinesMissingEl) machinesMissingEl.textContent = `${machinesMissingAsset} sem patrimônio`;
  if (moduleRecordsEl) moduleRecordsEl.textContent = moduleRecords;
  if (moduleEmptyEl) moduleEmptyEl.textContent = `${moduleEmptyCells} campos vazios`;
  if (updatedAtEl) updatedAtEl.textContent = formatDashboardTimestamp();
}

function updateSummaries() {
  updateInventorySummary();
  updateMachineSummary();
  updateModuleSummary();
  updateDashboardSummary();
}

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

function getBulkSelectionContext() {
  const isInventario = selectedInvIds.size > 0;
  const isMaquinas = !isInventario && selectedMaqIds.size > 0;
  const isModulo = !isInventario && !isMaquinas && selectedModuloIds.size > 0;
  if (!isInventario && !isMaquinas && !isModulo) return null;
  const ids = isInventario
    ? [...selectedInvIds]
    : isMaquinas
      ? [...selectedMaqIds]
      : [...selectedModuloIds];
  return {
    type: isInventario ? 'inventario' : isMaquinas ? 'maquinas' : 'modulo',
    ids
  };
}

function resetBulkEditForm() {
  const safe = (id, value = '') => {
    const el = document.getElementById(id);
    if (el) el.value = value;
  };
  safe('bulkCategoria', '');
  safe('bulkLink', '');
  safe('bulkLinkOutro', '');
  safe('bulkVel', '');
  safe('bulkVelOutro', '');
  safe('bulkTel', '');
  safe('bulkLocal', '');
  safe('bulkLocalOutro', '');
  safe('bulkEnd', '');
  safe('bulkStatus', '');
  safe('bulkPatrimonio', '');
  safe('bulkMachineLocal', '');
  safe('bulkMachineLocalOutro', '');
  safe('bulkDescricao', '');
  const moduleFields = document.getElementById('bulkEditModuleFields');
  if (moduleFields) moduleFields.innerHTML = '';
  const toggleOutro = (selectId, inputId) => {
    const input = document.getElementById(inputId);
    if (input) input.style.display = 'none';
  };
  toggleOutro('bulkLink', 'bulkLinkOutro');
  toggleOutro('bulkVel', 'bulkVelOutro');
  toggleOutro('bulkLocal', 'bulkLocalOutro');
  toggleOutro('bulkMachineLocal', 'bulkMachineLocalOutro');
}

function openBulkEditModal() {
  const context = getBulkSelectionContext();
  if (!context) {
    showMessage('Selecione itens para editar em massa.');
    return;
  }
  const modal = document.getElementById('bulkEditModal');
  const subtitle = document.getElementById('bulkEditSubtitle');
  const inventoryFields = document.getElementById('bulkEditInventoryFields');
  const machineFields = document.getElementById('bulkEditMachineFields');
  const moduleFields = document.getElementById('bulkEditModuleFields');
  if (!modal || !inventoryFields || !machineFields || !moduleFields) return;
  resetBulkEditForm();
  const label = context.type === 'inventario' ? 'Inventário' : context.type === 'maquinas' ? 'Máquinas' : 'Módulos';
  if (subtitle) {
    subtitle.textContent = `Você está editando ${context.ids.length} item(ns) de ${label}. Preencha apenas os campos que deseja alterar.`;
  }
  inventoryFields.style.display = context.type === 'inventario' ? 'grid' : 'none';
  machineFields.style.display = context.type === 'maquinas' ? 'grid' : 'none';
  moduleFields.style.display = context.type === 'modulo' ? 'grid' : 'none';
  if (context.type === 'modulo') {
    renderBulkModuleFields(moduleFields);
  }
  showModal(modal);
}

function closeBulkEditModal() {
  const modal = document.getElementById('bulkEditModal');
  if (modal) hideModal(modal);
}

function closeBulkEditModalIfClicked(e) {
  if (e?.target?.id === 'bulkEditModal') {
    requestCloseModal(document.getElementById('bulkEditModal'));
  }
}

function getBulkInventoryUpdates() {
  const updates = {};
  const categoria = (document.getElementById('bulkCategoria')?.value || '').trim();
  if (categoria) updates.categoria = categoria;
  let link = (document.getElementById('bulkLink')?.value || '').trim();
  const linkOutro = (document.getElementById('bulkLinkOutro')?.value || '').trim();
  if (link === 'Outro' && linkOutro) link = linkOutro;
  if (link) updates.link = link;
  let velocidade = (document.getElementById('bulkVel')?.value || '').trim();
  const velOutro = (document.getElementById('bulkVelOutro')?.value || '').trim();
  if (velocidade === 'Outro' && velOutro) velocidade = velOutro;
  if (velocidade) updates.velocidade = velocidade;
  let local = (document.getElementById('bulkLocal')?.value || '').trim();
  const localOutro = (document.getElementById('bulkLocalOutro')?.value || '').trim();
  if (local === 'Outro' && localOutro) local = localOutro;
  if (local) updates.local = local;
  let telefone = (document.getElementById('bulkTel')?.value || '').trim();
  if (telefone) {
    telefone = telefone.replace(/\s+/g, " ").replace(/[^0-9()\- ]/g, "");
    updates.telefone = telefone;
  }
  const endereco = (document.getElementById('bulkEnd')?.value || '').trim();
  if (endereco) updates.endereco = endereco;
  return updates;
}

function getBulkMachineUpdates() {
  const updates = {};
  const status = (document.getElementById('bulkStatus')?.value || '').trim();
  if (status) updates.status = status;
  const patrimonio = (document.getElementById('bulkPatrimonio')?.value || '').trim();
  if (patrimonio) updates.patrimonio = patrimonio;
  let local = (document.getElementById('bulkMachineLocal')?.value || '').trim();
  const localOutro = (document.getElementById('bulkMachineLocalOutro')?.value || '').trim();
  if (local === 'Outro' && localOutro) local = localOutro;
  if (local) updates.local = local;
  const descricao = (document.getElementById('bulkDescricao')?.value || '').trim();
  if (descricao) updates.descricao = descricao;
  return updates;
}

function renderBulkModuleFields(container) {
  if (!container) return;
  if (!Array.isArray(moduloCampos) || !moduloCampos.length) {
    container.innerHTML = '<p class="small">Nenhum campo disponível para edição em massa.</p>';
    return;
  }
  const moduleOptions = loadModuleFieldOptions(moduloAtual?.id);
  container.innerHTML = moduloCampos
    .map((campo, index) => {
      const key = normalizeModuloSortKey(campo.nome);
      const options = Array.isArray(moduleOptions[key]) ? moduleOptions[key] : [];
      const inputId = `bulkModuloField-${index}`;
      if (campo.tipo === 'select' && options.length) {
        return `
          <div>
            <label>${escapeHtml(campo.nome)}</label>
            <select id="${inputId}" data-field="${escapeHtml(campo.nome)}">
              <option value="">Não alterar</option>
              ${options.map(option => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`).join('')}
            </select>
          </div>
        `;
      }
      return `
        <div>
          <label>${escapeHtml(campo.nome)}</label>
          <input id="${inputId}" type="text" data-field="${escapeHtml(campo.nome)}" placeholder="Não alterar" />
        </div>
      `;
    })
    .join('');
}

function getBulkModuleUpdates() {
  const updates = {};
  const container = document.getElementById('bulkEditModuleFields');
  if (!container) return updates;
  container.querySelectorAll('[data-field]').forEach((input) => {
    const value = (input.value || '').trim();
    if (value) {
      updates[input.dataset.field] = value;
    }
  });
  return updates;
}

async function applyBulkEdit() {
  const context = getBulkSelectionContext();
  if (!context) return;
  const saveBtn = document.querySelector('#bulkEditModal .btn-salvar');
  const updates = context.type === 'inventario'
    ? getBulkInventoryUpdates()
    : context.type === 'maquinas'
      ? getBulkMachineUpdates()
      : getBulkModuleUpdates();
  if (!Object.keys(updates).length) {
    showMessage('Informe ao menos um campo para atualizar.');
    return;
  }
  setButtonLoading(saveBtn, true);
  try {
    if (context.type === 'inventario') {
      const requests = context.ids.map((id) => {
        const item = data.find((row) => row.id === id);
        if (!item) return null;
        const payload = { ...item, ...updates };
        return fetch(`${API_URL}/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }).filter(Boolean);
      await Promise.all(requests);
      await fetchData();
    } else if (context.type === 'maquinas') {
      const requests = context.ids.map((id) => {
        const item = machineData.find((row) => row.id === id);
        if (!item) return null;
        const payload = { ...item, ...updates };
        return fetch(`${API_MAQUINAS}/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }).filter(Boolean);
      await fetchMachines();
    } else if (context.type === 'modulo') {
      const requests = context.ids.map((id) => {
        const item = moduloRegistros.find((row) => row.id === id);
        if (!item) return null;
        const payload = { ...item, ...updates };
        return fetch(`${API_MODULOS}/${moduloAtual.id}/registros/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ valores: payload })
        });
      }).filter(Boolean);
      await Promise.all(requests);
      await carregarRegistrosModulo();
      renderModuloDinamico();
    }
    closeBulkEditModal();
    showActionToast('Registros atualizados com sucesso.');
  } catch (err) {
    console.error('Erro ao editar em massa:', err);
    showErrorMessage('Erro ao atualizar registros.');
  } finally {
    setButtonLoading(saveBtn, false);
  }
}

function buildInventoryQueryParams({ page = paginationState.inventory.page, pageSize = paginationState.inventory.pageSize, includePagination = true, includeFilters = true } = {}) {
  const params = new URLSearchParams();
  if (includePagination) {
    const requestPageSize = pageSize === 'all' ? 200 : pageSize;
    params.set('page', page);
    params.set('pageSize', requestPageSize);
  }
  if (includeFilters) {
    const q = (document.getElementById('q')?.value || '').trim();
    if (q) params.set('q', q);
    const cat = (document.getElementById('filterCategoryInv')?.value || 'All');
    if (cat && cat !== 'All') params.set('categoria', cat);
    const invLink = (document.getElementById('invFilterLink')?.value || '').trim();
    if (invLink) params.set('link', invLink);
    const invVel = (document.getElementById('invFilterVel')?.value || '').trim();
    if (invVel) params.set('velocidade', invVel);
    const invTel = (document.getElementById('invFilterTel')?.value || '').trim();
    if (invTel) params.set('telefone', invTel);
    const invLocal = (document.getElementById('invFilterLocal')?.value || '').trim();
    if (invLocal) params.set('local', invLocal);
    const invEnd = (document.getElementById('invFilterEndereco')?.value || '').trim();
    if (invEnd) params.set('endereco', invEnd);
  }
  if (sortState.inventory.key) {
    params.set('sortKey', sortState.inventory.key);
    params.set('sortDir', sortState.inventory.dir);
  }
  return params;
}

function buildMachineQueryParams({ page = paginationState.machines.page, pageSize = paginationState.machines.pageSize, includePagination = true, includeFilters = true } = {}) {
  const params = new URLSearchParams();
  if (includePagination) {
    const requestPageSize = pageSize === 'all' ? 200 : pageSize;
    params.set('page', page);
    params.set('pageSize', requestPageSize);
  }
  if (includeFilters) {
    const q = (document.getElementById('mq')?.value || '').trim();
    if (q) params.set('q', q);
    const status = (document.getElementById('filterMachineStatus')?.value || 'All');
    if (status && status !== 'All') params.set('status', status);
    const mqNome = (document.getElementById('mqFilterNome')?.value || '').trim();
    if (mqNome) params.set('nome_maquina', mqNome);
    const mqPatrimonio = (document.getElementById('mqFilterPatrimonio')?.value || '').trim();
    if (mqPatrimonio) params.set('patrimonio', mqPatrimonio);
    const mqLocal = (document.getElementById('mqFilterLocal')?.value || '').trim();
    if (mqLocal) params.set('local', mqLocal);
    const mqStatus = (document.getElementById('mqFilterStatus')?.value || '').trim();
    if (mqStatus) params.set('status_like', mqStatus);
    const mqDescricao = (document.getElementById('mqFilterDescricao')?.value || '').trim();
    if (mqDescricao) params.set('descricao', mqDescricao);
  }
  if (sortState.machines.key) {
    params.set('sortKey', sortState.machines.key);
    params.set('sortDir', sortState.machines.dir);
  }
  return params;
}

function updatePaginationUI(scope) {
  const state = paginationState[scope];
  if (!state) return;
  const totalPages = state.pageSize === 'all'
    ? 1
    : Math.max(1, Math.ceil(state.total / state.pageSize));
  state.page = Math.min(state.page, totalPages);
  const rangeEl = document.getElementById(`${scope}Range`);
  const pageLabel = document.getElementById(`${scope}PageLabel`);
  const pageSizeSelect = document.getElementById(`${scope}PageSize`);
  const start = state.total === 0 ? 0 : (state.page - 1) * (state.pageSize === 'all' ? state.total : state.pageSize) + 1;
  const end = state.total === 0
    ? 0
    : Math.min(state.page * (state.pageSize === 'all' ? state.total : state.pageSize), state.total);
  if (rangeEl) {
    rangeEl.textContent = `Mostrando ${start}–${end} de ${state.total}`;
  }
  if (pageLabel) {
    pageLabel.textContent = `Página ${state.page} de ${totalPages}`;
  }
  if (pageSizeSelect) {
    pageSizeSelect.value = state.pageSize === 'all' ? 'all' : String(state.pageSize);
  }
  const prevBtn = document.querySelector(`[data-page-action="prev"][data-page-scope="${scope}"]`);
  const nextBtn = document.querySelector(`[data-page-action="next"][data-page-scope="${scope}"]`);
  const isSinglePage = totalPages <= 1;
  if (prevBtn) prevBtn.disabled = state.page <= 1 || isSinglePage;
  if (nextBtn) nextBtn.disabled = state.page >= totalPages || isSinglePage;
}

function setPage(scope, nextPage) {
  const state = paginationState[scope];
  if (!state) return;
  const totalPages = state.pageSize === 'all'
    ? 1
    : Math.max(1, Math.ceil(state.total / state.pageSize));
  const clamped = Math.min(Math.max(nextPage, 1), totalPages);
  if (clamped === state.page) return;
  state.page = clamped;
  if (scope === 'inventory') {
    fetchData();
  } else if (scope === 'machines') {
    fetchMachines();
  } else if (scope === 'modules') {
    renderModuloDinamico();
  }
}

function initPaginationControls() {
  document.querySelectorAll('[data-page-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const scope = btn.dataset.pageScope;
      const action = btn.dataset.pageAction;
      if (!scope || !action) return;
      const state = paginationState[scope];
      if (!state) return;
      if (action === 'prev') setPage(scope, state.page - 1);
      if (action === 'next') setPage(scope, state.page + 1);
    });
  });

  const inventorySelect = document.getElementById('inventoryPageSize');
  if (inventorySelect) {
    inventorySelect.addEventListener('change', (event) => {
      paginationState.inventory.pageSize = event.target.value === 'all' ? 'all' : Number(event.target.value);
      paginationState.inventory.page = 1;
      fetchData();
    });
  }

  const machinesSelect = document.getElementById('machinesPageSize');
  if (machinesSelect) {
    machinesSelect.addEventListener('change', (event) => {
      paginationState.machines.pageSize = event.target.value === 'all' ? 'all' : Number(event.target.value);
      paginationState.machines.page = 1;
      fetchMachines();
    });
  }

  const modulesSelect = document.getElementById('modulesPageSize');
  if (modulesSelect) {
    modulesSelect.addEventListener('change', (event) => {
      paginationState.modules.pageSize = event.target.value === 'all' ? 'all' : Number(event.target.value);
      paginationState.modules.page = 1;
      renderModuloDinamico();
    });
  }
}

  /* ===========================
     FETCH / INIT
     =========================== */
  async function fetchData(){
    if (!document.getElementById('tabInventario')) return;
    const state = paginationState.inventory;
    const isReset = state.page === 1;
    try{
      await ensureManualCustomDataLoaded('inventario');
      state.isLoading = true;
      setTableLoading('tbody', true, getManualTableColspan('inventario'));
      const params = buildInventoryQueryParams({
        page: state.page,
        pageSize: state.pageSize === 'all' ? 200 : state.pageSize
      });
      const res = await fetch(`${API_URL}?${params.toString()}`);
      const payload = await res.json();
      const rows = Array.isArray(payload) ? payload : (payload.data || []);
      if (state.pageSize === 'all' && !Array.isArray(payload)) {
        const total = payload.total ?? rows.length;
        if (total > rows.length) {
          const allRows = await fetchAllPagedRows(API_URL, ({ page, pageSize }) =>
            buildInventoryQueryParams({ page, pageSize })
          );
          rows.splice(0, rows.length, ...allRows);
        }
      }
      paginationState.inventory.total = Array.isArray(payload) ? rows.length : (payload.total ?? rows.length);
      if (!Array.isArray(payload)) {
        paginationState.inventory.page = payload.page || paginationState.inventory.page;
        paginationState.inventory.pageSize = payload.pageSize || paginationState.inventory.pageSize;
      }
      const normalizedRows = applyManualCustomFilters(rows, 'inventario');
      data = normalizedRows;
      selectedInvIds.clear();
      updateBulkUI();
      renderTable(data);
      updateNotifications();
      updateSummaries();
      updateSortIndicators('#tb thead', sortState.inventory);
      updateSortQuickButtons('inventory', sortState.inventory);
      updateFilterBadges();
      updatePaginationUI('inventory');
    } catch(err){
      console.error('Erro ao buscar links:', err);
      if (isReset) {
        data = [];
        selectedInvIds.clear();
        updateBulkUI();
        renderTable([]);
        updateSummaries();
      }
      updatePaginationUI('inventory');
    } finally {
      state.isLoading = false;
      setTableLoading('tbody', false, getManualTableColspan('inventario'));
    }
  }

  async function fetchMachines(){
    if (!document.getElementById('tabMaquinas')) return;
    const state = paginationState.machines;
    const isReset = state.page === 1;
    try{
      await ensureManualCustomDataLoaded('maquinas');
      state.isLoading = true;
      setTableLoading('mtbody', true, getManualTableColspan('maquinas'));
      const params = buildMachineQueryParams({
        page: state.page,
        pageSize: state.pageSize === 'all' ? 200 : state.pageSize
      });
      const res = await fetch(`${API_MAQUINAS}?${params.toString()}`);
      const payload = await res.json();
      const rows = Array.isArray(payload) ? payload : (payload.data || []);
      if (state.pageSize === 'all' && !Array.isArray(payload)) {
        const total = payload.total ?? rows.length;
        if (total > rows.length) {
          const allRows = await fetchAllPagedRows(API_MAQUINAS, ({ page, pageSize }) =>
            buildMachineQueryParams({ page, pageSize })
          );
          rows.splice(0, rows.length, ...allRows);
        }
      }
      paginationState.machines.total = Array.isArray(payload) ? rows.length : (payload.total ?? rows.length);
      if (!Array.isArray(payload)) {
        paginationState.machines.page = payload.page || paginationState.machines.page;
        paginationState.machines.pageSize = payload.pageSize || paginationState.machines.pageSize;
      }
      const normalizedRows = applyManualCustomFilters(rows, 'maquinas');
      machineData = normalizedRows;
      selectedMaqIds.clear();
      updateBulkUI();
      renderMachines(machineData);
      updateNotifications();
      updateSummaries();
      updateSortIndicators('#tabMaquinas thead', sortState.machines);
      updateSortQuickButtons('machines', sortState.machines);
      updateFilterBadges();
      updatePaginationUI('machines');
    } catch(err){
      console.error('Erro ao buscar máquinas:', err);
      if (isReset) {
        machineData = [];
        selectedMaqIds.clear();
        updateBulkUI();
        renderMachines([]);
        updateSummaries();
      }
      updatePaginationUI('machines');
    } finally {
      state.isLoading = false;
      setTableLoading('mtbody', false, getManualTableColspan('maquinas'));
    }
  }

  /* ===========================
     UTIL
     =========================== */
  function escapeHtml(s){ return (s||'').toString().replaceAll('<','&lt;').replaceAll('>','&gt;'); }

  const modalScrollState = new WeakMap();

  function getModalScrollTargets(modalEl) {
    if (!modalEl) return [];
    const targets = [
      ...modalEl.querySelectorAll('.modal-body-scroll, .create-tab-body, .field-manager-body')
    ];
    if (targets.length) return targets;
    const card = modalEl.querySelector('.card');
    return card ? [card] : [];
  }

  function captureModalScrollState(modalEl) {
    if (!modalEl) return;
    const targets = getModalScrollTargets(modalEl);
    const entries = targets.map((el, index) => {
      const key = el.dataset.scrollKey || el.id || `scroll-${index}`;
      el.dataset.scrollKey = key;
      return { key, top: el.scrollTop };
    });
    if (entries.length) {
      modalScrollState.set(modalEl, entries);
    }
  }

  function restoreModalScrollState(modalEl) {
    if (!modalEl) return;
    const entries = modalScrollState.get(modalEl);
    if (!entries) return;
    const targets = getModalScrollTargets(modalEl);
    const map = new Map(entries.map(entry => [entry.key, entry.top]));
    targets.forEach((el, index) => {
      const key = el.dataset.scrollKey || el.id || `scroll-${index}`;
      if (map.has(key)) {
        el.scrollTop = map.get(key);
      }
    });
  }

  function showModal(el){
    if (!el) return;
    el.classList.add('show');
    restoreModalScrollState(el);
  }

  function hideModal(el){
    if (!el) return;
    captureModalScrollState(el);
    el.classList.remove('show');
  }
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
    const tableWrap = tbodyEl.closest('.table-wrap');
    if (!isLoading) {
      tableWrap?.classList.remove('is-loading');
      return;
    }
    tableWrap?.classList.add('is-loading');
    const skeletonRows = Array.from({ length: 5 }, (_, idx) => {
      const width = 60 + (idx * 6);
      return `
        <tr class="skeleton-row">
          <td colspan="${colspan}">
            <div class="skeleton-bar" style="width:${width}%;"></div>
          </td>
        </tr>
      `;
    }).join('');
    tbodyEl.innerHTML = `
      <tr class="loading-row">
        <td colspan="${colspan}">
          <span class="loading-spinner" aria-hidden="true"></span>
          ${message}
        </td>
      </tr>
      ${skeletonRows}
    `;
  }

  function renderEmptyState(tbodyEl, colspan, title, subtitle) {
    if (!tbodyEl) return;
    tbodyEl.innerHTML = `
      <tr>
        <td colspan="${colspan}">
          <div class="empty-state">
            <span class="empty-state-icon" aria-hidden="true">∅</span>
            <div class="empty-state-text">
              <strong>${title}</strong>
              <span>${subtitle}</span>
            </div>
          </div>
        </td>
      </tr>
    `;
  }

  function focusFirstField(modalEl) {
    if (!modalEl) return;
    requestAnimationFrame(() => {
      const target = modalEl.querySelector(
        '[data-autofocus], input, select, textarea, button:not(.help-link)'
      );
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
  if (panelId === 'moduleFilters') {
    openModuleFiltersModal(button);
    return;
  }
  const panel = document.getElementById(panelId);
  if (!panel) return;
  panel.classList.toggle('hidden');
  if (button) {
    const isOpen = !panel.classList.contains('hidden');
    button.setAttribute('aria-pressed', String(isOpen));
  }
}

function showMessage(message, title = 'Aviso', type = 'info') {
    const titleEl = document.getElementById('systemMessageTitle');
    const textEl = document.getElementById('systemMessageText');
    const modalEl = document.getElementById('systemMessageModal');
    if (titleEl) titleEl.textContent = title;
    if (textEl) textEl.textContent = message;
    if (modalEl) {
      modalEl.classList.toggle('system-message-success', type === 'success');
      modalEl.classList.toggle('system-message-error', type === 'error');
      openModalById('systemMessageModal');
    } else {
      console.warn('[UI] Modal systemMessageModal não encontrado.');
    }
  }

function showSuccessMessage(message, title = 'Sucesso') {
  showMessage(message, title, 'success');
}

function showErrorMessage(message, title = 'Erro') {
  showMessage(message, title, 'error');
}

  function closeSystemMessageModal(e) {
    const modalEl = document.getElementById('systemMessageModal');
    if (!modalEl) return;
    if (!e || e.target.id === 'systemMessageModal') {
      captureModalScrollState(modalEl);
      modalEl.classList.remove('show');
    }
  }

  function showConfirm(message, onConfirm, title = 'Confirmar ação', options = {}) {
    confirmCallback = onConfirm;
    const titleEl = document.getElementById('systemConfirmTitle');
    const textEl = document.getElementById('systemConfirmText');
    const modalEl = document.getElementById('systemConfirmModal');
    if (titleEl) titleEl.textContent = title;
    if (textEl) textEl.textContent = message;
    if (modalEl) {
      openModalById('systemConfirmModal', options);
    } else {
      console.warn('[UI] Modal systemConfirmModal não encontrado.');
    }
  }

  function closeSystemConfirmModal(e) {
    const modalEl = document.getElementById('systemConfirmModal');
    if (!modalEl) return;
    if (!e || e.target.id === 'systemConfirmModal') {
      captureModalScrollState(modalEl);
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
      renderEmptyState(
        tbody,
        getManualTableColspan('inventario'),
        'Nenhum registro encontrado',
        'Adicione um novo registro ou ajuste os filtros.'
      );
      tbody.closest('.table-wrap')?.classList.remove('is-loading');
      updateBulkUI();
      return;
    }

    const customFields = getManualCustomFields('inventario');
    const customValues = getManualCustomValues('inventario');

    list.forEach((it, idx) => {
      const tr = document.createElement('tr');
      tr.dataset.id = it.id;
     tr.innerHTML = `
 <td class="checkbox-cell" style="text-align:center;">
    <input 
      type="checkbox"
      class="chk-inv"
      data-id="${it.id}"
      ${selectedInvIds.has(it.id) ? 'checked' : ''}
    >
  </td>

 <td data-field="link">
  <div class="link-cell">
    <div class="link-text">${escapeHtml(it.link)}</div>
    <div class="link-category">${escapeHtml(it.categoria)}</div>
  </div>
</td>



  <td class="small" data-field="velocidade">${escapeHtml(it.velocidade)}</td>
  <td class="small" data-field="telefone">${escapeHtml(it.telefone)}</td>
  <td data-field="local">${escapeHtml(it.local)}</td>
  <td data-field="endereco">${escapeHtml(it.endereco)}</td>
  ${customFields.map((field) => `
    <td data-field="${field.key}">${escapeHtml(customValues[it.id]?.[field.key] || '')}</td>
  `).join('')}
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
    tbody.closest('.table-wrap')?.classList.remove('is-loading');
    applyRowHighlights('inventario', 'tbody');
    if (inventoryFlashAfterFetch) {
      flashTableRows('tbody');
      inventoryFlashAfterFetch = false;
    }
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

if (tbody) {
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

  tbody.addEventListener('click', (e) => {
    if (shouldIgnoreRowToggle(e.target)) return;
    const row = e.target.closest('tr');
    if (!row) return;
    toggleRowCheckbox(row, '.chk-inv');
  });
}

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

const sortCollator = new Intl.Collator('pt-BR', {
  numeric: true,
  sensitivity: 'base'
});

function normalizeSortValue(value) {
  if (value === null || value === undefined) return '';
  return value.toString().trim();
}

function toNumericValue(value) {
  if (typeof value === 'number') return value;
  if (value === null || value === undefined) return null;
  const str = value.toString().trim().replace(',', '.');
  if (!str) return null;
  if (!/^-?\d+(\.\d+)?$/.test(str)) return null;
  const numeric = Number(str);
  return Number.isNaN(numeric) ? null : numeric;
}

function compareSortValues(aValue, bValue) {
  const aNum = toNumericValue(aValue);
  const bNum = toNumericValue(bValue);
  if (aNum !== null && bNum !== null) {
    if (aNum < bNum) return -1;
    if (aNum > bNum) return 1;
    return 0;
  }
  const aStr = normalizeSortValue(aValue);
  const bStr = normalizeSortValue(bValue);
  return sortCollator.compare(aStr, bStr);
}

function sortWithIndex(list, getValue, dir = 'asc') {
  const multiplier = dir === 'desc' ? -1 : 1;
  return list
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const result = compareSortValues(getValue(a.item), getValue(b.item));
      if (result !== 0) return result * multiplier;
      return a.index - b.index;
    })
    .map(({ item }) => item);
}

function setSort(state, key, dir = null) {
  state.key = key;
  if (dir) {
    state.dir = dir;
  }
}

function initSortMenu(menuId, state, onApply) {
  const menu = document.getElementById(menuId);
  if (!menu) return;
  menu.querySelectorAll('[data-sort-key]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setSort(state, btn.dataset.sortKey);
      if (typeof onApply === 'function') onApply({ immediate: true, resetPage: true });
      menu.classList.add('hidden');
    });
  });
}

function updateSortOrderLabel(button, dir) {
  if (!button) return;
  button.textContent =
    dir === 'desc' ? 'Decrescente (Z→A / 9→0)' : 'Crescente (A→Z / 0→9)';
}

function initSortOrderToggle(scope, state, onApply) {
  const button = document.querySelector(`.sort-order-toggle[data-sort-scope="${scope}"]`);
  if (!button) return;
  updateSortOrderLabel(button, state.dir);
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    state.dir = state.dir === 'asc' ? 'desc' : 'asc';
    updateSortOrderLabel(button, state.dir);
    if (state.key && typeof onApply === 'function') {
      onApply({ immediate: true, resetPage: true });
    }
  });
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

function updateSortQuickButtons(scope, state) {
  document.querySelectorAll(`.sort-quick-btn[data-sort-scope="${scope}"]`).forEach((btn) => {
    const isActive =
      btn.dataset.sortKey === state.key &&
      (btn.dataset.sortDir || 'asc') === state.dir;
    btn.classList.toggle('is-active', isActive);
  });
}

function initSortQuickButtons(scope, state, onApply) {
  const buttons = document.querySelectorAll(`.sort-quick-btn[data-sort-scope="${scope}"]`);
  if (!buttons.length) return;
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      setSort(state, btn.dataset.sortKey, btn.dataset.sortDir || 'asc');
      updateSortQuickButtons(scope, state);
      if (typeof onApply === 'function') onApply({ immediate: true, resetPage: true });
    });
  });
  updateSortQuickButtons(scope, state);
}

function toTimestamp(value) {
  if (!value) return null;
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isNaN(numeric) && numeric > 0) return numeric;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function getItemTimestamp(item) {
  const candidates = [
    item.updated_at,
    item.updatedAt,
    item.data_atualizacao,
    item.dataAtualizacao,
    item.created_at,
    item.createdAt,
    item.data_criacao,
    item.dataCriacao
  ];
  for (const candidate of candidates) {
    const timestamp = toTimestamp(candidate);
    if (timestamp !== null) return timestamp;
  }
  if (typeof item.id === 'number') return item.id;
  return 0;
}

function getInventoryIssueScore(item) {
  let score = 0;
  if (!normalizeSortValue(item.link)) score += 2;
  if (!normalizeSortValue(item.telefone)) score += 2;
  if (!normalizeSortValue(item.local)) score += 1;
  if (!normalizeSortValue(item.endereco)) score += 1;
  if (!normalizeSortValue(item.velocidade)) score += 1;
  return score;
}

function getMachineIssueScore(item) {
  let score = 0;
  const status = normalizeSortValue(item.status).toLowerCase();
  if (status === 'manutenção') score += 3;
  if (status === 'inativa') score += 2;
  if (!normalizeSortValue(item.patrimonio)) score += 2;
  if (!normalizeSortValue(item.descricao)) score += 1;
  if (!normalizeSortValue(item.local)) score += 1;
  return score;
}

function getMachineStatusPriority(item) {
  const status = normalizeSortValue(item.status).toLowerCase();
  if (status === 'manutenção') return 0;
  if (status === 'inativa') return 1;
  if (status === 'ativa') return 2;
  return 3;
}

function applyInventorySort(list) {
  if (!sortState.inventory.key) return list;
  const { key, dir } = sortState.inventory;
  if (key === 'issues') {
    return sortWithIndex(list, item => getInventoryIssueScore(item), dir);
  }
  if (key === 'recent') {
    return sortWithIndex(list, item => getItemTimestamp(item), dir);
  }
  return sortWithIndex(list, item => item[key], dir);
}

function applyMachineSort(list) {
  if (!sortState.machines.key) return list;
  const { key, dir } = sortState.machines;
  if (key === 'issues') {
    return sortWithIndex(list, item => getMachineIssueScore(item), dir);
  }
  if (key === 'recent') {
    return sortWithIndex(list, item => getItemTimestamp(item), dir);
  }
  if (key === 'status_priority') {
    return sortWithIndex(list, item => getMachineStatusPriority(item), dir);
  }
  return sortWithIndex(list, item => item[key], dir);
}

function getModuleSortMenuOptions(displayCampos) {
  const candidates = (displayCampos || []).map(campo => ({
    key: normalizeModuloSortKey(campo.nome),
    label: campo.nome
  }));
  const stored = loadModuleSortOptions(moduloAtual?.id);
  if (Array.isArray(stored) && stored.length === 0) {
    return [];
  }
  const selectedKeys = resolveSortOptionsSelection(candidates, stored);
  const filtered = candidates.filter(candidate => selectedKeys.includes(candidate.key));
  return filtered.length ? filtered : candidates;
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

async function fetchImportHistory(limit = 10) {
  try {
    const res = await fetch(`${API_BASE}/import/history?limit=${limit}`);
    if (!res.ok) throw new Error('Falha ao carregar histórico.');
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn('Erro ao buscar histórico de importações:', err);
    return [];
  }
}

async function fetchImportHistoryById(id) {
  try {
    const res = await fetch(`${API_BASE}/import/history/${id}`);
    if (!res.ok) throw new Error('Falha ao carregar importação.');
    return await res.json();
  } catch (err) {
    console.warn('Erro ao buscar importação:', err);
    return null;
  }
}

async function recordImportHistory(entry) {
  try {
    await fetch(`${API_BASE}/import/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry)
    });
  } catch (err) {
    console.warn('Erro ao salvar histórico de importações:', err);
  } finally {
    renderImportHistory();
  }
}

function formatHistoryDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('pt-BR');
}

async function renderImportHistory() {
  const tbody = document.querySelector('#importHistoryTableModal tbody');
  if (!tbody) return;
  const history = await fetchImportHistory();
  if (!history.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="padding:12px;color:#94a3b8">Nenhuma importação registrada.</td></tr>';
    return;
  }
  tbody.innerHTML = history.map((item) => `
    <tr>
      <td>${formatHistoryDate(item.created_at || item.date)}</td>
      <td>${escapeHtml(item.user)}</td>
      <td>${escapeHtml(item.file)}</td>
      <td><span class="import-status ${item.status}">${item.statusLabel}</span></td>
      <td class="actions">
        <button class="btn secondary" type="button" onclick="reprocessImport('${item.id}')">Reprocessar</button>
      </td>
    </tr>
  `).join('');
}

async function clearImportHistory() {
  try {
    await fetch(`${API_BASE}/import/history`, { method: 'DELETE' });
  } catch (err) {
    console.warn('Erro ao limpar histórico:', err);
  } finally {
    renderImportHistory();
  }
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

function getActiveFilterCounts() {
  const q = (document.getElementById('q')?.value || '').trim();
  const cat = (document.getElementById('filterCategoryInv')?.value || 'All');
  const invLink = (document.getElementById('invFilterLink')?.value || '').trim();
  const invVel = (document.getElementById('invFilterVel')?.value || '').trim();
  const invTel = (document.getElementById('invFilterTel')?.value || '').trim();
  const invLocal = (document.getElementById('invFilterLocal')?.value || '').trim();
  const invEnd = (document.getElementById('invFilterEndereco')?.value || '').trim();
  const invCustomCount = countManualCustomFilters('inventario');
  const invCount = [q, invLink, invVel, invTel, invLocal, invEnd].filter(Boolean).length + invCustomCount + (cat !== 'All' ? 1 : 0);

  const mq = (document.getElementById('mq')?.value || '').trim();
  const status = (document.getElementById('filterMachineStatus')?.value || 'All');
  const mqNome = (document.getElementById('mqFilterNome')?.value || '').trim();
  const mqPatrimonio = (document.getElementById('mqFilterPatrimonio')?.value || '').trim();
  const mqLocalCol = (document.getElementById('mqFilterLocal')?.value || '').trim();
  const mqStatusCol = (document.getElementById('mqFilterStatus')?.value || '').trim();
  const mqDescricao = (document.getElementById('mqFilterDescricao')?.value || '').trim();
  const mqCustomCount = countManualCustomFilters('maquinas');
  const mqCount = [mq, mqNome, mqPatrimonio, mqLocalCol, mqStatusCol, mqDescricao].filter(Boolean).length + mqCustomCount + (status !== 'All' ? 1 : 0);

  const modSearch = (document.getElementById('moduleSmartSearch')?.value || '').trim();
  const modColumnFilters = Object.values(moduloColumnFilters || {}).filter(value => value?.trim());
  const modSmartFilters = Object.values(moduloSmartFilters || {}).filter(value => value?.trim());
  const modCount = [modSearch, ...modColumnFilters, ...modSmartFilters].filter(Boolean).length;

  return { invCount, mqCount, modCount };
}

function hasActiveModuleFilters() {
  const modSearch = (document.getElementById('moduleSmartSearch')?.value || '').trim();
  const modColumnFilters = Object.values(moduloColumnFilters || {}).filter(value => value?.trim());
  const modSmartFilters = Object.values(moduloSmartFilters || {}).filter(value => value?.trim());
  return Boolean(modSearch || modColumnFilters.length || modSmartFilters.length);
}

function updateFilterBadges() {
  const { invCount, mqCount, modCount } = getActiveFilterCounts();
  updateFilterBadge('inventory', invCount);
  updateFilterBadge('machines', mqCount);
  updateFilterBadge('modules', modCount);
}

function clearInventoryFilters() {
  const catEl = document.getElementById('filterCategoryInv');
  if (catEl) catEl.value = 'All';
  const headerFilters = ['invFilterLink', 'invFilterVel', 'invFilterTel', 'invFilterLocal', 'invFilterEndereco'];
  headerFilters.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.querySelectorAll('#tabInventario .table-filter-input[data-custom="true"]').forEach((input) => {
    input.value = '';
  });
  applyFilters();
}


let PREFEITURA_LOGO = null;

async function carregarLogoPrefeitura() {
  try {
    const res = await fetch('Imagens/brasao_sem_fundo.png');
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


  function applyFilters(options = {}){
    const { immediate = false, resetPage = true } = options;
    if (resetPage) {
      paginationState.inventory.page = 1;
      if (paginationState.inventory.pageSize !== 'all') {
        paginationState.inventory.pageSize = 20;
      }
    }
    const { invCount } = getActiveFilterCounts();
    inventoryFlashAfterFetch = invCount > 0;
    if (inventoryFilterTimeout) clearTimeout(inventoryFilterTimeout);
    if (immediate) {
      fetchData();
    } else {
      inventoryFilterTimeout = setTimeout(() => {
        fetchData();
      }, 250);
    }
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
    renderManualCustomFields('inventario');
    showModal(modal);
    focusFirstField(modal);
  }
  function closeModal(){ hideModal(modal); }
  function closeModalIfClicked(e){
    if(e.target === modal) requestCloseModal(modal);
  }

  function resetModal(){
    const safe = (id, v='') => { const el = document.getElementById(id); if(!el) return; el.value = v; }
    safe('inpCategoria','Prefeitura');
    safe('inpLink','');
    safe('inpLinkOutro',''); if(document.getElementById('inpLinkOutro')) document.getElementById('inpLinkOutro').style.display='none';
    safe('inpVel',''); safe('inpVelOutro',''); if(document.getElementById('inpVelOutro')) document.getElementById('inpVelOutro').style.display='none';
    safe('inpTel',''); safe('inpLocal',''); safe('inpLocalOutro',''); if(document.getElementById('inpLocalOutro')) document.getElementById('inpLocalOutro').style.display='none';
    safe('inpEnd','');
    renderManualCustomFields('inventario');
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

    renderManualCustomFields('inventario', it.id);
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
  safeAdd('bulkLink','change', function(){ const e = document.getElementById('bulkLinkOutro'); if(!e) return; e.style.display = this.value==='Outro' ? 'block' : 'none'; if(this.value!=='Outro') e.value=''; });
  safeAdd('bulkVel','change', function(){ const e = document.getElementById('bulkVelOutro'); if(!e) return; e.style.display = this.value==='Outro' ? 'block' : 'none'; if(this.value!=='Outro') e.value=''; });
  safeAdd('bulkLocal','change', function(){ const e = document.getElementById('bulkLocalOutro'); if(!e) return; e.style.display = this.value==='Outro' ? 'block' : 'none'; if(this.value!=='Outro') e.value=''; });
  safeAdd('bulkMachineLocal','change', function(){ const e = document.getElementById('bulkMachineLocalOutro'); if(!e) return; e.style.display = this.value==='Outro' ? 'block' : 'none'; if(this.value!=='Outro') e.value=''; });
  safeAdd('bulkTel', 'input', function() { this.value = applyPhoneMask(this.value); });

  async function saveItem(){
    const saveBtn = modal?.querySelector('.btn-salvar');
    const isEdit = editIndex >= 0;
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
      showErrorMessage(`Campo${missingFields.length > 1 ? 's' : ''} obrigatório${missingFields.length > 1 ? 's' : ''}: ${missingFields.join(' e ')}.`);
      return;
    }

    if (telefone && !isValidPhoneNumber(telefone)) {
      showErrorMessage('Telefone inválido. Informe DDD + número (8 a 11 dígitos).');
      return;
    }

    const item = { categoria, link, velocidade, telefone, local, endereco };
    const customValues = collectManualCustomFieldValues('inventario');

    setButtonLoading(saveBtn, true);
    try {
      if(isEdit){
        const id = data[editIndex].id;
        await fetch(`${API_URL}/${id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(item) });
        await setManualCustomValuesForItem('inventario', id, customValues);
        queueRowHighlight('inventario', id);
      } else {
        const res = await fetch(API_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(item) });
        const novo = await res.json();
        data.push(novo);
        await setManualCustomValuesForItem('inventario', novo.id, customValues);
        queueRowHighlight('inventario', novo.id);
      }
      await fetchData();
      closeModal();
      showActionToast(isEdit ? 'Registro atualizado com sucesso.' : 'Registro criado com sucesso.');
    } catch(err){
      console.error('Erro salvar item:', err);
      showErrorMessage('Erro ao salvar item.');
    } finally {
      setButtonLoading(saveBtn, false);
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
        const row = tbody.querySelector(`tr[data-id="${id}"]`);
        row?.classList.add('table-row-removing');
        await fetch(`${API_URL}/${id}`, { method:'DELETE' });
        await removeManualCustomValuesForItem('inventario', id);
        await fetchData();
        if (deletedItem) {
          showUndoToast({ type: 'inventario', items: [deletedItem] });
        }
      } catch(err){
        console.error('Erro remover item:', err);
        showErrorMessage('Erro ao remover item.');
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

async function fetchAllPagedRows(url, paramsBuilder) {
  const pageSize = 200;
  let page = 1;
  let total = 0;
  let rows = [];
  while (true) {
    const params = paramsBuilder({ page, pageSize });
    const res = await fetch(`${url}?${params.toString()}`);
    const payload = await res.json();
    const chunk = Array.isArray(payload) ? payload : (payload.data || []);
    total = Array.isArray(payload) ? chunk.length : (payload.total ?? chunk.length);
    rows = rows.concat(chunk);
    if (rows.length >= total || chunk.length === 0) break;
    page += 1;
  }
  return rows;
}

function mapInventarioExportRows(rows) {
  return rows.map(it => ({
    categoria: it.categoria || '',
    link: it.link || '',
    velocidade: it.velocidade || '',
    telefone: it.telefone || '',
    local: it.local || '',
    endereco: it.endereco || ''
  }));
}

async function getInventarioExportData(scope = 'filtered') {
  if (scope === 'selected') {
    return mapInventarioExportRows(
      data.filter(it => selectedInvIds.has(it.id))
    );
  }

  const includeFilters = scope !== 'all';
  const rows = await fetchAllPagedRows(API_URL, ({ page, pageSize }) =>
    buildInventoryQueryParams({ page, pageSize, includeFilters })
  );
  const filtered = applyManualCustomFilters(rows, 'inventario');
  return mapInventarioExportRows(filtered);
}

async function exportInventario(type, triggerBtn) {
  setButtonLoading(triggerBtn, true);
  try {
    const rows = await getInventarioExportData(selectedInvIds.size > 0 ? 'selected' : 'filtered');

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

    showActionToast('Exportação concluída com sucesso.');
  } finally {
    setButtonLoading(triggerBtn, false);
  }
}

async function exportInventarioRelatorio() {
  const rows = await getInventarioExportData(selectedInvIds.size > 0 ? 'selected' : 'filtered');

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
      fillColor: [71, 85, 105],
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
      renderEmptyState(
        mtbody,
        getManualTableColspan('maquinas'),
        'Nenhuma máquina encontrada',
        'Cadastre uma nova máquina ou ajuste os filtros.'
      );
      mtbody.closest('.table-wrap')?.classList.remove('is-loading');
      updateBulkUI();
      return;
    }

    const customFields = getManualCustomFields('maquinas');
    const customValues = getManualCustomValues('maquinas');

    list.forEach((it, idx) => {
      const tr = document.createElement('tr');
      tr.dataset.id = it.id;
      tr.innerHTML = `
  <td class="checkbox-cell" style="text-align:center">
    <input
      type="checkbox"
      class="chk-mq"
      data-id="${it.id}"
      ${selectedMaqIds.has(it.id) ? 'checked' : ''}
    >
  </td>
  <td data-field="nome_maquina">${escapeHtml(it.nome_maquina || '')}</td>
  <td data-field="patrimonio">${escapeHtml(it.patrimonio || '')}</td>
  <td data-field="local">${escapeHtml(it.local || '')}</td>
<td data-field="status">
  <div class="status-pill status-${normalizeStatus(it.status)}">
    <span class="status-dot"></span>
    <span class="status-text">${it.status || 'Ativa'}</span>
  </div>
</td>



<td data-field="descricao">
  <div
    class="desc-preview"
    data-full="${escapeHtml(it.descricao || '')}"
  >
    ${escapeHtml(it.descricao || '')}
  </div>
</td>
${customFields.map((field) => `
  <td data-field="${field.key}">${escapeHtml(customValues[it.id]?.[field.key] || '')}</td>
`).join('')}

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

  mtbody.closest('.table-wrap')?.classList.remove('is-loading');
  applyRowHighlights('maquinas', 'mtbody');
  if (machinesFlashAfterFetch) {
    flashTableRows('mtbody');
    machinesFlashAfterFetch = false;
  }


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

if (mtbody) {
  mtbody.addEventListener('change', (e) => {
    if (!e.target.classList.contains('chk-mq')) return;

    const id = Number(e.target.dataset.id);

    if (e.target.checked) {
      selectedMaqIds.add(id);
    } else {
      selectedMaqIds.delete(id);
      const chkAll = document.getElementById('chkAllMq');
      if (chkAll) chkAll.checked = false;
    }

    updateBulkUI();
  });

  mtbody.addEventListener('click', (e) => {
    if (shouldIgnoreRowToggle(e.target)) return;
    const row = e.target.closest('tr');
    if (row) {
      toggleRowCheckbox(row, '.chk-mq');
    }
  });
}

if (mtbody) {
  mtbody.addEventListener('click', (e) => {
    const el = e.target.closest('.desc-preview');
    if (!el) return;

    openDescModal(el);
  });
}


  /* ===========================
     FILTROS MÁQUINAS
     =========================== */
  function applyMachineFilters(options = {}) {
    const { immediate = false, resetPage = true } = options;
    if (resetPage) {
      paginationState.machines.page = 1;
      if (paginationState.machines.pageSize !== 'all') {
        paginationState.machines.pageSize = 20;
      }
    }
    const { mqCount } = getActiveFilterCounts();
    machinesFlashAfterFetch = mqCount > 0;
    if (machineFilterTimeout) clearTimeout(machineFilterTimeout);
    if (immediate) {
      fetchMachines();
    } else {
      machineFilterTimeout = setTimeout(() => {
        fetchMachines();
      }, 250);
    }
    updateFilterBadges();
  }

function clearMachineFilters(){
  const mqEl = document.getElementById('mq');
  if (mqEl) mqEl.value = '';
  const statusEl = document.getElementById('filterMachineStatus');
  if (statusEl) statusEl.value = 'All';
  const headerFilters = ['mqFilterNome', 'mqFilterPatrimonio', 'mqFilterLocal', 'mqFilterStatus', 'mqFilterDescricao'];
  headerFilters.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.querySelectorAll('#tabMaquinas .table-filter-input[data-custom="true"]').forEach((input) => {
    input.value = '';
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
    const match = MACHINE_PREFIXES.find(prefix => trimmed.startsWith(prefix));
    if (match) {
      let numero = trimmed.slice(match.length);
      if (numero.startsWith('-')) {
        numero = numero.slice(1);
      }
      return { prefix: match, numero };
    }
    const numeroMatch = trimmed.match(/(\d+)$/);
    return { prefix: MACHINE_PREFIXES[0], numero: numeroMatch ? numeroMatch[1] : '' };
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

    renderManualCustomFields('maquinas');

    showModal(machineModal);
    focusFirstField(machineModal);
  }
  function closeMachineModal(){ hideModal(machineModal); }
  function closeMachineModalIfClicked(e) {
  if (e.target === machineModal) {
    requestCloseModal(machineModal);
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

    renderManualCustomFields('maquinas', it.id);
    showModal(machineModal);
    focusFirstField(machineModal);
  }

  /* ===========================
     CRUD MÁQUINAS
     =========================== */
async function saveMachine(){
  const saveBtn = machineModal?.querySelector('.btn-salvar');
  const isEdit = machineEditIndex >= 0;
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
  const customValues = collectManualCustomFieldValues('maquinas');

if(!item.local){
  showErrorMessage("Informe o local da máquina.");
  return;
}

  if(!machineNumber){
    showErrorMessage("Informe o número da máquina.");
    return;
  }

  if (!/^\d+$/.test(machineNumber)) {
    showErrorMessage("Número da máquina inválido. Use apenas números.");
    return;
  }

  setButtonLoading(saveBtn, true);
  try {
    if(isEdit){
      const id = machineData[machineEditIndex].id;

      await fetch(`${API_MAQUINAS}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item)
      });
      await setManualCustomValuesForItem('maquinas', id, customValues);
      queueRowHighlight('maquinas', id);

    } else {

      const res = await fetch(API_MAQUINAS, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item)
      });

      const novo = await res.json();
      machineData.push(novo);
      await setManualCustomValuesForItem('maquinas', novo.id, customValues);
      queueRowHighlight('maquinas', novo.id);
    }

    await fetchMachines();
    closeMachineModal();
    showActionToast(isEdit ? 'Máquina atualizada com sucesso.' : 'Máquina criada com sucesso.');

  } catch (err) {
    console.error("Erro ao salvar máquina:", err);
    showErrorMessage("Erro ao salvar máquina.");
  } finally {
    setButtonLoading(saveBtn, false);
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
        const row = mtbody.querySelector(`tr[data-id="${id}"]`);
        row?.classList.add('table-row-removing');
        await fetch(`${API_MAQUINAS}/${id}`, { method:'DELETE' });
        await removeManualCustomValuesForItem('maquinas', id);
        await fetchMachines();
        if (deletedItem) {
          showUndoToast({ type: 'maquinas', items: [deletedItem] });
        }
      } catch(err){
        console.error('Erro deletar máquina:', err);
        showErrorMessage('Erro ao deletar máquina.');
      }
    }, 'Confirmar exclusão');
  }
function drawHeader(doc, titulo, logoBase64) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageMargin = 24;
  const titleY = 52;
  const ruleY = 60;
  const logoSize = 12;
  const logoY = 22;
  const textOffset = 6;
  const textStartX = pageMargin + logoSize + textOffset;

  /* ===== LOGO ===== */
  if (logoBase64) {
    const imageType = logoBase64.startsWith('data:image/svg+xml') ? 'SVG' : 'PNG';
    try {
      doc.addImage(
        logoBase64,
        imageType,
        pageMargin,   // X
        logoY,   // Y
        logoSize,   // largura
        logoSize    // altura
      );
    } catch (err) {
      console.warn('Erro ao inserir logo no PDF:', err);
    }
  }

  /* ===== TEXTO INSTITUCIONAL ===== */
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Prefeitura Municipal de São Francisco do Sul', textStartX, 26);

  doc.setFontSize(9);
  doc.setFont('Helvetica', 'normal');
  doc.text('Secretaria Municipal de Tecnologia da Informação', textStartX, 34);

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
function mapMaquinasExportRows(rows) {
  return rows.map(m => ({
    nome_maquina: m.nome_maquina || '',
    patrimonio: m.patrimonio || '',
    local: m.local || '',
    status: m.status || 'Ativa',
    descricao: m.descricao || ''
  }));
}

async function getMaquinasExportData(scope = 'filtered') {
  if (scope === 'selected') {
    return mapMaquinasExportRows(
      machineData.filter(m => selectedMaqIds.has(m.id))
    );
  }

  const includeFilters = scope !== 'all';
  const rows = await fetchAllPagedRows(API_MAQUINAS, ({ page, pageSize }) =>
    buildMachineQueryParams({ page, pageSize, includeFilters })
  );
  const filtered = applyManualCustomFilters(rows, 'maquinas');
  return mapMaquinasExportRows(filtered);
}

async function exportMaquinas(type, triggerBtn) {
  setButtonLoading(triggerBtn, true);
  try {
    const rows = await getMaquinasExportData(selectedMaqIds.size > 0 ? 'selected' : 'filtered');

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

    showActionToast('Exportação concluída com sucesso.');
  } finally {
    setButtonLoading(triggerBtn, false);
  }
}

async function exportMaquinasRelatorio() {
  const rows = await getMaquinasExportData(selectedMaqIds.size > 0 ? 'selected' : 'filtered');

  if (!rows.length) {
    showMessage('Nenhuma máquina para exportar.');
    return;
  }

  exportMaquinasPDF(rows);
  exportMaquinasExcel(rows);
}

function getGuidedExportSelectionCount(dataset) {
  if (dataset === 'inventario') return selectedInvIds.size;
  if (dataset === 'maquinas') return selectedMaqIds.size;
  if (dataset === 'modulo') return selectedModuloIds.size;
  return 0;
}

function getGuidedExportFilteredCount(dataset) {
  if (dataset === 'inventario') return paginationState.inventory.total || data.length || 0;
  if (dataset === 'maquinas') return paginationState.machines.total || machineData.length || 0;
  if (dataset === 'modulo') return getModuloFiltrado().length;
  return 0;
}

function getGuidedExportDatasetLabel(dataset) {
  if (dataset === 'inventario') return 'Inventário';
  if (dataset === 'maquinas') return 'Máquinas';
  if (dataset === 'modulo') return moduloAtual?.nome ? `Módulo: ${moduloAtual.nome}` : 'Módulo atual';
  return 'Inventário';
}

function getGuidedExportScopeLabel(scope) {
  if (scope === 'all') return 'Todos os registros';
  if (scope === 'selected') return 'Somente selecionados';
  return 'Filtros atuais';
}

function getGuidedExportFormatLabel(format) {
  if (format === 'pdf') return 'PDF';
  if (format === 'excel') return 'Excel';
  return 'PDF + Excel';
}

function syncGuidedExportModal() {
  const moduleOption = document.getElementById('guidedExportModuleOption');
  const moduleAvailable = Boolean(moduloAtual?.id);
  if (moduleOption) {
    moduleOption.classList.toggle('is-disabled', !moduleAvailable);
    const input = moduleOption.querySelector('input');
    if (input) input.disabled = !moduleAvailable;
  }

  if (!moduleAvailable && guidedExportState.dataset === 'modulo') {
    guidedExportState.dataset = 'inventario';
  }

  document.querySelectorAll('input[name="guidedExportDataset"]').forEach((input) => {
    input.checked = input.value === guidedExportState.dataset;
  });
  document.querySelectorAll('input[name="guidedExportScope"]').forEach((input) => {
    input.checked = input.value === guidedExportState.scope;
  });
  document.querySelectorAll('input[name="guidedExportFormat"]').forEach((input) => {
    input.checked = input.value === guidedExportState.format;
  });

  const invMeta = document.getElementById('guidedExportInventoryMeta');
  const mqMeta = document.getElementById('guidedExportMachinesMeta');
  const modMeta = document.getElementById('guidedExportModuleMeta');
  if (invMeta) invMeta.textContent = `${paginationState.inventory.total || data.length || 0} registros`;
  if (mqMeta) mqMeta.textContent = `${paginationState.machines.total || machineData.length || 0} registros`;
  if (modMeta) modMeta.textContent = moduleAvailable
    ? `${moduloRegistros.length} registros`
    : 'Selecione uma aba personalizada';

  const selectedCount = getGuidedExportSelectionCount(guidedExportState.dataset);
  const selectedOption = document.getElementById('guidedExportSelectedOption');
  const selectedMeta = document.getElementById('guidedExportSelectedMeta');
  const selectedInput = selectedOption?.querySelector('input');
  if (selectedMeta) selectedMeta.textContent = `${selectedCount} selecionado${selectedCount === 1 ? '' : 's'}`;
  if (selectedOption && selectedInput) {
    const shouldDisable = selectedCount === 0;
    selectedOption.classList.toggle('is-disabled', shouldDisable);
    selectedInput.disabled = shouldDisable;
    if (shouldDisable && guidedExportState.scope === 'selected') {
      guidedExportState.scope = 'filtered';
      document.querySelectorAll('input[name="guidedExportScope"]').forEach((input) => {
        input.checked = input.value === guidedExportState.scope;
      });
    }
  }

  const filteredMeta = document.getElementById('guidedExportFilteredMeta');
  const filteredCount = getGuidedExportFilteredCount(guidedExportState.dataset);
  if (filteredMeta) {
    filteredMeta.textContent = filteredCount
      ? `${filteredCount} registros considerando filtros`
      : 'Considera busca e filtros ativos';
  }

  const summaryDataset = document.getElementById('guidedExportSummaryDataset');
  const summaryScope = document.getElementById('guidedExportSummaryScope');
  const summaryFormat = document.getElementById('guidedExportSummaryFormat');
  if (summaryDataset) summaryDataset.textContent = getGuidedExportDatasetLabel(guidedExportState.dataset);
  if (summaryScope) summaryScope.textContent = getGuidedExportScopeLabel(guidedExportState.scope);
  if (summaryFormat) summaryFormat.textContent = getGuidedExportFormatLabel(guidedExportState.format);
}

function bindGuidedExportInputs() {
  if (guidedExportBound) return;
  document.querySelectorAll('input[name="guidedExportDataset"]').forEach((input) => {
    input.addEventListener('change', () => {
      guidedExportState.dataset = input.value;
      syncGuidedExportModal();
    });
  });
  document.querySelectorAll('input[name="guidedExportScope"]').forEach((input) => {
    input.addEventListener('change', () => {
      guidedExportState.scope = input.value;
      syncGuidedExportModal();
    });
  });
  document.querySelectorAll('input[name="guidedExportFormat"]').forEach((input) => {
    input.addEventListener('change', () => {
      guidedExportState.format = input.value;
      syncGuidedExportModal();
    });
  });
  guidedExportBound = true;
}

function openGuidedExport(dataset = 'inventario') {
  guidedExportState.dataset = dataset;
  guidedExportState.scope = 'filtered';
  guidedExportState.format = 'both';
  bindGuidedExportInputs();
  syncGuidedExportModal();
  document.querySelectorAll('.export-menu').forEach(menu => menu.classList.add('hidden'));
  openModalById('guidedExportModal');
}

function closeGuidedExportModal(event) {
  if (!event || event.target.id === 'guidedExportModal') {
    const modalEl = document.getElementById('guidedExportModal');
    if (modalEl) hideModal(modalEl);
  }
}

function getModuloExportRows(scope) {
  if (scope === 'selected') {
    return moduloRegistros.filter(row => selectedModuloIds.has(row.id));
  }
  if (scope === 'filtered') {
    return getModuloFiltrado().map(({ row }) => row);
  }
  return moduloRegistros;
}

async function confirmGuidedExport() {
  const confirmBtn = document.getElementById('guidedExportConfirmBtn');
  setButtonLoading(confirmBtn, true);
  try {
    const { dataset, scope, format } = guidedExportState;
    if (dataset === 'inventario') {
      const rows = await getInventarioExportData(scope);
      if (!rows.length) {
        showMessage('Nenhum registro de inventário para exportar.');
        return;
      }
      if (format === 'pdf' || format === 'both') exportInventarioPDF(rows);
      if (format === 'excel' || format === 'both') exportInventarioExcel(rows);
    } else if (dataset === 'maquinas') {
      const rows = await getMaquinasExportData(scope);
      if (!rows.length) {
        showMessage('Nenhuma máquina para exportar.');
        return;
      }
      if (format === 'pdf' || format === 'both') exportMaquinasPDF(rows);
      if (format === 'excel' || format === 'both') exportMaquinasExcel(rows);
    } else if (dataset === 'modulo') {
      if (!moduloAtual?.id) {
        showMessage('Selecione uma aba personalizada para exportar.');
        return;
      }
      const rows = getModuloExportRows(scope);
      if (!rows.length) {
        showMessage('Nenhum registro do módulo para exportar.');
        return;
      }
      if (format === 'pdf' || format === 'both') exportModuloPDF(rows);
      if (format === 'excel' || format === 'both') exportModuloExcel(rows);
    }
    showActionToast('Exportação concluída com sucesso.');
    closeGuidedExportModal();
  } finally {
    setButtonLoading(confirmBtn, false);
  }
}

function exportMaquinasPDF(data) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('landscape');
  drawHeader(doc, 'Relatório de Máquinas', PREFEITURA_LOGO);

  doc.autoTable({
    startY: 70,
    head: [[ 'Máquina', 'Patrimônio', 'Local', 'Status', 'Descrição' ]],
    body: data.map(r => [
      r.nome_maquina,
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
      fillColor: [71, 85, 105],
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
    closeTabMenus();
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav a').forEach(a => a.classList.remove('active'));
    document.getElementById('inventoryPageIndicator')?.classList.add('hidden');
    document.getElementById('machinesPageIndicator')?.classList.add('hidden');

    if (tabName === 'dashboard') {
      document.getElementById('tabDashboard')?.classList.add('active');
      document.querySelector('.tab-dinamica-wrapper[data-tab-id="dashboard"] > a')?.classList.add('active');
      updateDashboardSummary();
      return;
    }

    if (tabName === 'inventario') {
      document.getElementById('tabInventario').classList.add('active');
      document.querySelector('.tab-dinamica-wrapper[data-tab-id="inventario"] > a')?.classList.add('active');
      updatePaginationUI('inventory');
    } else if (tabName === 'maquinas') {
      document.getElementById('tabMaquinas').classList.add('active');
      document.querySelector('.tab-dinamica-wrapper[data-tab-id="maquinas"] > a')?.classList.add('active');
      fetchMachines();
      updatePaginationUI('machines');
    } else if (tabName === 'modulo') {
      document.getElementById('tabModuloDinamico')?.classList.add('active');
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
  if (toast) {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.classList.add('hidden');
    }, 250);
  }
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
    showSuccessMessage('Exclusão desfeita com sucesso.');
  } catch (err) {
    console.error('Erro ao desfazer exclusão:', err);
    showErrorMessage('Não foi possível desfazer a exclusão.');
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
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });
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
        showErrorMessage('Selecione uma aba personalizada.');
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
      showErrorMessage('Erro ao excluir itens.');
    }
  }, 'Confirmar exclusão');
}

function openDescModal(el) {
  const modal = document.getElementById('descModal');
  const content = document.getElementById('descModalContent');

  content.textContent = el.dataset.full || 'Sem descrição';
  showModal(modal);
}

function closeDescModal(e) {
  const modal = document.getElementById('descModal');
  if (e && e.target.id === 'descModal') {
    requestCloseModal(modal);
    return;
  }
  if (modal) {
    captureModalScrollState(modal);
    modal.classList.remove('show');
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

function toggleSortMenu(tipo) {
  const menu = document.getElementById('sortMenuMq');
  const invMenu = document.getElementById('sortMenuInv');
  const modMenu = document.getElementById('sortMenuMod');
  const inv = document.getElementById('exportMenuInv');
  const mq = document.getElementById('exportMenuMq');
  const mod = document.getElementById('exportMenuMod');

  if (tipo === 'mq' && menu) {
    menu.classList.toggle('hidden');
    invMenu?.classList.add('hidden');
    modMenu?.classList.add('hidden');
  }
  if (tipo === 'inv' && invMenu) {
    invMenu.classList.toggle('hidden');
    menu?.classList.add('hidden');
    modMenu?.classList.add('hidden');
  }
  if (tipo === 'mod' && modMenu) {
    const { displayCampos } = getModuloDisplayConfig();
    const sortOptions = getModuleSortMenuOptions(displayCampos);
    if (!sortOptions.length) {
      menu?.classList.add('hidden');
      invMenu?.classList.add('hidden');
      modMenu?.classList.add('hidden');
      inv?.classList.add('hidden');
      mq?.classList.add('hidden');
      mod?.classList.add('hidden');
      showMessage('Esta aba ainda não possui filtros ou opções de ordenação definidas.');
      return;
    }
    modMenu.classList.toggle('hidden');
    menu?.classList.add('hidden');
    invMenu?.classList.add('hidden');
  }
  inv?.classList.add('hidden');
  mq?.classList.add('hidden');
  mod?.classList.add('hidden');
}
function openImportModal(type) {
  importType = type;
  resetImportState();

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
  const headerModeEl = document.getElementById('importHeaderMode');
  if (headerModeEl) headerModeEl.value = 'yes';
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
  setImportMappingButtonState();
  updateImportSummary();
  openModalById('importModal');
  renderImportHistory();


}

function closeImportModal() {
  closeImportMappingModal();
  resetImportState();
  const modal = document.getElementById('importModal');
  if (modal) {
    captureModalScrollState(modal);
    modal.classList.remove('show');
  }
  document.getElementById('importStepUpload')?.classList.remove('hidden');
  setImportMappingButtonState();
}

function closeImportModalIfClicked(e) {
  if (e.target.id === 'importModal') {
    requestCloseModal(document.getElementById('importModal'));
  }
}

function openImportUploadModal() {
  document.getElementById('importStepUpload')?.classList.remove('hidden');
  setImportMappingButtonState();
  openModalById('importModal');
}

function openImportMappingModal() {
  if (!importHeaders.length) {
    showImportWarning('Selecione uma planilha antes de abrir o mapeamento.');
    return;
  }
  openModalById('importMappingModal');
  renderImportPreview();
}

function closeImportMappingModal() {
  const modal = document.getElementById('importMappingModal');
  if (modal) {
    captureModalScrollState(modal);
    modal.classList.remove('show');
  }
}

function closeImportMappingModalIfClicked(e) {
  if (e.target.id === 'importMappingModal') {
    requestCloseModal(document.getElementById('importMappingModal'));
  }
}

function resetImportState() {
  importRows = [];
  importHeaders = [];
  importFileName = '';
  importColumnMap = [];
  importHasHeaderRow = false;
  importRawRows = [];
  importHeaderMode = 'yes';
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
  document.getElementById('importStepPreview')?.classList.add('hidden');
  updateImportSummary();
  updateImportWarningToast({ issues: [], errorCount: 0 });
  importWarningDismissed = false;
}

function setImportMappingButtonState() {
  const openBtn = document.getElementById('importOpenMappingBtn');
  if (openBtn) {
    openBtn.disabled = !importHeaders.length;
  }
}

function openImportHistoryModal() {
  renderImportHistory();
  const modal = document.getElementById('importHistoryModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  showModal(modal);
}

function closeImportHistoryModal() {
  const modal = document.getElementById('importHistoryModal');
  if (modal) {
    captureModalScrollState(modal);
    modal.classList.remove('show');
  }
}

function closeImportHistoryModalIfClicked(e) {
  if (e.target.id === 'importHistoryModal') {
    requestCloseModal(document.getElementById('importHistoryModal'));
  }
}

function getImportFieldOptions() {
  if (importType === 'inventario') {
    return [
      { key: 'categoria', label: 'Categoria', aliases: ['categoria'] },
      { key: 'link', label: 'Link', aliases: ['link', 'link de internet', 'internet', 'descricao', 'descrição'] },
      { key: 'velocidade', label: 'Velocidade', aliases: ['velocidade', 'velocidade dl/ul', 'download', 'upload'] },
      { key: 'telefone', label: 'Telefone', aliases: ['telefone', 'contato'] },
      { key: 'local', label: 'Local', aliases: ['local'] },
      { key: 'endereco', label: 'Endereço', aliases: ['endereco', 'endereço'] }
    ];
  }

  if (importType === 'maquinas') {
    return [
      { key: 'nome_maquina', label: 'Nome da Máquina', aliases: ['nome', 'nome maquina', 'nome da maquina', 'maquina', 'máquina'] },
      { key: 'patrimonio', label: 'Patrimônio', aliases: ['patrimonio', 'patrimônio'] },
      { key: 'local', label: 'Local', aliases: ['local'] },
      { key: 'status', label: 'Status', aliases: ['status'] },
      { key: 'descricao', label: 'Descrição', aliases: ['descricao', 'descrição'] }
    ];
  }

  if (importType === 'modulo') {
    return (moduloCampos || []).map(c => ({
      key: c.nome,
      label: c.nome,
      aliases: [normalizeHeader(c.nome)]
    }));
  }

  return [];
}

function buildImportColumnMap(headers) {
  const options = getImportFieldOptions();
  const expandedOptions = options.map((opt) => ({
    ...opt,
    aliases: Array.from(new Set([opt.key, opt.label, ...opt.aliases].filter(Boolean)))
  }));

  return headers.map((header) => {
    const normalized = normalizeHeader(header);
    const normalizedKey = normalizeHeaderKey(header);
    const headerTokens = normalizedKey.match(/[a-z0-9]+/g) || [];
    let bestMatch = null;
    let bestScore = 0;

    expandedOptions.forEach((opt) => {
      opt.aliases.forEach((alias) => {
        const aliasNormalized = normalizeHeader(alias);
        const aliasKey = normalizeHeaderKey(alias);
        const aliasTokens = aliasKey.match(/[a-z0-9]+/g) || [];
        let score = 0;
        if (aliasNormalized === normalized || aliasKey === normalizedKey) {
          score = 3;
        } else if (
          normalizedKey.includes(aliasKey) ||
          aliasKey.includes(normalizedKey)
        ) {
          score = 2;
        } else if (
          normalized.includes(aliasNormalized) ||
          aliasNormalized.includes(normalized)
        ) {
          score = 1;
        }
        if (!score && headerTokens.length && aliasTokens.length) {
          const overlap = headerTokens.filter(token => aliasTokens.includes(token)).length;
          if (overlap) {
            score = Math.min(2, overlap / Math.max(headerTokens.length, aliasTokens.length));
          }
        }
        if (score > bestScore) {
          bestScore = score;
          bestMatch = opt;
        }
      });
    });

    return bestMatch ? bestMatch.key : '';
  });
}

function updateImportSummary() {
  const rowsEl = document.getElementById('importSummaryRows');
  const colsEl = document.getElementById('importSummaryCols');
  const headerEl = document.getElementById('importSummaryHeader');
  if (rowsEl) rowsEl.textContent = importRows.length.toString();
  if (colsEl) colsEl.textContent = importHeaders.length.toString();
  if (headerEl) {
    const headerLabel = importHeaderMode === 'yes' ? 'Sim' : 'Não';
    headerEl.textContent = headerLabel;
  }
}

function setImportHeaderMode(mode) {
  importHeaderMode = mode;
  if (importRawRows.length) {
    processImportData();
  }
  updateImportSummary();
}

function autoMapImportColumns() {
  importColumnMap = buildImportColumnMap(importHeaders);
  renderImportPreview();
}

function clearImportMapping() {
  importColumnMap = Array.from({ length: importHeaders.length }, () => '');
  renderImportPreview();
}

function processImportData() {
  const cleaned = importRawRows || [];
  const options = getImportFieldOptions();
  const dataRows = cleaned.filter(row => row.some(cell => `${cell ?? ''}`.trim() !== ''));
  let maxCols = dataRows.reduce((max, row) => Math.max(max, row.length), 0);
  let headerRowIndex = null;
  let hasHeaderRow = false;
  const headerCandidates = cleaned.map((row, index) => {
    const normalized = row.map(cell => normalizeHeader(cell));
    const nonEmptyCount = normalized.filter(cell => cell).length;
    const score = normalized.reduce((acc, cell) => {
      if (!cell) return acc;
      const hasMatch = options.some(opt => opt.aliases.some(alias => normalizeHeader(alias) === cell));
      return hasMatch ? acc + 1 : acc;
    }, 0);
    return { index, score, row, normalized, nonEmptyCount };
  });
  const bestCandidate = headerCandidates
    .filter(item => item.score > 0 && item.nonEmptyCount > 0)
    .sort((a, b) => (b.score - a.score) || (b.nonEmptyCount - a.nonEmptyCount))[0];

  if (importHeaderMode === 'yes') {
    headerRowIndex = cleaned.findIndex(row => row.some(cell => `${cell ?? ''}`.trim() !== ''));
    hasHeaderRow = headerRowIndex !== -1;
    const firstCandidate = headerRowIndex !== -1 ? headerCandidates[headerRowIndex] : null;
    if (bestCandidate && firstCandidate && bestCandidate.score > firstCandidate.score) {
      headerRowIndex = bestCandidate.index;
    }
  } else if (importHeaderMode === 'no') {
    headerRowIndex = null;
    hasHeaderRow = false;
  } else {
    if (bestCandidate) {
      headerRowIndex = bestCandidate.index;
      hasHeaderRow = true;
    }
  }

  if (!dataRows.length) {
    importHeaders = [];
    importRows = [];
    importColumnMap = [];
    importHasHeaderRow = false;
    renderImportPreview();
    return;
  }

  if (!hasHeaderRow || headerRowIndex === null) {
    importHeaders = Array.from({ length: maxCols }, (_, idx) => `Coluna ${columnLetter(idx)}`);
    importRows = dataRows;
    importColumnMap = Array.from({ length: maxCols }, () => '');
    importHasHeaderRow = false;
    renderImportPreview();
    return;
  }

  maxCols = Math.max(maxCols, cleaned[headerRowIndex].length);
  importHeaders = Array.from({ length: maxCols }, (_, idx) => {
    const header = (cleaned[headerRowIndex] || [])[idx] ?? '';
    return header || `Coluna ${columnLetter(idx)}`;
  });

  const headerNormalized = cleaned[headerRowIndex].map(cell => normalizeHeader(cell));
  importRows = cleaned
    .slice(headerRowIndex + 1)
    .filter(row => row.some(cell => `${cell ?? ''}`.trim() !== ''))
    .filter(row => {
      const normalizedRow = row.map(cell => normalizeHeader(cell));
      return normalizedRow.join('|') !== headerNormalized.join('|');
    });

  importColumnMap = buildImportColumnMap(importHeaders);
  importHasHeaderRow = true;
  renderImportPreview();
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
    importRawRows = data.map(row => (row || []).map(cell => (cell ?? '').toString().trim()));
    processImportData();
    setImportMappingButtonState();
    if (importHeaders.length) {
      openImportMappingModal();
    }
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
    const issues = [];
    const cellIssues = new Set();
    let errorCount = 0;
    const requiredFields = (moduloCampos || []).filter(campo => campo?.obrigatorio);

    if (!importColumnMap.some((value) => value)) {
      issues.push('Selecione ao menos um campo para mapear.');
    }

    requiredFields.forEach((field) => {
      if (!importColumnMap.includes(field.nome)) {
        issues.push(`Campo obrigatório não mapeado: ${field.nome}`);
      }
    });

    importRows.forEach((row, rowIndex) => {
      requiredFields.forEach((field) => {
        const colIndex = importColumnMap.indexOf(field.nome);
        if (colIndex === -1) return;
        const value = (row[colIndex] ?? '').toString().trim();
        if (!value) {
          errorCount += 1;
          cellIssues.add(`${rowIndex}-${colIndex}`);
        }
      });
    });

    return { issues, cellIssues, errorCount };
  }

  const issues = [];
  const cellIssues = new Set();
  let errorCount = 0;

  const requiredFields =
    importType === 'inventario'
      ? [
          { key: 'link', label: 'Link' },
          { key: 'local', label: 'Local' }
        ]
      : [
          { key: 'nome_maquina', label: 'Nome da Máquina' },
          { key: 'local', label: 'Local' }
        ];

  requiredFields.forEach((field) => {
    if (!importColumnMap.includes(field.key)) {
      issues.push(`Campo obrigatório não mapeado: ${field.label}`);
    }
  });

  importRows.forEach((row, rowIndex) => {
    requiredFields.forEach((field) => {
      const colIndex = importColumnMap.indexOf(field.key);
      if (colIndex === -1) return;
      const value = (row[colIndex] ?? '').toString().trim();
      if (!value) {
        errorCount += 1;
        cellIssues.add(`${rowIndex}-${colIndex}`);
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
  const validationEl = document.getElementById('importValidation');
  const extraFieldWrapper = document.getElementById('importExtraField');
  const fieldOptions = getImportFieldOptions();

  if (!importColumnMap.length) {
    importColumnMap = Array.from({ length: importHeaders.length }, () => '');
  }

  const mappingOptions = (selected) => `
    <option value="">Ignorar</option>
    ${fieldOptions.map(opt => `
      <option value="${opt.key}" ${selected === opt.key ? 'selected' : ''}>${opt.label}</option>
    `).join('')}
  `;

  thead.innerHTML = `
    <tr class="import-mapping-row">
      ${importHeaders.map((_, idx) => `
        <th>
          <select data-col="${idx}" onchange="updateImportMapping(${idx}, this.value)">
            ${mappingOptions(importColumnMap[idx])}
          </select>
        </th>
      `).join('')}
      <th>Mapeamento</th>
    </tr>
    <tr class="import-bulk-row">
      ${importHeaders.map((_, idx) => `
        <th>
          <input
            type="text"
            class="import-bulk-input"
            placeholder="Preencher coluna"
            oninput="fillImportColumn(${idx}, this.value)"
          />
        </th>
      `).join('')}
      <th>Preencher</th>
    </tr>
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
  if (actionBtn) {
    actionBtn.textContent = `Importar ${importRows.length} linha(s)`;
    actionBtn.disabled = false;
  }

  renderImportValidation(validation, validationEl);
  updateImportExtraFieldOptions(fieldOptions, extraFieldWrapper);
  updateImportSummary();
}

function updateImportCell(row, col, value) {
  importRows[row][col] = value;
  applyImportValidation();
}

function updateImportMapping(col, value) {
  importColumnMap[col] = value;
  applyImportValidation();
}

function fillImportColumn(col, value) {
  importRows.forEach((row) => {
    row[col] = value;
  });
  document
    .querySelectorAll(`#importPreviewTable tbody td[data-col="${col}"]`)
    .forEach((td) => {
      td.innerText = value;
    });
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
  const extraFieldWrapper = document.getElementById('importExtraField');

  document.querySelectorAll('#importPreviewTable tbody td[data-row]').forEach(td => {
    const key = `${td.dataset.row}-${td.dataset.col}`;
    td.classList.toggle('import-error', validation.cellIssues.has(key));
  });

  if (actionBtn) {
    actionBtn.disabled = false;
  }

  renderImportValidation(validation, validationEl);
  updateImportExtraFieldOptions(getImportFieldOptions(), extraFieldWrapper);
}

function updateImportWarningToast(validation) {
  const hasIssues = validation.issues.length || validation.errorCount > 0;
  if (!hasIssues) {
    if (importWarningVisible) {
      hideImportWarningNotice();
    }
    importWarningDismissed = false;
    return;
  }

  const issueCount = validation.issues.length;
  const errorCount = validation.errorCount;
  const parts = [];
  if (issueCount > 0) {
    parts.push(`${issueCount} campo(s) obrigatório(s) sem mapeamento`);
  }
  if (errorCount > 0) {
    parts.push(`${errorCount} célula(s) obrigatória(s) vazia(s)`);
  }
  const message = `Antes de importar, corrija: ${parts.join(' e ')}.`;
  if (!importWarningDismissed) {
    showImportWarningNotice(message);
  }
}

function updateImportExtraFieldOptions(options = [], wrapper) {
  if (!wrapper) return;
  const select = document.getElementById('importExtraFieldSelect');
  if (!select) return;
  const available = options.filter((opt) => !importColumnMap.includes(opt.key));
  if (!available.length) {
    wrapper.classList.add('hidden');
    select.innerHTML = '';
    return;
  }
  wrapper.classList.remove('hidden');
  select.innerHTML = available
    .map((opt) => `<option value="${opt.key}">${opt.label}</option>`)
    .join('');
}

function addMissingImportField() {
  const select = document.getElementById('importExtraFieldSelect');
  const valueInput = document.getElementById('importExtraFieldValue');
  if (!select) return;
  const fieldKey = select.value;
  if (!fieldKey) {
    showImportWarning('Selecione um campo para adicionar.');
    return;
  }
  const fieldOptions = getImportFieldOptions();
  const field = fieldOptions.find(opt => opt.key === fieldKey);
  const label = field?.label || fieldKey;
  const value = valueInput?.value ?? '';
  importHeaders.push(label);
  importColumnMap.push(fieldKey);
  importRows = importRows.map((row) => [...row, value]);
  if (valueInput) valueInput.value = '';
  renderImportPreview();
}

function addImportColumn() {
  const nextIndex = importHeaders.length + 1;
  importHeaders.push(`Nova coluna ${nextIndex}`);
  importColumnMap.push('');
  importRows = importRows.map((row) => [...row, '']);
  renderImportPreview();
}

function renderImportValidation(validation, validationEl) {
  if (validationEl) {
    validationEl.classList.add('hidden');
    validationEl.innerHTML = '';
  }
  updateImportWarningToast(validation);
}
function mapImportRows() {
  const getValue = (row, fieldKey, fallbackIndex) => {
    const idx = importColumnMap.indexOf(fieldKey);
    if (idx !== -1) return row[idx];
    if (importHasHeaderRow || fallbackIndex === undefined || fallbackIndex >= row.length) return '';
    return row[fallbackIndex];
  };

  if (importType === 'inventario') {
    return importRows.map(r => ({
      categoria: (() => {
        const value = (getValue(r, 'categoria', 0) ?? '').toString().trim();
        return value || 'Prefeitura';
      })(),
      link: getValue(r, 'link', 1),
      velocidade: getValue(r, 'velocidade', 2),
      telefone: getValue(r, 'telefone', 3),
      local: getValue(r, 'local', 4),
      endereco: getValue(r, 'endereco', 5)
    }));
  }

  if (importType === 'maquinas') {
    return importRows.map(r => ({
      nome_maquina: getValue(r, 'nome_maquina', 0),
      patrimonio: getValue(r, 'patrimonio', 1),
      local: getValue(r, 'local', 2),
      status: (() => {
        const value = (getValue(r, 'status', 3) ?? '').toString().trim();
        return value || 'Ativa';
      })(),
      descricao: getValue(r, 'descricao', 4)
    }));
  }

  return [];
}

function mapModuloImportRows() {
  return importRows.map((row) => {
    const valores = {};
    (moduloCampos || []).forEach((campo) => {
      const fieldKey = campo?.nome;
      if (!fieldKey) return;
      const colIndex = importColumnMap.indexOf(fieldKey);
      valores[fieldKey] = colIndex >= 0 ? (row[colIndex] ?? '') : '';
    });
    return valores;
  });
}

async function runModuloImport(rows, moduleId) {
  let successCount = 0;
  const errors = [];

  for (let i = 0; i < rows.length; i++) {
    try {
      const response = await fetch(`${API_MODULOS}/${moduleId}/registros`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valores: rows[i] })
      });
      if (!response.ok) {
        let message = `Falha ao importar (status ${response.status}).`;
        try {
          const data = await response.json();
          if (data?.error) message = data.error;
        } catch (err) {
          // ignore parse errors
        }
        errors.push({ linha: i + 2, erro: message });
        continue;
      }
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
  const entry = await fetchImportHistoryById(id);
  if (!entry) {
    showErrorMessage('Importação não encontrada no histórico.');
    return;
  }

  try {
    const result = await executeImport({
      type: entry.type,
      rows: entry.payload?.rows || [],
      moduleId: entry.payload?.moduleId || entry.moduleId
    });

    await recordImportHistory({
      user: getCurrentUserName(),
      file: `Reprocessado: ${entry.file}`,
      status: result.status,
      statusLabel: result.statusLabel,
      type: entry.type,
      errorCount: result.errorCount || 0,
      successCount: result.successCount || 0,
      payload: {
        rows: entry.payload?.rows || [],
        moduleId: entry.payload?.moduleId || entry.moduleId || null
      }
    });

    if (entry.type === 'modulo') {
      await carregarRegistrosModulo();
      renderModuloDinamico();
    } else {
      await fetchData();
      await fetchMachines();
    }

    showSuccessMessage(`Reprocessamento concluído (${result.statusLabel}).`);
  } catch (err) {
    console.error(err);
    showErrorMessage('Erro ao reprocessar importação.');
    await recordImportHistory({
      user: getCurrentUserName(),
      file: `Reprocessado: ${entry.file}`,
      status: 'error',
      statusLabel: 'Falhou',
      type: entry.type,
      errorCount: 1,
      successCount: 0,
      payload: {
        rows: entry.payload?.rows || [],
        moduleId: entry.payload?.moduleId || entry.moduleId || null
      }
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

function normalizeHeaderKey(value = '') {
  return normalizeHeader(value).replace(/[^a-z0-9]/g, '');
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
  const actionBtn = document.getElementById('importActionBtn');
  const validation = validateImportRows();
  if (validation.issues.length || validation.errorCount > 0) {
    importWarningDismissed = false;
    updateImportWarningToast(validation);
    return;
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

  setButtonLoading(actionBtn, true);
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
      showSuccessMessage('Importação realizada com sucesso!', 'Importação concluída');
    }

    await recordImportHistory({
      user: getCurrentUserName(),
      file: fileName,
      status: result.status,
      statusLabel: result.statusLabel,
      type: importType,
      errorCount: result.errorCount || result.errors?.length || 0,
      successCount: result.successCount || result.inserted || 0,
      payload: {
        rows,
        moduleId: importType === 'modulo' ? moduloAtual?.id : null
      }
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
    showErrorMessage('Erro ao importar dados.');
    await recordImportHistory({
      user: getCurrentUserName(),
      file: fileName,
      status: 'error',
      statusLabel: 'Falhou',
      type: importType,
      errorCount: 1,
      successCount: 0,
      payload: {
        rows,
        moduleId: importType === 'modulo' ? moduloAtual?.id : null
      }
    });
  } finally {
    setButtonLoading(actionBtn, false);
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

  const hasMatch = importColumnMap.some((value) => value);
  if (!hasMatch) {
    showImportWarning('Selecione ao menos um campo para mapear antes de importar.');
  }

  const rows = mapModuloImportRows();
  const result = await executeImport({ type: 'modulo', rows, moduleId: moduloAtual.id });

  if (result.errorCount > 0) {
    console.table(result.errors);
    showErrorMessage(`Importação concluída com ${result.errorCount} erro(s).`, 'Importação com erro');
  } else {
    showSuccessMessage(`Importação concluída: ${result.successCount} registro(s).`, 'Importação concluída');
  }

  await carregarRegistrosModulo();
  renderModuloDinamico();
}

function exportModulo(tipo, triggerBtn, rowsOverride = null) {
  const rowsToExport = Array.isArray(rowsOverride) ? rowsOverride : moduloRegistros;
  if (!moduloCampos.length || !rowsToExport.length) {
    showMessage('Nenhum registro para exportar.');
    return;
  }

  setButtonLoading(triggerBtn, true);
  try {
    if (tipo === 'excel') {
      exportModuloExcel(rowsToExport);
    } else if (tipo === 'pdf') {
      exportModuloPDF(rowsToExport);
    } else if (tipo === 'both') {
      exportModuloPDF(rowsToExport);
      exportModuloExcel(rowsToExport);
    }
    showActionToast('Exportação concluída com sucesso.');
  } finally {
    setButtonLoading(triggerBtn, false);
  }
}

function exportModuloExcel(rowsOverride = null) {
  const rowsToExport = Array.isArray(rowsOverride) ? rowsOverride : moduloRegistros;
  const headers = moduloCampos.map(c => c.nome);
  const rows = rowsToExport.map(row => (
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

function exportModuloPDF(rowsOverride = null) {
  const rowsToExport = Array.isArray(rowsOverride) ? rowsOverride : moduloRegistros;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('landscape');
  const headers = moduloCampos.map(c => c.nome);
  const data = rowsToExport.map(row =>
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
      fillColor: [71, 85, 105],
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
  nav.querySelectorAll('.tab-dinamica-wrapper[data-tab-type="module"]').forEach(e => e.remove());

  modulos.forEach(mod => {
    const wrapper = document.createElement('div');
    wrapper.className = 'tab-dinamica-wrapper';
    wrapper.dataset.tabType = 'module';

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

    const menuBtn = document.createElement('button');
    menuBtn.type = 'button';
    menuBtn.className = 'tab-menu-btn';
    menuBtn.title = 'Opções da aba';
    menuBtn.setAttribute('aria-haspopup', 'menu');
    menuBtn.setAttribute('aria-expanded', 'false');
    menuBtn.innerHTML = '⋯';
    menuBtn.onclick = (e) => {
      e.stopPropagation();
      toggleTabMenu(menuBtn, e);
    };

    const menu = document.createElement('div');
    menu.className = 'tab-menu-dropdown hidden';
    menu.id = `tabMenuModulo-${mod.id}`;
    menu.setAttribute('role', 'menu');
    menuBtn.setAttribute('aria-controls', menu.id);
    menu.innerHTML = `
      <button type="button" data-action="manage">Gerenciar</button>
      <button type="button" data-action="delete">
        Excluir
        <svg class="menu-icon delete-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 6h18"/>
          <path d="M8 6v12"/>
          <path d="M16 6v12"/>
          <path d="M6 6l1 14h10l1-14"/>
          <path d="M9 6V4h6v2"/>
        </svg>
      </button>
    `;

    menu.querySelector('[data-action="manage"]').onclick = (e) => {
      e.stopPropagation();
      closeTabMenus();
      openManageModule(mod);
    };
    menu.querySelector('[data-action="delete"]').onclick = (e) => {
      e.stopPropagation();
      closeTabMenus();
      openConfirmDeleteModulo(mod);
    };

    wrapper.appendChild(a);
    wrapper.appendChild(menuBtn);
    wrapper.appendChild(menu);
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
    switchTab('dashboard');
    showActionToastLeft(`Aba "${moduloDeleteTarget.nome}" excluída.`);
  } catch (e) {
    console.error('Erro ao excluir módulo:', e);
    showErrorMessage('Erro ao excluir a aba.');
  } finally {
    moduloDeleteTarget = null;
    closeConfirmDeleteModulo();
  }
}

async function abrirModulo(mod) {
  closeTabMenus();
  moduloAtual = mod;
  paginationState.modules.page = 1;
  moduloColumnFilters = {};
  moduloSmartFilters = {};
  moduloSmartSearchText = '';

  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav a, .nav .tab-dinamica').forEach(a => a.classList.remove('active'));
  const activeTab = document.querySelector(`.nav [data-modulo-id="${mod.id}"]`);
  if (activeTab) activeTab.classList.add('active');

  document.getElementById('moduloTitulo').textContent = mod.nome;
  document.getElementById('moduloDescricao').textContent = mod.descricao || 'Tabela personalizada';

  await ensureModulePreferencesLoaded(mod.id);
  await carregarCamposModulo();
  await carregarRegistrosModulo();

  renderModuloDinamico();
}

async function carregarCamposModulo() {
  const res = await fetch(`${API_MODULOS}/${moduloAtual.id}/campos`);
  moduloCampos = await res.json();
}

async function carregarRegistrosModulo() {
  const { displayCampos } = getModuloDisplayConfig();
  const colspan = (displayCampos?.length || 0) + 2;
  if (colspan > 1) {
    setTableLoading('moduloTbody', true, colspan);
  }
  const res = await fetch(`${API_MODULOS}/${moduloAtual.id}/registros`);
  moduloRegistros = await res.json();
}

function getModuloDisplayConfig() {
  const normalizeFieldKey = (name) => normalizeHeader(name || '').replace(/\s+/g, '');
  const categoriaField = moduloCampos.find(
    (campo) => normalizeFieldKey(campo.nome) === 'categoria'
  );
  if (!categoriaField) {
    return {
      displayCampos: moduloCampos,
      categoriaFieldName: '',
      categoriaAnchorFieldName: '',
      shouldMergeCategoria: false
    };
  }
  const moduleOptions = loadModuleFieldOptions(moduloAtual?.id);
  const storedAnchor = moduleOptions.__categoriaAnchor;
  const anchorField = storedAnchor
    ? moduloCampos.find((campo) => normalizeFieldKey(campo.nome) === storedAnchor)
    : moduloCampos.find((campo) => normalizeFieldKey(campo.nome) !== 'categoria');
  const shouldMergeCategoria = Boolean(anchorField && categoriaField);
  const displayCampos = shouldMergeCategoria
    ? moduloCampos.filter((campo) => campo.nome !== categoriaField.nome)
    : moduloCampos;
  return {
    displayCampos,
    categoriaFieldName: categoriaField?.nome || '',
    categoriaAnchorFieldName: anchorField?.nome || '',
    shouldMergeCategoria
  };
}

function renderModuloDinamico() {
  const tab = document.getElementById('tabModuloDinamico');
  const thead = document.getElementById('moduloThead');
  const tbody = document.getElementById('moduloTbody');

  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');

  const { displayCampos, categoriaFieldName, categoriaAnchorFieldName } = getModuloDisplayConfig();
  const moduleFiltersPanel = document.getElementById('moduleFiltersPanel');
  const moduleFiltersButton = document.querySelector('#tabModuloDinamico .filter-btn');

  // HEADER
  thead.innerHTML = `
    <tr>
      <th class="checkbox-cell">
        <input type="checkbox" id="chkAllMod">
      </th>
      ${displayCampos.map(c => `
        <th>${c.nome}</th>
      `).join('')}
      <th class="actions-header" style="width:110px; text-align:center">Ações</th>
    </tr>
  `;

  renderModuloFilterControls(displayCampos);

  if (moduleFiltersPanel && !displayCampos.length) {
    moduleFiltersPanel.classList.add('hidden');
    if (moduleFiltersButton) moduleFiltersButton.setAttribute('aria-pressed', 'false');
  }

  const sortMenuOptions = document.getElementById('sortMenuModOptions');
  if (sortMenuOptions) {
    const availableOptions = getModuleSortMenuOptions(displayCampos);
    sortMenuOptions.innerHTML = availableOptions
      .map((campo) => `<button type="button" data-sort-key="${campo.label}">${campo.label}</button>`)
      .join('');
    initSortMenu('sortMenuMod', moduloSortState, renderModuloDinamico);
  }

  renderModuloBody(displayCampos, categoriaFieldName, categoriaAnchorFieldName);
}

function renderModuloFilterControls(displayCampos) {
  const panel = document.getElementById('moduleFiltersPanel');
  if (!panel) return;
  const select = document.getElementById('moduleFilterFieldSelect');
  if (select) {
    select.innerHTML = [
      '<option value="">Selecione um campo</option>',
      ...displayCampos.map(campo => `<option value="${campo.nome}">${escapeHtml(campo.nome)}</option>`)
    ].join('');
  }
  const presetSelect = document.getElementById('moduleFilterPresetSelect');
  if (presetSelect) {
    const presets = loadModuloFilterPresets();
    presetSelect.innerHTML = [
      '<option value="">Presets salvos</option>',
      ...presets.map((preset, index) => `<option value="${index}">${escapeHtml(preset.name)}</option>`)
    ].join('');
  }
  const searchInput = document.getElementById('moduleSmartSearch');
  if (searchInput && searchInput.value !== moduloSmartSearchText) {
    searchInput.value = moduloSmartSearchText;
  }
  if (!panel.dataset.bound) {
    panel.dataset.bound = 'true';
    const smartInput = document.getElementById('moduleSmartSearch');
    if (smartInput) {
      let smartTimeout = null;
      smartInput.addEventListener('input', (event) => {
        if (smartTimeout) clearTimeout(smartTimeout);
        smartTimeout = setTimeout(() => {
          updateModuloSmartSearch(event.target.value);
        }, 250);
      });
    }
    const valueInput = document.getElementById('moduleFilterValueInput');
    if (valueInput) {
      valueInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          addModuloStructuredFilter();
        }
      });
    }
  }
  renderModuloFilterChips();
}

function parseModuloSmartFilters(query, fields) {
  const normalizedMap = new Map(
    fields.map((field) => [normalizeHeader(field).replace(/\s+/g, ''), field])
  );
  const filters = {};
  let remaining = query;
  const regex = /([a-zA-Z0-9_]+):(\"[^\"]+\"|'[^']+'|\\S+)/g;
  let match;
  while ((match = regex.exec(query)) !== null) {
    const rawField = match[1];
    const rawValue = match[2] || '';
    const normalizedField = normalizeHeader(rawField).replace(/\\s+/g, '');
    const mapped = normalizedMap.get(normalizedField);
    if (mapped) {
      const cleaned = rawValue.replace(/^['"]|['"]$/g, '').trim();
      if (cleaned) {
        filters[mapped] = cleaned;
      }
      remaining = remaining.replace(match[0], '');
    }
  }
  return {
    general: remaining.replace(/\\s+/g, ' ').trim(),
    filters
  };
}

function updateModuloSmartSearch(value) {
  const fields = moduloCampos.map(campo => campo.nome);
  const { general, filters } = parseModuloSmartFilters(value, fields);
  moduloSmartSearchText = general;
  moduloSmartFilters = filters;
  filtrarModulo();
}

function applyModuloSmartSearch() {
  const searchInput = document.getElementById('moduleSmartSearch');
  if (!searchInput) return;
  updateModuloSmartSearch(searchInput.value);
}

function addModuloStructuredFilter() {
  const select = document.getElementById('moduleFilterFieldSelect');
  const valueInput = document.getElementById('moduleFilterValueInput');
  if (!select || !valueInput) return;
  const field = select.value;
  const value = valueInput.value.trim();
  if (!field || !value) {
    showErrorMessage('Selecione um campo e informe um valor.');
    return;
  }
  moduloColumnFilters[field] = value;
  valueInput.value = '';
  select.value = '';
  filtrarModulo();
}

function removeModuloFilter(field, scope) {
  if (scope === 'structured') {
    delete moduloColumnFilters[field];
  } else if (scope === 'smart') {
    delete moduloSmartFilters[field];
  } else if (scope === 'search') {
    moduloSmartSearchText = '';
    const searchInput = document.getElementById('moduleSmartSearch');
    if (searchInput) searchInput.value = '';
  }
  filtrarModulo();
}

function renderModuloFilterChips() {
  const container = document.getElementById('moduleFilterChips');
  if (!container) return;
  const chips = [];
  if (moduloSmartSearchText) {
    chips.push({
      label: `Busca: ${moduloSmartSearchText}`,
      onRemove: () => removeModuloFilter('search', 'search')
    });
  }
  Object.entries(moduloSmartFilters).forEach(([field, value]) => {
    chips.push({
      label: `${field}: ${value}`,
      onRemove: () => removeModuloFilter(field, 'smart')
    });
  });
  Object.entries(moduloColumnFilters).forEach(([field, value]) => {
    chips.push({
      label: `${field}: ${value}`,
      onRemove: () => removeModuloFilter(field, 'structured')
    });
  });
  if (!chips.length) {
    container.innerHTML = '<span class="smart-filter-empty">Nenhum filtro ativo.</span>';
    return;
  }
  container.innerHTML = chips.map((chip, index) => `
    <span class="filter-chip">
      ${escapeHtml(chip.label)}
      <button type="button" aria-label="Remover filtro" data-chip-index="${index}">×</button>
    </span>
  `).join('');
  container.querySelectorAll('button[data-chip-index]').forEach((btn) => {
    const idx = Number(btn.dataset.chipIndex);
    if (!Number.isNaN(idx) && chips[idx]) {
      btn.addEventListener('click', chips[idx].onRemove);
    }
  });
}

function openModuleFiltersModal(button) {
  const modal = document.getElementById('moduleFiltersModal');
  if (!modal) return;
  renderModuloFilterControls(getModuloDisplayConfig().displayCampos || []);
  modal.classList.add('show');
  if (button) {
    button.setAttribute('aria-pressed', 'true');
  }
}

function closeModuleFiltersModal(event) {
  const modal = document.getElementById('moduleFiltersModal');
  if (event && event.target?.id === 'moduleFiltersModal') {
    requestCloseModal(modal);
    return;
  }
  if (modal) {
    captureModalScrollState(modal);
    modal.classList.remove('show');
  }
  const button = document.querySelector('#tabModuloDinamico .filter-btn');
  if (button) {
    button.setAttribute('aria-pressed', 'false');
  }
}

function renderModuloBody(displayCampos, categoriaFieldName, categoriaAnchorFieldName) {
  const tbody = document.getElementById('moduloTbody');
  if (!tbody) return;
  const filtered = getModuloFiltrado();
  tbody.innerHTML = '';

  const state = paginationState.modules;
  state.total = filtered.length;
  let sorted = filtered;
  if (moduloSortState.key) {
    const key = moduloSortState.key;
    sorted = sortWithIndex(filtered, (item) => item.row?.[key], moduloSortState.dir);
  }

  if (!sorted.length) {
    const shouldPromptNewRecord = !hasActiveModuleFilters() && !moduloSortState.key;
    renderEmptyState(
      tbody,
      displayCampos.length + 2,
      shouldPromptNewRecord ? 'Adicione o primeiro registro' : 'Nenhum registro encontrado',
      shouldPromptNewRecord
        ? 'Clique em "+ Novo" para adicionar um registro nesta aba.'
        : 'Crie um novo registro ou ajuste os filtros.'
    );
    tbody.closest('.table-wrap')?.classList.remove('is-loading');
    const chkAllMod = document.getElementById('chkAllMod');
    if (chkAllMod) chkAllMod.checked = false;
    updateBulkUI();
    updateSummaries();
    updateNotifications();
    updatePaginationUI('modules');
    return;
  }

  let pagedRows = sorted;
  if (state.pageSize !== 'all') {
    const start = (state.page - 1) * state.pageSize;
    pagedRows = sorted.slice(start, start + state.pageSize);
  }

  pagedRows.forEach(({ row, idx }) => {
    const tr = document.createElement('tr');
    tr.dataset.id = row.id;

    tr.innerHTML = `
      <td class="checkbox-cell">
        <input
          type="checkbox"
          class="chk-mod"
          data-id="${row.id}"
          ${selectedModuloIds.has(row.id) ? 'checked' : ''}
        >
      </td>
      ${displayCampos.map(c => `
        <td>${renderModuloCell(c.nome, row[c.nome], row, categoriaFieldName, categoriaAnchorFieldName)}</td>
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

  tbody.closest('.table-wrap')?.classList.remove('is-loading');
  applyRowHighlights('modulo', 'moduloTbody');
  if (moduloFlashAfterFetch) {
    flashTableRows('moduloTbody');
    moduloFlashAfterFetch = false;
  }
  updateSummaries();
  updateNotifications();
  updatePaginationUI('modules');
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

  moduloTbody.addEventListener('click', (e) => {
    if (shouldIgnoreRowToggle(e.target)) return;
    const row = e.target.closest('tr');
    if (row) {
      toggleRowCheckbox(row, '.chk-mod');
    }
  });

  moduloTbody.addEventListener('click', (e) => {
    const el = e.target.closest('.desc-preview');
    if (!el) return;

    openDescModal(el);
  });
}

function renderModuloCell(fieldName, value, row = {}, categoriaFieldName = '', categoriaAnchorFieldName = '') {
  const label = (value ?? '').toString();
  const formatted = formatDateForTable(label);
  const normalizedField = normalizeHeader(fieldName).replace(/\s+/g, '');
  if (
    categoriaFieldName &&
    categoriaAnchorFieldName &&
    normalizeHeader(categoriaAnchorFieldName).replace(/\s+/g, '') === normalizedField
  ) {
    const categoriaValue = (row?.[categoriaFieldName] ?? '').toString().trim();
    return `
      <div class="link-cell">
        <div class="link-text">${escapeHtml(formatted)}</div>
        ${categoriaValue ? `<div class="link-category">${escapeHtml(categoriaValue)}</div>` : ''}
      </div>
    `;
  }
  if (normalizedField.includes('status')) {
    const display = label || 'Ativa';
    return `
      <div class="status-pill status-${normalizeStatus(display)}">
        <span class="status-dot"></span>
        <span class="status-text">${escapeHtml(display)}</span>
      </div>
    `;
  }
  if (normalizedField.includes('descricao')) {
    return `
      <div class="desc-preview" data-full="${escapeHtml(label)}">
        ${escapeHtml(label)}
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
  const combinedFilters = { ...moduloSmartFilters, ...moduloColumnFilters };
  const columnFilters = Object.entries(combinedFilters)
    .filter(([, value]) => value && value.trim())
    .map(([field, value]) => [field, value.trim().toLowerCase()]);
  const q = (moduloSmartSearchText || '').trim().toLowerCase();
  if (!q) {
    let filtered = moduloRegistros.map((row, idx) => ({ row, idx }));
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
  const searchEl = document.getElementById('moduleSmartSearch');
  if (searchEl) searchEl.value = '';
  moduloColumnFilters = {};
  moduloSmartFilters = {};
  moduloSmartSearchText = '';
  const fieldSelect = document.getElementById('moduleFilterFieldSelect');
  const valueInput = document.getElementById('moduleFilterValueInput');
  if (fieldSelect) fieldSelect.value = '';
  if (valueInput) valueInput.value = '';
  paginationState.modules.page = 1;
  filtrarModulo();
}

function filtrarModulo() {
  const { modCount } = getActiveFilterCounts();
  moduloFlashAfterFetch = modCount > 0;
  paginationState.modules.page = 1;
  const { displayCampos, categoriaFieldName, categoriaAnchorFieldName } = getModuloDisplayConfig();
  renderModuloBody(displayCampos, categoriaFieldName, categoriaAnchorFieldName);
  renderModuloFilterChips();
  updateFilterBadges();
}

function getModuloPresetStorageKey() {
  const moduleId = moduloAtual?.id || 'default';
  return `ti-module-filter-presets-${moduleId}`;
}

function loadModuloFilterPresets() {
  try {
    const stored = localStorage.getItem(getModuloPresetStorageKey());
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function saveModuloFilterPresets(presets) {
  localStorage.setItem(getModuloPresetStorageKey(), JSON.stringify(presets || []));
}

function saveModuloFilterPreset() {
  const nameInput = document.getElementById('moduleFilterPresetName');
  const name = (nameInput?.value || '').trim();
  if (!name) {
    showErrorMessage('Informe um nome para o preset.');
    return;
  }
  const presets = loadModuloFilterPresets();
  presets.push({
    name,
    smartSearch: (document.getElementById('moduleSmartSearch')?.value || '').trim(),
    structuredFilters: { ...moduloColumnFilters }
  });
  saveModuloFilterPresets(presets);
  if (nameInput) nameInput.value = '';
  renderModuloFilterControls(getModuloDisplayConfig().displayCampos || []);
  showActionToast('Preset salvo com sucesso.');
}

function applyModuloFilterPreset() {
  const select = document.getElementById('moduleFilterPresetSelect');
  const index = Number(select?.value);
  if (!select || Number.isNaN(index)) {
    showErrorMessage('Selecione um preset para aplicar.');
    return;
  }
  const presets = loadModuloFilterPresets();
  const preset = presets[index];
  if (!preset) return;
  const searchInput = document.getElementById('moduleSmartSearch');
  if (searchInput) searchInput.value = preset.smartSearch || '';
  moduloColumnFilters = { ...(preset.structuredFilters || {}) };
  updateModuloSmartSearch(preset.smartSearch || '');
  filtrarModulo();
}

function deleteModuloFilterPreset() {
  const select = document.getElementById('moduleFilterPresetSelect');
  const index = Number(select?.value);
  if (!select || Number.isNaN(index)) {
    showErrorMessage('Selecione um preset para excluir.');
    return;
  }
  const presets = loadModuloFilterPresets();
  presets.splice(index, 1);
  saveModuloFilterPresets(presets);
  renderModuloFilterControls(getModuloDisplayConfig().displayCampos || []);
  showActionToast('Preset removido.');
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
    const row = document.querySelector(`#moduloTbody tr[data-id="${id}"]`);
    row?.classList.add('table-row-removing');
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
  const modal = document.getElementById('moduloRegistroModal');
  if (e && e.target.id === 'moduloRegistroModal') {
    requestCloseModal(modal);
    return;
  }
  if (modal) {
    captureModalScrollState(modal);
    modal.classList.remove('show');
  }
}

function renderFormularioModulo(valores = {}) {
  const container = document.getElementById('moduloFormFields');
  container.innerHTML = '';

  moduloCampos.forEach((campo, index) => {
    const field = document.createElement('div');
    const normalizedFieldName = normalizeHeader(campo.nome);
    if (normalizedFieldName.includes('descricao')) {
      field.className = 'form-full';
    }

    const label = document.createElement('label');
    label.textContent = campo.nome;

    const typeMap = {
      numero: 'number',
      data: 'text',
      email: 'email'
    };

    let input;
    const normalizedName = normalizedFieldName.replace(/\s+/g, '');
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
      const optionsMap = loadModuleFieldOptions(moduloAtual?.id);
      const storedOptions = optionsMap[normalizeModuloSortKey(campo.nome)] || [];
      const options = storedOptions.length ? storedOptions : getSelectOptionsForCampo(campo);
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
  const saveBtn = document.querySelector('#moduloRegistroModal .btn-salvar');
  if (!moduloAtual?.id) {
    showErrorMessage('Selecione uma aba personalizada.');
    return;
  }

  const isEdit = Boolean(moduloEditId);
  const inputs = [...document.querySelectorAll('#moduloFormFields [data-field]')];
  const valores = {};

  for (const input of inputs) {
    const nome = input.dataset.field;
    const valor = input.value?.trim();
    const tipo = input.dataset.type || 'texto';
    if (input.dataset.required === 'true' && !valor) {
      showErrorMessage(`Preencha o campo obrigatório: ${nome}`);
      return;
    }
    const normalizedFieldName = normalizeHeader(nome);
    if (valor && tipo === 'email' && !isValidEmail(valor)) {
      showErrorMessage(`E-mail inválido no campo: ${nome}`);
      return;
    }
    if (valor && normalizedFieldName.includes('telefone') && !isValidPhoneNumber(valor)) {
      showErrorMessage(`Telefone inválido no campo: ${nome}`);
      return;
    }
    if (valor && tipo === 'data') {
      const normalized = normalizeDateValue(valor);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
        showErrorMessage(`Data inválida no campo: ${nome}`);
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

  setButtonLoading(saveBtn, true);
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valores })
    });
    const payload = await res.json().catch(() => ({}));
    const rowId = moduloEditId || payload?.id;
    if (rowId) queueRowHighlight('modulo', rowId);
  } finally {
    setButtonLoading(saveBtn, false);
  }

  closeModuloRegistroModal();
  await carregarRegistrosModulo();
  renderModuloDinamico();
  showActionToast(isEdit ? 'Registro atualizado com sucesso.' : 'Registro criado com sucesso.');
}

function openNovoRegistroModulo() {
  moduloEditId = null;
  document.getElementById('moduloRegistroTitulo').textContent = 'Novo Registro';
  renderFormularioModulo();
  openModalById('moduloRegistroModal');
}

let newTabFields = window.newTabFields;
let newTabSortOptions = [];
let newTabFieldOptions = {};

const moduleSortOptionsKey = (moduleId) => `ti-module-sort-options-${moduleId}`;
const moduleFieldOptionsKey = (moduleId) => `ti-module-field-options-${moduleId}`;

function normalizeModuloSortKey(name) {
  return normalizeHeader(name || '').replace(/\s+/g, '');
}

function loadModuleSortOptions(moduleId) {
  if (!moduleId) return [];
  const stored = modulePreferencesStore.get(String(moduleId));
  const options = stored?.sortOptions;
  return Array.isArray(options) ? options : [];
}

async function saveModuleSortOptions(moduleId, options) {
  if (!moduleId) return;
  const key = String(moduleId);
  const current = modulePreferencesStore.get(key) || {};
  const next = {
    ...current,
    sortOptions: Array.isArray(options) ? options : []
  };
  modulePreferencesStore.set(key, next);
  await persistModulePreferences(key);
}

function loadModuleFieldOptions(moduleId) {
  if (!moduleId) return {};
  const stored = modulePreferencesStore.get(String(moduleId));
  const options = stored?.fieldOptions;
  return options && typeof options === 'object' ? options : {};
}

async function saveModuleFieldOptions(moduleId, optionsMap) {
  if (!moduleId) return;
  const key = String(moduleId);
  const current = modulePreferencesStore.get(key) || {};
  const next = {
    ...current,
    fieldOptions: optionsMap && typeof optionsMap === 'object' ? optionsMap : {}
  };
  modulePreferencesStore.set(key, next);
  await persistModulePreferences(key);
}

async function fetchModulePreferences(moduleId) {
  const res = await fetch(`${API_BASE}/system/module-preferences?moduleId=${moduleId}`);
  if (!res.ok) {
    throw new Error('Falha ao carregar preferências do módulo.');
  }
  const payload = await res.json();
  const sortOptions = Array.isArray(payload?.sortOptions) ? payload.sortOptions : [];
  const fieldOptions = payload?.fieldOptions && typeof payload.fieldOptions === 'object'
    ? payload.fieldOptions
    : {};
  modulePreferencesStore.set(String(moduleId), { sortOptions, fieldOptions });
  modulePreferencesLoadState.set(String(moduleId), true);
  return { sortOptions, fieldOptions };
}

async function ensureModulePreferencesLoaded(moduleId) {
  if (!moduleId) return;
  const key = String(moduleId);
  if (!modulePreferencesLoadState.get(key)) {
    await fetchModulePreferences(key);
  }
}

async function persistModulePreferences(moduleId) {
  if (!moduleId) return;
  const key = String(moduleId);
  const payload = modulePreferencesStore.get(key) || {};
  const res = await fetch(`${API_BASE}/system/module-preferences?moduleId=${key}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sortOptions: payload.sortOptions || [],
      fieldOptions: payload.fieldOptions || {}
    })
  });
  if (!res.ok) {
    throw new Error('Falha ao salvar preferências do módulo.');
  }
}

function normalizeFieldOptionsInput(value = '') {
  return value
    .split(',')
    .map(option => option.trim())
    .filter(Boolean);
}

function updateFieldOptions(idx, value) {
  const options = normalizeFieldOptionsInput(value);
  if (newTabFields[idx]) {
    newTabFields[idx].opcoes = options;
  }
  updateFieldOptionsSummary(idx);
}

function updateFieldType(idx, value, shouldOpenModal = false) {
  if (newTabFields[idx]) {
    newTabFields[idx].tipo = value;
    if (value !== 'select') {
      newTabFields[idx].opcoes = [];
    }
  }
  const row = document.querySelector(`.field-row[data-idx="${idx}"]`);
  if (!row) return;
  const optionsWrapper = row.querySelector('.field-type-options');
  if (!optionsWrapper) return;
  optionsWrapper.classList.toggle('is-visible', value === 'select');
  if (value === 'select') {
    updateFieldOptionsSummary(idx);
    if (shouldOpenModal) {
      openFieldOptionsModal(idx);
    }
  }
}

function getSortOptionCandidates() {
  const fields = getFieldRowsData().filter(field => field.nome);
  const seen = new Set();
  return fields.reduce((acc, field) => {
    const key = normalizeModuloSortKey(field.nome);
    if (!key || seen.has(key)) return acc;
    seen.add(key);
    acc.push({ key, label: field.nome });
    return acc;
  }, []);
}

function resolveSortOptionsSelection(candidates, selectedKeys) {
  if (!candidates.length) return [];
  if (Array.isArray(selectedKeys)) {
    if (!selectedKeys.length) return [];
    const validKeys = new Set(candidates.map(item => item.key));
    return selectedKeys.filter(key => validKeys.has(key));
  }
  return candidates.map(item => item.key);
}

function renderSortOptionsPicker(selectedKeys = null) {
  const container = document.getElementById('sortOptionsContainer');
  if (!container) return;

  const candidates = getSortOptionCandidates();
  const selection = Array.isArray(selectedKeys)
    ? selectedKeys
    : (newTabSortOptions.length ? newTabSortOptions : null);
  newTabSortOptions = resolveSortOptionsSelection(candidates, selection);

  if (!candidates.length) {
    container.innerHTML = '<span class="small">Adicione campos para liberar opções de ordenação.</span>';
    return;
  }

  container.innerHTML = candidates.map(option => `
    <label class="sort-option-item">
      <input
        type="checkbox"
        value="${option.key}"
        ${newTabSortOptions.includes(option.key) ? 'checked' : ''}
        onchange="toggleSortOption(this)"
      />
      ${escapeHtml(option.label)}
    </label>
  `).join('');
}

function toggleSortOption(input) {
  const key = input.value;
  if (!key) return;
  if (input.checked) {
    if (!newTabSortOptions.includes(key)) newTabSortOptions.push(key);
  } else {
    newTabSortOptions = newTabSortOptions.filter(item => item !== key);
  }
}

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

const manualMigrationBlueprints = {
  inventario: {
    nome: 'Inventário',
    descricao: 'Dados migrados da aba Inventário.',
    fields: [
      { nome: 'Categoria', tipo: 'select', obrigatorio: false, sourceKey: 'categoria' },
      { nome: 'Link de Internet', tipo: 'select', obrigatorio: true, sourceKey: 'link' },
      { nome: 'Velocidade (DL/UL)', tipo: 'select', obrigatorio: false, sourceKey: 'velocidade' },
      { nome: 'Telefone', tipo: 'texto', obrigatorio: false, sourceKey: 'telefone' },
      { nome: 'Local', tipo: 'select', obrigatorio: true, sourceKey: 'local' },
      { nome: 'Endereço', tipo: 'texto', obrigatorio: false, sourceKey: 'endereco' }
    ]
  },
  maquinas: {
    nome: 'Máquinas',
    descricao: 'Dados migrados da aba Máquinas.',
    fields: [
      { nome: 'Nome Máquina', tipo: 'texto', obrigatorio: true, sourceKey: 'nome_maquina' },
      { nome: 'Patrimônio', tipo: 'texto', obrigatorio: false, sourceKey: 'patrimonio' },
      { nome: 'Local', tipo: 'select', obrigatorio: false, sourceKey: 'local' },
      { nome: 'Status', tipo: 'select', obrigatorio: false, sourceKey: 'status' },
      { nome: 'Descrição', tipo: 'texto', obrigatorio: false, sourceKey: 'descricao' }
    ]
  }
};

function buildManualMigrationFields(tabType) {
  const blueprint = manualMigrationBlueprints[tabType];
  if (!blueprint) return [];
  const baseFields = blueprint.fields.map(field => ({
    ...field,
    opcoes: getInheritedFieldOptions(field.nome, field.tipo)
  }));
  const customFields = getManualCustomFields(tabType).map(field => ({
    nome: field.label,
    tipo: 'texto',
    obrigatorio: false,
    sourceKey: field.key,
    opcoes: []
  }));
  return [...baseFields, ...customFields];
}

function getManualMigrationStatusElements() {
  return {
    modal: document.getElementById('manualMigrationModal'),
    status: document.getElementById('manualMigrationStatus'),
    button: document.getElementById('manualMigrationRunBtn')
  };
}

function openManualMigrationModal() {
  const { status, button } = getManualMigrationStatusElements();
  if (status) {
    status.textContent = 'Pronto para iniciar.';
  }
  if (button) {
    button.disabled = false;
    setButtonLoading(button, false);
  }
  openModalById('manualMigrationModal');
}

function closeManualMigrationModal(e) {
  const { modal } = getManualMigrationStatusElements();
  if (e && e.target?.id === 'manualMigrationModal') {
    requestCloseModal(modal);
    return;
  }
  if (modal) {
    captureModalScrollState(modal);
    modal.classList.remove('show');
  }
}

async function runManualMigration() {
  const { status, button } = getManualMigrationStatusElements();
  if (button) {
    button.disabled = true;
    setButtonLoading(button, true);
  }
  if (status) {
    status.textContent = 'Preparando migração...';
  }
  try {
    let modulesList = modulos;
    if (!Array.isArray(modulesList) || !modulesList.length) {
      const res = await fetch(API_MODULOS);
      modulesList = await res.json();
    }
    const normalizedExisting = new Set((modulesList || []).map(modulo => normalizeHeader(modulo?.nome || '')));
    const conflicts = Object.values(manualMigrationBlueprints)
      .map(blueprint => blueprint.nome)
      .filter(name => normalizedExisting.has(normalizeHeader(name)));

    if (conflicts.length) {
      showErrorMessage(`Já existem módulos com o nome: ${conflicts.join(', ')}.`);
      if (status) status.textContent = 'Migração cancelada: módulos já existem.';
      return;
    }

    for (const [tabType, blueprint] of Object.entries(manualMigrationBlueprints)) {
      if (status) {
        status.textContent = `Criando módulo "${blueprint.nome}"...`;
      }
      const fields = buildManualMigrationFields(tabType);
      if (!fields.length) {
        throw new Error(`Não foi possível gerar campos para ${blueprint.nome}.`);
      }
      if (!validateDuplicateFields(fields)) {
        throw new Error(`Campos duplicados encontrados em ${blueprint.nome}.`);
      }

      const moduleRes = await fetch(API_MODULOS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: blueprint.nome, descricao: blueprint.descricao })
      });
      if (!moduleRes.ok) {
        throw new Error(`Falha ao criar o módulo ${blueprint.nome}.`);
      }
      const modulo = await moduleRes.json();

      for (let i = 0; i < fields.length; i++) {
        const field = fields[i];
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

      const fieldOptionsMap = buildFieldOptionsMap(fields);
      await saveModuleFieldOptions(modulo.id, fieldOptionsMap);
      const sortKeys = fields
        .map(field => normalizeModuloSortKey(field.nome))
        .filter(Boolean)
        .filter((value, index, list) => list.indexOf(value) === index);
      await saveModuleSortOptions(modulo.id, sortKeys);

      const rows = tabType === 'inventario'
        ? await fetchAllPagedRows(API_URL, ({ page, pageSize }) =>
          buildInventoryQueryParams({ page, pageSize, includeFilters: false }))
        : await fetchAllPagedRows(API_MAQUINAS, ({ page, pageSize }) =>
          buildMachineQueryParams({ page, pageSize, includeFilters: false }));

      const customValues = getManualCustomValues(tabType);
      if (status) {
        status.textContent = `Copiando ${rows.length} registro(s) para "${blueprint.nome}"...`;
      }

      for (const row of rows) {
        const valores = {};
        fields.forEach(field => {
          const sourceKey = field.sourceKey;
          if (sourceKey && row && Object.prototype.hasOwnProperty.call(row, sourceKey)) {
            valores[field.nome] = row[sourceKey] ?? '';
          }
        });
        const customEntry = customValues?.[row?.id] || {};
        fields.forEach(field => {
          if (!field.sourceKey) return;
          if (Object.prototype.hasOwnProperty.call(customEntry, field.sourceKey)) {
            valores[field.nome] = customEntry[field.sourceKey] ?? '';
          }
        });
        await fetch(`${API_MODULOS}/${modulo.id}/registros`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ valores })
        });
      }
    }

    await carregarModulos();
    if (status) status.textContent = 'Migração concluída com sucesso.';
    showActionToast('Migração concluída com sucesso.');
  } catch (err) {
    console.error('Erro ao migrar abas manuais:', err);
    showErrorMessage('Erro ao executar migração.');
    if (status) status.textContent = 'Erro ao executar migração.';
  } finally {
    if (button) {
      button.disabled = false;
      setButtonLoading(button, false);
    }
  }
}

const fieldPresetMap = Object.entries(tabTemplates).reduce((acc, [group, fields]) => {
  fields.forEach(field => {
    const key = `${group}:${field.nome}`;
    acc[key] = { ...field, group };
  });
  return acc;
}, {});

let fieldDragInitialized = false;
let fieldDragAnimationId = null;
let fieldDragPointerY = null;
let fieldDragScrollContainer = null;
let fieldDragWheelHandler = null;

function getInheritedFieldOptions(nome, tipo) {
  if (tipo !== 'select') return [];
  return getSelectOptionsForCampo({ nome });
}

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
    newTabFields[idx].opcoes = getInheritedFieldOptions(preset.nome, preset.tipo);
  }
  updateFieldType(idx, preset.tipo);
  updateFieldOptionsSummary(idx);
}

function getFieldRowsData() {
  const rows = [...document.querySelectorAll('#fieldsContainer .field-row')];
  return rows.map(row => {
    const idx = Number(row.dataset.idx);
    return {
      nome: row.querySelector('.field-name')?.value.trim() || '',
      tipo: row.querySelector('.field-type')?.value || 'texto',
      obrigatorio: !!row.querySelector('.field-required')?.checked,
      opcoes: Array.isArray(newTabFields[idx]?.opcoes) ? newTabFields[idx].opcoes : []
    };
  });
}

function rebuildFieldRowsFromDOM() {
  const container = document.getElementById('fieldsContainer');
  if (!container) return;
  const rowsData = getFieldRowsData();
  newTabFields = [];
  window.newTabFields = newTabFields;
  container.innerHTML = '';
  rowsData.forEach(row => addFieldWithValues(row));
  renderSortOptionsPicker();
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
    showErrorMessage(`Campos duplicados encontrados: ${[...duplicates].join(', ')}`);
    return false;
  }
  return true;
}

function buildFieldOptionsMap(fields) {
  return fields.reduce((acc, field) => {
    if (field.tipo !== 'select') return acc;
    const key = normalizeModuloSortKey(field.nome);
    const options = Array.isArray(field.opcoes) ? field.opcoes : [];
    if (key && options.length) {
      acc[key] = options;
    }
    return acc;
  }, {});
}

function getCategoriaAnchorKey(fields = []) {
  const candidate = fields.find(field => normalizeHeader(field.nome) !== 'categoria');
  return candidate ? normalizeModuloSortKey(candidate.nome) : '';
}

function updateCategoriaAnchorOptions() {
  const wrapper = document.getElementById('categoriaAnchorWrapper');
  const select = document.getElementById('categoriaAnchorSelect');
  if (!wrapper || !select) return;

  const activeFields = newTabFields.filter(field => !field.__deleted && field.nome?.trim());
  const hasCategoria = activeFields.some(field => normalizeHeader(field.nome) === 'categoria');
  if (!hasCategoria) {
    wrapper.classList.add('hidden');
    select.innerHTML = '';
    delete newTabFieldOptions.__categoriaAnchor;
    return;
  }

  const candidates = activeFields.filter(field => normalizeHeader(field.nome) !== 'categoria');
  if (!candidates.length) {
    wrapper.classList.add('hidden');
    select.innerHTML = '';
    return;
  }

  wrapper.classList.remove('hidden');
  select.innerHTML = candidates
    .map(field => {
      const value = normalizeModuloSortKey(field.nome);
      return `<option value="${value}">${escapeHtml(field.nome)}</option>`;
    })
    .join('');

  const selectedKey = newTabFieldOptions.__categoriaAnchor || getCategoriaAnchorKey(candidates);
  select.value = selectedKey;
  newTabFieldOptions.__categoriaAnchor = selectedKey;
  select.onchange = () => {
    newTabFieldOptions.__categoriaAnchor = select.value;
  };
}

function openCategoriaAnchorHelpModal() {
  const modal = document.getElementById('categoriaAnchorHelpModal');
  if (modal) {
    modal.classList.remove('hidden');
    showModal(modal);
    focusFirstField(modal);
  }
}

function closeCategoriaAnchorHelpModal(e) {
  const modal = document.getElementById('categoriaAnchorHelpModal');
  if (e && e.target.id === 'categoriaAnchorHelpModal') {
    requestCloseModal(modal);
    return;
  }
  if (modal) {
    captureModalScrollState(modal);
    modal.classList.remove('show');
  }
}

function initFieldDragAndDrop() {
  if (fieldDragInitialized) return;
  const container = document.getElementById('fieldsContainer');
  if (!container) return;
  fieldDragInitialized = true;
  const scrollContainer =
    container.closest('.modal-body-scroll') ||
    container.closest('.field-manager-body') ||
    container;
  fieldDragScrollContainer = scrollContainer;
  const scrollThreshold = 50;
  const maxScrollStep = 22;
  const minScrollStep = 2;

  const stopAutoScroll = () => {
    if (fieldDragAnimationId) {
      cancelAnimationFrame(fieldDragAnimationId);
      fieldDragAnimationId = null;
    }
    fieldDragPointerY = null;
    if (fieldDragWheelHandler) {
      window.removeEventListener('wheel', fieldDragWheelHandler);
      fieldDragWheelHandler = null;
    }
  };

  const calculateSpeed = (distance, threshold) => {
    if (distance >= threshold) return 0;
    const ratio = Math.max(0, Math.min(1, 1 - distance / threshold));
    return minScrollStep + (maxScrollStep - minScrollStep) * ratio;
  };

  const startAutoScroll = () => {
    if (fieldDragAnimationId) return;
    const tick = () => {
      if (!container.querySelector('.field-row.dragging')) {
        stopAutoScroll();
        return;
      }
      if (fieldDragPointerY == null) {
        fieldDragAnimationId = requestAnimationFrame(tick);
        return;
      }
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const rect = fieldDragScrollContainer?.getBoundingClientRect();
      const topDistanceViewport = fieldDragPointerY;
      const bottomDistanceViewport = viewportHeight - fieldDragPointerY;
      const topDistanceModal = rect ? fieldDragPointerY - rect.top : topDistanceViewport;
      const bottomDistanceModal = rect ? rect.bottom - fieldDragPointerY : bottomDistanceViewport;

      const topDistance = Math.min(topDistanceViewport, topDistanceModal);
      const bottomDistance = Math.min(bottomDistanceViewport, bottomDistanceModal);
      let delta = 0;
      if (topDistance < scrollThreshold) {
        delta = -calculateSpeed(topDistance, scrollThreshold);
      } else if (bottomDistance < scrollThreshold) {
        delta = calculateSpeed(bottomDistance, scrollThreshold);
      }
      if (delta !== 0 && fieldDragScrollContainer) {
        fieldDragScrollContainer.scrollTop += delta;
      }
      fieldDragAnimationId = requestAnimationFrame(tick);
    };
    fieldDragAnimationId = requestAnimationFrame(tick);
  };

  container.addEventListener('dragstart', event => {
    const handle = event.target.closest('.field-drag');
    if (!handle) return;
    const row = handle.closest('.field-row');
    if (!row) return;
    row.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'move';
    if (!fieldDragWheelHandler) {
      fieldDragWheelHandler = (wheelEvent) => {
        if (!fieldDragScrollContainer) return;
        fieldDragScrollContainer.scrollTop += wheelEvent.deltaY;
      };
      window.addEventListener('wheel', fieldDragWheelHandler, { passive: true });
    }
    startAutoScroll();
  });

  container.addEventListener('dragend', event => {
    const row = event.target.closest('.field-row');
    if (row) row.classList.remove('dragging');
    stopAutoScroll();
  });

  container.addEventListener('dragover', event => {
    const dragging = container.querySelector('.field-row.dragging');
    if (!dragging) return;
    event.preventDefault();
    fieldDragPointerY = event.clientY;
    const row = event.target.closest('.field-row');
    if (!row || row === dragging) return;
    const rect = row.getBoundingClientRect();
    const shouldInsertAfter = event.clientY > rect.top + rect.height / 2;
    container.insertBefore(dragging, shouldInsertAfter ? row.nextSibling : row);
  });

  container.addEventListener('drop', event => {
    if (!container.querySelector('.field-row.dragging')) return;
    event.preventDefault();
    rebuildFieldRowsFromDOM();
    stopAutoScroll();
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
  const nome = normalizeHeader(campo.nome || '');
  if (nome === 'local') {
    return Array.from(new Set([...inventoryLocalOptions, ...machineLocalOptions]));
  }
  if (selectOptionsMap[nome]) {
    return selectOptionsMap[nome];
  }
  return [];
}

function openCreateTabModal() {
  manageTabContext = null;
  newTabFields = [];
  window.newTabFields = newTabFields;
  newTabSortOptions = [];
  newTabFieldOptions = {};
  previousModalForFieldManager = null;
  document.getElementById('fieldsContainer').innerHTML = '';
  updateFieldCountDisplay();
  const categoriaWrapper = document.getElementById('categoriaAnchorWrapper');
  if (categoriaWrapper) categoriaWrapper.classList.add('hidden');
  document.getElementById('newTabName').value = '';
  document.getElementById('newTabDescription').value = '';
  const searchInput = document.getElementById('fieldSearchInput');
  if (searchInput) searchInput.value = '';
  const templateSelect = document.getElementById('newTabTemplate');
  if (templateSelect) {
    templateSelect.value = 'custom';
    templateSelect.disabled = false;
  }
  const inheritanceSelect = document.getElementById('newTabInheritance');
  if (inheritanceSelect) {
    inheritanceSelect.value = '';
  }
  populateTabInheritanceOptions();
  const titleEl = document.querySelector('#createTabModal h2');
  if (titleEl) titleEl.textContent = 'Criar nova aba';
  const submitBtn = document.getElementById('createTabSubmitBtn');
  if (submitBtn) submitBtn.textContent = 'Criar Aba';
  initFieldDragAndDrop();
  renderSortOptionsPicker();
  updateCategoriaAnchorOptions();
  openModalById('createTabModal');
}

function closeCreateTabModal(e) {
  const modal = document.getElementById('createTabModal');
  if (e && e.target.id === 'createTabModal') {
    requestCloseModal(modal);
    return;
  }
  if (modal) {
    captureModalScrollState(modal);
    modal.classList.remove('show');
  }
  closeFieldManagerModal(null, false);
  manageTabContext = null;
}

function submitTabModal() {
  if (manageTabContext?.type === 'module') {
    saveManagedModule();
    return;
  }
  salvarNovoModulo();
}

async function populateTabInheritanceOptions() {
  const select = document.getElementById('newTabInheritance');
  if (!select) return;
  let modulesList = modulos;
  if (!Array.isArray(modulesList) || !modulesList.length) {
    try {
      const res = await fetch(API_MODULOS);
      modulesList = await res.json();
    } catch (err) {
      modulesList = [];
    }
  }
  const moduleOptions = (modulesList || []).map((modulo) => ({
    value: `module:${modulo.id}`,
    label: `Módulo: ${modulo.nome}`
  }));
  select.innerHTML = [
    '<option value="">Nenhuma</option>',
    ...moduleOptions.map(opt => `<option value="${opt.value}">${escapeHtml(opt.label)}</option>`)
  ].join('');
}

async function applyTabInheritance() {
  const select = document.getElementById('newTabInheritance');
  if (!select) return;
  const value = select.value;
  if (!value) return;

  if (value.startsWith('module:')) {
    const moduleId = value.replace('module:', '');
    await ensureModulePreferencesLoaded(moduleId);
    const res = await fetch(`${API_MODULOS}/${moduleId}/campos`);
    const campos = await res.json();
    const optionsMap = loadModuleFieldOptions(moduleId);

    newTabFields = [];
    window.newTabFields = newTabFields;
    newTabFieldOptions = { ...optionsMap };
    const container = document.getElementById('fieldsContainer');
    if (container) container.innerHTML = '';
    campos.forEach((campo) => {
      addFieldWithValues({
        nome: campo.nome,
        tipo: campo.tipo || 'texto',
        obrigatorio: !!campo.obrigatorio,
        opcoes: optionsMap[normalizeModuloSortKey(campo.nome)] || []
      });
    });
    newTabSortOptions = loadModuleSortOptions(moduleId);
    renderSortOptionsPicker(newTabSortOptions);
    updateCategoriaAnchorOptions();
    updateFieldCountDisplay();
  }
}

async function openManageModule(mod) {
  manageTabContext = {
    type: 'module',
    id: mod.id,
    nome: mod.nome,
    descricao: mod.descricao || '',
    campos: []
  };
  newTabFields = [];
  window.newTabFields = newTabFields;
  newTabSortOptions = [];
  await ensureModulePreferencesLoaded(mod.id);
  newTabFieldOptions = loadModuleFieldOptions(mod.id);
  const container = document.getElementById('fieldsContainer');
  if (container) container.innerHTML = '';

  const titleEl = document.querySelector('#createTabModal h2');
  if (titleEl) titleEl.textContent = 'Gerenciar aba';
  const submitBtn = document.getElementById('createTabSubmitBtn');
  if (submitBtn) submitBtn.textContent = 'Salvar alterações';

  const templateSelect = document.getElementById('newTabTemplate');
  if (templateSelect) {
    templateSelect.value = 'custom';
    templateSelect.disabled = true;
  }

  document.getElementById('newTabName').value = mod.nome || '';
  document.getElementById('newTabDescription').value = mod.descricao || '';

  const campos = await fetch(`${API_MODULOS}/${mod.id}/campos`).then(r => r.json());
  manageTabContext.campos = campos;
  campos.forEach(campo => {
    addFieldWithValues({
      id: campo.id,
      nome: campo.nome,
      tipo: campo.tipo || 'texto',
      obrigatorio: !!campo.obrigatorio,
      opcoes: newTabFieldOptions[normalizeModuloSortKey(campo.nome)] || []
    });
  });

  newTabSortOptions = loadModuleSortOptions(mod.id);
  renderSortOptionsPicker(newTabSortOptions);
  initFieldDragAndDrop();
  updateCategoriaAnchorOptions();
  updateFieldCountDisplay();
  openModalById('createTabModal');
}

async function saveManagedModule() {
  if (!manageTabContext) return;
  const moduleId = manageTabContext.id;
  const nome = document.getElementById('newTabName').value.trim();
  const descricao = document.getElementById('newTabDescription').value.trim();

  if (!nome) {
    showErrorMessage('Informe o nome da aba.');
    return;
  }

  const camposValidos = newTabFields
    .filter(field => !field.__deleted)
    .map(field => ({
      id: field.id || null,
      nome: field.nome?.trim() || '',
      tipo: field.tipo || 'texto',
      obrigatorio: !!field.obrigatorio,
      opcoes: Array.isArray(field.opcoes) ? field.opcoes : []
    }))
    .filter(field => field.nome);

  if (!camposValidos.length) {
    showErrorMessage('Adicione ao menos um campo com nome válido.');
    return;
  }

  if (!validateDuplicateFields(camposValidos)) {
    return;
  }

  const updateRes = await fetch(`${API_MODULOS}/${moduleId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome, descricao })
  });
  if (!updateRes.ok) {
    const error = await updateRes.json().catch(() => ({}));
    showErrorMessage(error?.error || 'Erro ao atualizar a aba.');
    return;
  }

  const existingIds = new Set(manageTabContext.campos.map(campo => campo.id));
  const nextIds = new Set(camposValidos.filter(campo => campo.id).map(campo => campo.id));

  for (const campo of camposValidos) {
    const payload = {
      nome: campo.nome,
      tipo: campo.tipo,
      obrigatorio: campo.obrigatorio,
      ordem: camposValidos.indexOf(campo)
    };
    if (campo.id) {
      await fetch(`${API_MODULOS}/${moduleId}/campos/${campo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      await fetch(`${API_MODULOS}/${moduleId}/campos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }
  }

  for (const campoId of existingIds) {
    if (!nextIds.has(campoId)) {
      await fetch(`${API_MODULOS}/${moduleId}/campos/${campoId}`, {
        method: 'DELETE'
      });
    }
  }

  const sortCandidates = getSortOptionCandidates();
  const resolvedSortOptions = resolveSortOptionsSelection(sortCandidates, newTabSortOptions);
  await saveModuleSortOptions(moduleId, resolvedSortOptions);
  const fieldOptionsMap = buildFieldOptionsMap(camposValidos);
  if (newTabFieldOptions.__categoriaAnchor) {
    fieldOptionsMap.__categoriaAnchor = newTabFieldOptions.__categoriaAnchor;
  }
  await saveModuleFieldOptions(moduleId, fieldOptionsMap);

  closeCreateTabModal();
  const currentModuleId = moduleId;
  manageTabContext = null;
  await carregarModulos();
  if (Number(moduloAtual?.id) === Number(currentModuleId)) {
    await carregarCamposModulo();
    await carregarRegistrosModulo();
    renderModuloDinamico();
  }
}

function closeTabMenus() {
  document.querySelectorAll('.tab-menu-dropdown').forEach(menu => {
    menu.classList.add('hidden');
    const trigger = menu.previousElementSibling;
    if (trigger?.classList?.contains('tab-menu-btn')) {
      trigger.setAttribute('aria-expanded', 'false');
    }
  });
}

function toggleTabMenu(button, event) {
  event?.stopPropagation();
  const menu = button?.nextElementSibling;
  if (!menu) return;
  const isHidden = menu.classList.contains('hidden');
  closeTabMenus();
  if (isHidden) {
    menu.classList.remove('hidden');
    button.setAttribute('aria-expanded', 'true');
  } else {
    button.setAttribute('aria-expanded', 'false');
  }
}

function getManualTabLabels(tabType) {
  const stored = localStorage.getItem(`ti-tab-labels-${tabType}`);
  if (!stored) return {};
  try {
    return JSON.parse(stored);
  } catch (e) {
    return {};
  }
}

function applyManualTabLabels(tabType) {
  const config = getManualFieldDefinitions(tabType);
  if (!config.length) return;
  ensureManualTabColumns(tabType);
  const { labels, hidden } = getManualTabConfig(tabType);
  const tabId = tabType === 'inventario' ? 'tabInventario' : 'tabMaquinas';
  const tab = document.getElementById(tabId);
  if (!tab) return;
  config.forEach(({ key, label }) => {
    const text = labels[key] || label;
    const th = tab.querySelector(`thead th[data-field="${key}"]`);
    if (th) th.textContent = text;
    const input = tab.querySelector(`.table-filter-input[data-field="${key}"]`);
    if (input) input.placeholder = `Filtrar ${text.toLowerCase()}`;
    const isHidden = hidden.includes(key);
    [th, input?.closest('th')].forEach((el) => {
      if (el) el.style.display = isHidden ? 'none' : '';
    });
    tab.querySelectorAll(`[data-field="${key}"]`).forEach((el) => {
      if (el.tagName !== 'TH' && !el.classList.contains('table-filter-input')) {
        el.style.display = isHidden ? 'none' : '';
      }
    });
  });
}

function openManualTabManager(tabType) {
  closeTabMenus();
  manualTabContext = { tabType, config: getManualTabConfig(tabType) };
  const modalTitle = document.getElementById('manageManualTabTitle');
  if (modalTitle) {
    modalTitle.textContent = `Gerenciar aba ${tabType === 'inventario' ? 'Inventário' : 'Máquinas'}`;
  }
  const newFieldInput = document.getElementById('manualTabNewFieldInput');
  if (newFieldInput) newFieldInput.value = '';
  renderManualTabManager();
  openModalById('manageManualTabModal');
}

function renderManualTabManager() {
  if (!manualTabContext) return;
  const { tabType, config } = manualTabContext;
  const container = document.getElementById('manageManualTabFields');
  if (!container) return;
  const fields = getManualFieldDefinitions(tabType);
  const fieldMap = new Map(fields.map(field => [field.key, field.label]));
  const visibleKeys = config.order.filter(key => !config.hidden.includes(key));
  container.innerHTML = visibleKeys.map(key => `
    <div class="form-full">
      <label>${fieldMap.get(key) || key}</label>
      <div class="manual-tab-row" data-field="${key}">
        <input type="text" data-field="${key}" value="${escapeHtml(config.labels[key] || fieldMap.get(key) || key)}" />
        <button type="button" class="btn secondary" onclick="hideManualTabField('${key}')">Ocultar</button>
      </div>
    </div>
  `).join('');

  const select = document.getElementById('manualTabFieldSelect');
  if (select) {
    const hiddenKeys = config.order.filter(key => config.hidden.includes(key));
    select.innerHTML = hiddenKeys.length
      ? hiddenKeys.map(key => `<option value="${key}">${fieldMap.get(key) || key}</option>`).join('')
      : `<option value="">Sem campos ocultos</option>`;
    select.disabled = hiddenKeys.length === 0;
  }
  const addButton = document.querySelector('.manual-tab-actions button');
  if (addButton) {
    addButton.disabled = select ? select.disabled : true;
  }
  filterManualTabFields(document.getElementById('manualTabSearchInput')?.value || '');
}

function filterManualTabFields(query = '') {
  const container = document.getElementById('manageManualTabFields');
  if (!container) return;
  const normalized = query.trim().toLowerCase();
  let visibleCount = 0;

  container.querySelectorAll('.form-full').forEach(row => {
    const label = row.querySelector('label')?.textContent || '';
    const inputValue = row.querySelector('input')?.value || '';
    const matches = !normalized || [label, inputValue].some(text => text.toLowerCase().includes(normalized));
    row.classList.toggle('is-hidden', !matches);
    if (matches) visibleCount += 1;
  });

  const emptyState = document.getElementById('manualTabFilterEmpty');
  if (emptyState) {
    const shouldShow = normalized && visibleCount === 0;
    emptyState.classList.toggle('hidden', !shouldShow);
  }
}

async function addManualTabField() {
  if (!manualTabContext) return;
  const select = document.getElementById('manualTabFieldSelect');
  if (!select || !select.value) return;
  const key = select.value;
  const { config } = manualTabContext;
  config.hidden = config.hidden.filter(item => item !== key);
  if (!config.order.includes(key)) {
    config.order.push(key);
  }
  try {
    await saveManualTabConfig(manualTabContext.tabType, config);
  } catch (err) {
    console.error('Erro ao salvar configuração da aba:', err);
    showErrorMessage('Erro ao salvar configuração da aba.');
    return;
  }
  manualTabContext.config = config;
  renderManualTabManager();
  applyManualTabLabels(manualTabContext.tabType);
}

async function addManualTabCustomField() {
  if (!manualTabContext) return;
  const input = document.getElementById('manualTabNewFieldInput');
  const label = (input?.value || '').trim();
  if (!label) {
    showErrorMessage('Informe o nome do novo campo.');
    return;
  }
  const baseKey = normalizeManualFieldKey(label);
  if (!baseKey) {
    showErrorMessage('Nome inválido. Use letras e números.');
    return;
  }
  const tabType = manualTabContext.tabType;
  const uniqueKey = generateUniqueManualFieldKey(tabType, baseKey);
  try {
    await createManualCustomField(tabType, { key: uniqueKey, label });
  } catch (err) {
    console.error('Erro ao criar campo personalizado:', err);
    showErrorMessage('Erro ao salvar o novo campo.');
    return;
  }

  const { config } = manualTabContext;
  if (!config.order.includes(uniqueKey)) {
    config.order.push(uniqueKey);
  }
  config.hidden = config.hidden.filter(item => item !== uniqueKey);
  config.labels = { ...config.labels, [uniqueKey]: label };
  try {
    await saveManualTabConfig(tabType, config);
  } catch (err) {
    console.error('Erro ao salvar configuração da aba:', err);
    showErrorMessage('Erro ao salvar configuração da aba.');
    return;
  }
  manualTabContext.config = config;
  ensureManualTabColumns(tabType);
  renderManualTabManager();
  applyManualTabLabels(tabType);
  if (tabType === 'inventario') {
    applyFilters();
  } else {
    applyMachineFilters();
  }
  if (input) input.value = '';
  showActionToast('Nova coluna adicionada com sucesso.');
}

async function hideManualTabField(key) {
  if (!manualTabContext) return;
  const { config } = manualTabContext;
  if (!config.hidden.includes(key)) {
    config.hidden.push(key);
  }
  try {
    await saveManualTabConfig(manualTabContext.tabType, config);
  } catch (err) {
    console.error('Erro ao salvar configuração da aba:', err);
    showErrorMessage('Erro ao salvar configuração da aba.');
    return;
  }
  manualTabContext.config = config;
  renderManualTabManager();
  applyManualTabLabels(manualTabContext.tabType);
}

async function saveManualTabFields() {
  if (!manualTabContext) return;
  const container = document.getElementById('manageManualTabFields');
  if (!container) return;
  const inputs = container.querySelectorAll('input[data-field]');
  const labels = { ...manualTabContext.config.labels };
  inputs.forEach(input => {
    const key = input.dataset.field;
    const value = input.value.trim();
    if (value) {
      labels[key] = value;
    } else {
      delete labels[key];
    }
  });
  const nextConfig = {
    ...manualTabContext.config,
    labels
  };
  try {
    await saveManualTabConfig(manualTabContext.tabType, nextConfig);
  } catch (err) {
    console.error('Erro ao salvar configuração da aba:', err);
    showErrorMessage('Erro ao salvar configuração da aba.');
    return;
  }
  applyManualTabLabels(manualTabContext.tabType);
  closeManageManualTabModal();
}

async function resetManualTabFields() {
  if (!manualTabContext) return;
  try {
    await saveManualTabConfig(manualTabContext.tabType, null);
  } catch (err) {
    console.error('Erro ao resetar configuração da aba:', err);
    showErrorMessage('Erro ao resetar configuração da aba.');
    return;
  }
  try {
    await fetch(`${API_BASE}/manual-custom-fields?tabType=${manualTabContext.tabType}`, {
      method: 'DELETE'
    });
  } catch (err) {
    console.error('Erro ao limpar campos personalizados:', err);
  }
  setManualCustomFields(manualTabContext.tabType, []);
  setManualCustomValues(manualTabContext.tabType, {});
  manualCustomLoadState[manualTabContext.tabType].fields = true;
  manualCustomLoadState[manualTabContext.tabType].values = true;
  manualTabContext.config = getManualTabConfig(manualTabContext.tabType);
  ensureManualTabColumns(manualTabContext.tabType);
  renderManualTabManager();
  applyManualTabLabels(manualTabContext.tabType);
  if (manualTabContext.tabType === 'inventario') {
    applyFilters();
  } else {
    applyMachineFilters();
  }
}

function closeManageManualTabModal(e) {
  const modal = document.getElementById('manageManualTabModal');
  if (e && e.target.id === 'manageManualTabModal') {
    requestCloseModal(modal);
    return;
  }
  if (modal) {
    captureModalScrollState(modal);
    modal.classList.remove('show');
  }
  manualTabContext = null;
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
  updateFieldCountDisplay();

  if (templateKey === 'custom') return;
  const templateFields = tabTemplates[templateKey] || [];
  templateFields.forEach(field => addFieldWithValues({
    ...field,
    opcoes: getInheritedFieldOptions(field.nome, field.tipo)
  }));
  updateFieldCountDisplay();
  renderSortOptionsPicker();
  updateCategoriaAnchorOptions();
}

function addFieldWithValues({ nome = '', tipo = 'texto', obrigatorio = false, id = null, opcoes = [] } = {}) {
  const idx = newTabFields.length;

  newTabFields.push({
    id,
    nome,
    tipo,
    obrigatorio,
    opcoes
  });

  const row = document.createElement('div');
  row.className = 'field-row';
  row.dataset.idx = idx;

  const presetOptions = Object.entries(fieldPresetMap)
    .map(([key, value]) => `<option value="${key}">${value.group === 'inventario' ? 'Inventário' : 'Máquinas'}: ${value.nome}</option>`)
    .join('');

  row.innerHTML = `
    <div class="field-cell field-preset-cell">
      <label>Origem</label>
      <select class="field-preset" onchange="applyFieldPreset(${idx}, this.value)">
        <option value="" disabled selected>Usar campo de outra aba</option>
        ${presetOptions}
      </select>
    </div>

    <div class="field-cell field-name-cell">
      <label>Nome do campo</label>
      <input
        type="text"
        class="field-name"
        placeholder="Nome do campo"
        value="${escapeHtml(nome)}"
        oninput="window.newTabFields[${idx}].nome = this.value; renderSortOptionsPicker();"
      />
    </div>

    <div class="field-cell field-type-cell">
      <label>Tipo</label>
      <div class="field-type-wrapper">
        <select class="field-type" onchange="updateFieldType(${idx}, this.value, true)">
        <option value="texto">Texto</option>
        <option value="numero">Número</option>
        <option value="data">Data</option>
        <option value="email">E-mail</option>
        <option value="select">Lista</option>
        </select>
        <button type="button" class="field-type-help" onclick="openFieldTypeHelpModal()" aria-label="Explicações sobre tipos de campo">
          ?
        </button>
      </div>
    </div>

    <div class="field-cell field-options-cell">
      <label>Opções</label>
      <div class="field-type-options ${tipo === 'select' ? 'is-visible' : ''}">
        <span class="field-options-summary" id="fieldOptionsSummary-${idx}">Nenhuma opção definida.</span>
        <button type="button" class="btn secondary" onclick="openFieldOptionsModal(${idx})">Definir opções</button>
      </div>
    </div>

    <div class="field-cell field-required-cell">
      <label class="field-required-label">
        <input class="field-required" type="checkbox" ${obrigatorio ? 'checked' : ''} onchange="window.newTabFields[${idx}].obrigatorio = this.checked">
        Obrigatório
      </label>
    </div>

    <div class="field-cell field-actions">
      <button
        type="button"
        class="field-drag"
        title="Arraste para reordenar"
        aria-label="Arraste para reordenar"
        draggable="true"
      ><span class="field-drag-icon" aria-hidden="true"></span></button>

      <button
        type="button"
        class="field-remove"
        title="Remover campo"
        onclick="removeField(${idx})"
      >✕</button>
    </div>
  `;

  document.getElementById('fieldsContainer').appendChild(row);
  initFieldDragAndDrop();
  renderSortOptionsPicker();
  updateCategoriaAnchorOptions();
  filterFieldRows(getFieldSearchQuery());
  updateFieldCountDisplay();

  const typeSelect = row.querySelector('.field-type');
  if (typeSelect) {
    typeSelect.value = tipo;
  }
  updateFieldType(idx, tipo);
  updateFieldOptionsSummary(idx);
}

function getActiveFieldCount() {
  return newTabFields.filter(field => field && !field.__deleted).length;
}

function updateFieldCountDisplay() {
  const count = getActiveFieldCount();
  const labels = document.querySelectorAll('#fieldCountPill, #fieldManagerCountPill');
  labels.forEach(label => {
    if (!label) return;
    label.textContent = `${count} campo${count === 1 ? '' : 's'}`;
  });
}

let previousModalForFieldManager = null;

function openFieldManagerModal(addNewField = false) {
  const createModal = document.getElementById('createTabModal');
  if (createModal?.classList.contains('show')) {
    createModal.classList.remove('show');
    previousModalForFieldManager = 'createTabModal';
  }

  const modal = document.getElementById('fieldManagerModal');
  if (modal) {
    modal.classList.remove('hidden');
    showModal(modal);
    focusFirstField(modal);
    document.body.classList.add('modal-open');
  }

  if (addNewField) {
    addField();
    const container = document.getElementById('fieldsContainer');
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
  }
}

function closeFieldManagerModal(e, restorePrevious = true) {
  const modal = document.getElementById('fieldManagerModal');
  if (e && e.target.id === 'fieldManagerModal') {
    requestCloseModal(modal);
    return;
  }
  if (modal) {
    captureModalScrollState(modal);
    modal.classList.remove('show');
  }

  if (restorePrevious && previousModalForFieldManager === 'createTabModal') {
    const createModal = document.getElementById('createTabModal');
    if (createModal) {
      showModal(createModal);
      focusFirstField(createModal);
    }
  } else if (![...document.querySelectorAll('.modal.show')].length) {
    document.body.classList.remove('modal-open');
  }

  previousModalForFieldManager = null;
}

function getFieldSearchQuery() {
  return document.getElementById('fieldSearchInput')?.value || '';
}

function filterFieldRows(query = '') {
  const container = document.getElementById('fieldsContainer');
  if (!container) return;
  const normalized = query.trim().toLowerCase();
  const rows = [...container.querySelectorAll('.field-row')];
  let visibleCount = 0;

  rows.forEach(row => {
    const name = row.querySelector('.field-name')?.value || '';
    const preset = row.querySelector('.field-preset')?.selectedOptions?.[0]?.textContent || '';
    const type = row.querySelector('.field-type')?.value || '';
    const matches = !normalized || [name, preset, type].some(text => text.toLowerCase().includes(normalized));
    row.classList.toggle('is-hidden', !matches);
    if (matches) visibleCount += 1;
  });

  const emptyState = document.getElementById('fieldsFilterEmpty');
  if (emptyState) {
    const shouldShow = normalized && visibleCount === 0 && rows.length > 0;
    emptyState.classList.toggle('hidden', !shouldShow);
  }
}

function openFieldTypeHelpModal() {
  const el = document.getElementById('fieldTypeHelpModal');
  if (el) {
    el.classList.remove('hidden');
    showModal(el);
    focusFirstField(el);
  }
}

function closeFieldTypeHelpModal(e) {
  const modal = document.getElementById('fieldTypeHelpModal');
  if (e && e.target.id === 'fieldTypeHelpModal') {
    requestCloseModal(modal);
    return;
  }
  if (modal) {
    captureModalScrollState(modal);
    modal.classList.remove('show');
  }
}

window.openFieldTypeHelpModal = openFieldTypeHelpModal;
window.closeFieldTypeHelpModal = closeFieldTypeHelpModal;
window.openCategoriaAnchorHelpModal = openCategoriaAnchorHelpModal;
window.closeCategoriaAnchorHelpModal = closeCategoriaAnchorHelpModal;

let fieldOptionsModalIndex = null;

function updateFieldOptionsSummary(idx) {
  const summary = document.getElementById(`fieldOptionsSummary-${idx}`);
  if (!summary) return;
  const options = newTabFields[idx]?.opcoes || [];
  summary.textContent = options.length
    ? `Opções: ${options.join(', ')}`
    : 'Nenhuma opção definida.';
}

function openFieldOptionsModal(idx) {
  fieldOptionsModalIndex = idx;
  const input = document.getElementById('fieldOptionsInput');
  if (input) {
    const options = newTabFields[idx]?.opcoes || [];
    input.value = options.join(', ');
  }
  const modal = document.getElementById('fieldOptionsModal');
  if (modal) {
    modal.classList.remove('hidden');
    showModal(modal);
    focusFirstField(modal);
  }
}

function closeFieldOptionsModal(e) {
  const modal = document.getElementById('fieldOptionsModal');
  if (e && e.target.id === 'fieldOptionsModal') {
    requestCloseModal(modal);
    return;
  }
  if (modal) {
    captureModalScrollState(modal);
    modal.classList.remove('show');
  }
  fieldOptionsModalIndex = null;
}

function saveFieldOptionsModal() {
  if (fieldOptionsModalIndex === null) return;
  const input = document.getElementById('fieldOptionsInput');
  const value = input ? input.value : '';
  updateFieldOptions(fieldOptionsModalIndex, value);
  closeFieldOptionsModal();
}

window.openFieldOptionsModal = openFieldOptionsModal;
window.closeFieldOptionsModal = closeFieldOptionsModal;
window.saveFieldOptionsModal = saveFieldOptionsModal;

function addField() {
  addFieldWithValues();
  showActionToast('Nova coluna adicionada com sucesso.');
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
  renderSortOptionsPicker();
  updateCategoriaAnchorOptions();
  filterFieldRows(getFieldSearchQuery());
  updateFieldCountDisplay();
}

function sortFieldsAlphabetically() {
  const activeFields = newTabFields.filter(field => !field.__deleted);
  activeFields.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
  newTabFields = activeFields.map(field => ({ ...field }));
  window.newTabFields = newTabFields;
  const container = document.getElementById('fieldsContainer');
  if (container) container.innerHTML = '';
  newTabFields.forEach(field => addFieldWithValues(field));
  renderSortOptionsPicker();
  updateCategoriaAnchorOptions();
  filterFieldRows(getFieldSearchQuery());
  updateFieldCountDisplay();
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
    showErrorMessage('Informe o nome da aba');
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
    showErrorMessage('Adicione ao menos um campo com nome válido.');
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
  showActionToast(`Aba "${nome}" criada com sucesso.`);
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
    showErrorMessage('Informe o nome da aba.');
    return;
  }

  const hasFields = newTabFields.some(field => !field.__deleted && field.nome?.trim());
  if (!hasFields) {
    showErrorMessage('Adicione ao menos um campo.');
    return;
  }

  const res = await fetch(API_MODULOS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome, descricao })
  });

  const modulo = await res.json();

  const camposValidos = newTabFields
    .filter(field => !field.__deleted)
    .map(field => ({
      nome: field.nome?.trim() || '',
      tipo: field.tipo || 'texto',
      obrigatorio: !!field.obrigatorio,
      opcoes: Array.isArray(field.opcoes) ? field.opcoes : []
    }))
    .filter(field => field.nome);

  if (!camposValidos.length) {
    showErrorMessage('Adicione ao menos um campo com nome válido.');
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

  const sortCandidates = getSortOptionCandidates();
  const resolvedSortOptions = resolveSortOptionsSelection(sortCandidates, newTabSortOptions);
  await saveModuleSortOptions(modulo.id, resolvedSortOptions);
  const fieldOptionsMap = buildFieldOptionsMap(camposValidos);
  const hasCategoria = camposValidos.some(field => normalizeHeader(field.nome) === 'categoria');
  if (hasCategoria) {
    const categoriaAnchor = newTabFieldOptions.__categoriaAnchor || getCategoriaAnchorKey(camposValidos);
    if (categoriaAnchor) {
      fieldOptionsMap.__categoriaAnchor = categoriaAnchor;
    }
  }
  await saveModuleFieldOptions(modulo.id, fieldOptionsMap);


  closeCreateTabModal();
  await carregarModulos();
  showActionToast(`Aba "${nome}" criada com sucesso.`);
}
function closeAllModals() {
  document.querySelectorAll('.modal.show').forEach(m => {
    captureModalScrollState(m);
    m.classList.remove('show');
  });
  document.body.classList.remove('modal-open');
}

function getModalCloseConfirmation(modalEl) {
  if (!modalEl) return null;
  const shouldConfirm = modalEl.dataset.confirmClose === 'true';
  if (!shouldConfirm) return null;
  return {
    title: modalEl.dataset.confirmTitle || 'Confirmar fechamento',
    message:
      modalEl.dataset.confirmMessage ||
      'Deseja fechar este modal? Alterações não salvas podem ser perdidas.'
  };
}

function forceCloseModal(modalEl) {
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
    case 'importMappingModal':
      closeImportMappingModal();
      break;
    case 'createTabModal':
      closeCreateTabModal();
      break;
    case 'fieldManagerModal':
      closeFieldManagerModal();
      break;
    case 'manageManualTabModal':
      closeManageManualTabModal();
      break;
    case 'manualMigrationModal':
      closeManualMigrationModal();
      break;
    case 'moduloRegistroModal':
      closeModuloRegistroModal();
      break;
    case 'confirmDeleteModuloModal':
      closeConfirmDeleteModulo();
      break;
    case 'fieldTypeHelpModal':
      closeFieldTypeHelpModal();
      break;
    case 'categoriaAnchorHelpModal':
      closeCategoriaAnchorHelpModal();
      break;
    case 'fieldOptionsModal':
      closeFieldOptionsModal();
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

function requestCloseModal(modalEl) {
  const confirmData = getModalCloseConfirmation(modalEl);
  if (confirmData) {
    showConfirm(confirmData.message, () => forceCloseModal(modalEl), confirmData.title, { keepOpen: true });
    return;
  }
  forceCloseModal(modalEl);
}

function closeModalByEsc(modalEl) {
  requestCloseModal(modalEl);
}

function handleModalBackdropClick(event, modalId) {
  if (!event) return;
  const modalEl = modalId ? document.getElementById(modalId) : event.target;
  if (!modalEl) return;
  if (event.target === modalEl) {
    requestCloseModal(modalEl);
  }
}

function setModalLoading(modalEl, isLoading, message = 'Carregando...') {
  if (!modalEl) return;
  const card = modalEl.querySelector('.card');
  if (!card) return;
  if (isLoading) {
    let overlay = card.querySelector('.modal-loading');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'modal-loading';
      overlay.innerHTML = `
        <div class="modal-loading-spinner" aria-hidden="true"></div>
        <div class="modal-loading-text"></div>
      `;
      card.appendChild(overlay);
    }
    const textEl = overlay.querySelector('.modal-loading-text');
    if (textEl) {
      textEl.textContent = message;
    }
    modalEl.setAttribute('aria-busy', 'true');
  } else {
    card.querySelector('.modal-loading')?.remove();
    modalEl.removeAttribute('aria-busy');
  }
}

/**
 * Abre um modal por ID (sem conflitar com openModal do inventário).
 * Ex: openModalById('createTabModal')
 */
function openModalById(id, options = {}) {
  const { keepOpen = false } = options || {};
  if (!keepOpen) {
    closeAllModals();
  }
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove('hidden');
    el.classList.add('show');
    restoreModalScrollState(el);
    focusFirstField(el);
    document.body.classList.add('modal-open');
  }
}





// FECHAR AO CLICAR FORA (SEM QUEBRAR)
document.addEventListener('click', (e) => {
  if (!e.target.closest('.export-wrapper')) {
    document.getElementById('exportMenuInv')?.classList.add('hidden');
    document.getElementById('exportMenuMq')?.classList.add('hidden');
    document.getElementById('exportMenuMod')?.classList.add('hidden');
    document.getElementById('sortMenuMq')?.classList.add('hidden');
    document.getElementById('sortMenuInv')?.classList.add('hidden');
    document.getElementById('sortMenuMod')?.classList.add('hidden');
  }
  if (!e.target.closest('.tab-dinamica-wrapper')) {
    closeTabMenus();
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
    document.getElementById('sortMenuMq')?.classList.add('hidden');
    document.getElementById('sortMenuInv')?.classList.add('hidden');
    document.getElementById('sortMenuMod')?.classList.add('hidden');
  }
});

function getActiveSearchInput() {
  if (document.getElementById('tabInventario')?.classList.contains('active')) {
    return document.getElementById('q');
  }
  if (document.getElementById('tabMaquinas')?.classList.contains('active')) {
    return document.getElementById('mq');
  }
  if (document.getElementById('tabModuloDinamico')?.classList.contains('active')) {
    return document.getElementById('moduleSmartSearch');
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
      return;
    }
    closeTabMenus();
    document.getElementById('exportMenuInv')?.classList.add('hidden');
    document.getElementById('exportMenuMq')?.classList.add('hidden');
    document.getElementById('exportMenuMod')?.classList.add('hidden');
    document.getElementById('sortMenuMq')?.classList.add('hidden');
    document.getElementById('sortMenuInv')?.classList.add('hidden');
    document.getElementById('sortMenuMod')?.classList.add('hidden');
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
  window.toggleSortMenu = toggleSortMenu;
  window.carregarLogoPrefeitura = carregarLogoPrefeitura;
  window.toggleFilters = toggleFilters;
  window.clearInventoryFilters = clearInventoryFilters;
  window.clearMachineFilters = clearMachineFilters;
  window.clearModuloFilters = clearModuloFilters;
  window.applyModuloSmartSearch = applyModuloSmartSearch;
  window.addModuloStructuredFilter = addModuloStructuredFilter;
  window.saveModuloFilterPreset = saveModuloFilterPreset;
  window.applyModuloFilterPreset = applyModuloFilterPreset;
  window.deleteModuloFilterPreset = deleteModuloFilterPreset;
  window.openModuleFiltersModal = openModuleFiltersModal;
  window.closeModuleFiltersModal = closeModuleFiltersModal;
  window.clearImportHistory = clearImportHistory;
  window.reprocessImport = reprocessImport;
  window.openImportModal = openImportModal;
  window.openImportUploadModal = openImportUploadModal;
  window.openImportMappingModal = openImportMappingModal;
  window.closeImportModal = closeImportModal;
  window.closeImportMappingModal = closeImportMappingModal;
  window.closeImportModalIfClicked = closeImportModalIfClicked;
  window.closeImportMappingModalIfClicked = closeImportMappingModalIfClicked;
  window.dismissImportWarningNotice = dismissImportWarningNotice;
  window.openImportHistoryModal = openImportHistoryModal;
  window.closeImportHistoryModal = closeImportHistoryModal;
  window.closeImportHistoryModalIfClicked = closeImportHistoryModalIfClicked;
  window.addMissingImportField = addMissingImportField;
  window.handleImportFile = handleImportFile;
  window.confirmImport = confirmImport;
  window.removeImportRow = removeImportRow;
  window.updateImportCell = updateImportCell;
  window.updateImportMapping = updateImportMapping;
  window.showActionToastLeft = showActionToastLeft;
  window.closeHelpPanel = closeHelpPanel;

  window.openCreateTabModal = openCreateTabModal;
  window.submitTabModal = submitTabModal;
  window.sortFieldsAlphabetically = sortFieldsAlphabetically;
  window.openManualTabManager = openManualTabManager;
  window.saveManualTabFields = saveManualTabFields;
  window.addManualTabField = addManualTabField;
  window.addManualTabCustomField = addManualTabCustomField;
  window.hideManualTabField = hideManualTabField;
  window.resetManualTabFields = resetManualTabFields;
  window.closeManageManualTabModal = closeManageManualTabModal;
  window.toggleTabMenu = toggleTabMenu;
  window.applyFieldPreset = applyFieldPreset;
  window.updateFieldType = updateFieldType;
  window.closeCreateTabModal = closeCreateTabModal;
  window.applyTabTemplate = applyTabTemplate;
  window.applyTabInheritance = applyTabInheritance;
  window.addField = addField;
  window.openFieldManagerModal = openFieldManagerModal;
  window.closeFieldManagerModal = closeFieldManagerModal;
  window.filterFieldRows = filterFieldRows;
  window.filterManualTabFields = filterManualTabFields;
  window.openManualMigrationModal = openManualMigrationModal;
  window.closeManualMigrationModal = closeManualMigrationModal;
  window.runManualMigration = runManualMigration;
  window.toggleSortOption = toggleSortOption;
  window.salvarNovoModulo = salvarNovoModulo;
window.openModalById = openModalById;
window.setModalLoading = setModalLoading;
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
window.openBulkEditModal = openBulkEditModal;
window.closeBulkEditModal = closeBulkEditModal;
window.closeBulkEditModalIfClicked = closeBulkEditModalIfClicked;
window.applyBulkEdit = applyBulkEdit;
window.clearNotifications = clearNotifications;
window.refreshNotifications = refreshNotifications;
window.dismissNotification = dismissNotification;
window.handleNotificationAction = handleNotificationAction;
window.openGuidedExport = openGuidedExport;
window.closeGuidedExportModal = closeGuidedExportModal;
window.confirmGuidedExport = confirmGuidedExport;


  /* ===========================
     INICIALIZAÇÃO
     =========================== */
     await carregarModulos();

  await carregarLogoPrefeitura();
  fetchData();
  fetchMachines();
});
