const STORAGE_KEY = 'scm-redevances-local';
const statusLabels = {
  appelee: 'Appelée',
  payee: 'Payée',
  en_attente: 'En attente',
};

const entryForm = document.getElementById('entry-form');
const formFeedback = document.getElementById('form-feedback');
const importBtn = document.getElementById('import-btn');
const importFeedback = document.getElementById('import-feedback');
const fileInput = document.getElementById('file-input');
const resetBtn = document.getElementById('reset-data');
const rangeFilter = document.getElementById('range-filter');
const calledTotal = document.getElementById('called-total');
const paidTotal = document.getElementById('paid-total');
const pendingTotal = document.getElementById('pending-total');
const entriesBody = document.getElementById('entries-body');
const entryCount = document.getElementById('entry-count');

const state = {
  entries: [],
};

function formatCurrency(value) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(value);
}

function loadEntries() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      state.entries = JSON.parse(stored);
      return;
    } catch (error) {
      console.warn('Impossible de lire les données locales, réinitialisation.', error);
    }
  }

  const now = new Date();
  const sample = Array.from({ length: 12 }).map((_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    return {
      id: crypto.randomUUID(),
      identity: index % 2 === 0 ? 'Dr. Martin' : 'Remplaçant Durand',
      role: index % 2 === 0 ? 'medecin' : 'remplacant',
      period,
      amount: Math.round(200 + Math.random() * 400),
      status: index % 3 === 0 ? 'payee' : index % 3 === 1 ? 'appelee' : 'en_attente',
    };
  });

  state.entries = sample;
  saveEntries();
}

function saveEntries() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.entries));
}

function showMessage(element, message) {
  element.textContent = message;
  element.hidden = false;
  setTimeout(() => { element.hidden = true; }, 2000);
}

function upsertEntries(newEntries) {
  const existingIds = new Set(state.entries.map((entry) => entry.id));
  newEntries.forEach((entry) => {
    if (!entry.id || existingIds.has(entry.id)) {
      entry.id = crypto.randomUUID();
    }
  });

  state.entries = [...newEntries, ...state.entries];
  saveEntries();
  render();
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());

  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim());
    const record = Object.fromEntries(headers.map((h, index) => [h, values[index] ?? '']));
    return {
      id: crypto.randomUUID(),
      identity: record.identite || record.identité || record.nom || 'N/A',
      role: record.profil || record.role || 'medecin',
      period: record.periode || record.period || '2024-01',
      amount: Number(record.montant || record.amount || 0),
      status: (record.statut || record.status || 'appelee').toLowerCase(),
    };
  });
}

function summarize(entries) {
  return entries.reduce((acc, entry) => {
    acc[entry.status] = (acc[entry.status] || 0) + entry.amount;
    return acc;
  }, { appelee: 0, payee: 0, en_attente: 0 });
}

function filterByRange(entries, months) {
  if (months === 'all') return entries;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - Number(months));

  return entries.filter((entry) => {
    const [year, month] = entry.period.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    return date >= cutoff;
  });
}

function renderSummary() {
  const filtered = filterByRange(state.entries, rangeFilter.value);
  const totals = summarize(filtered);
  calledTotal.textContent = formatCurrency(totals.appelee);
  paidTotal.textContent = formatCurrency(totals.payee);
  pendingTotal.textContent = formatCurrency(totals.en_attente);
}

function renderTable() {
  if (!state.entries.length) {
    entriesBody.innerHTML = '<tr><td colspan="5">Aucune donnée</td></tr>';
    entryCount.textContent = '0 enregistrement';
    return;
  }

  const rows = [...state.entries]
    .sort((a, b) => b.period.localeCompare(a.period))
    .map((entry) => `
      <tr>
        <td>${entry.period}</td>
        <td>${entry.identity}</td>
        <td>${entry.role === 'medecin' ? 'Médecin' : 'Remplaçant'}</td>
        <td>${formatCurrency(entry.amount)}</td>
        <td><span class="pill">${statusLabels[entry.status] || entry.status}</span></td>
      </tr>
    `)
    .join('');

  entriesBody.innerHTML = rows;
  entryCount.textContent = `${state.entries.length} enregistrement${state.entries.length > 1 ? 's' : ''}`;
}

function render() {
  renderTable();
  renderSummary();
}

function handleSubmit(event) {
  event.preventDefault();
  const formData = new FormData(entryForm);
  const entry = {
    id: crypto.randomUUID(),
    identity: formData.get('identity'),
    role: formData.get('role'),
    period: formData.get('period'),
    amount: Number(formData.get('amount')),
    status: formData.get('status'),
  };

  upsertEntries([entry]);
  entryForm.reset();
  showMessage(formFeedback, 'Données sauvegardées');
}

function handleImport() {
  const file = fileInput.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const records = parseCsv(String(reader.result));
    if (records.length === 0) {
      showMessage(importFeedback, 'Aucune ligne valide trouvée');
      return;
    }
    upsertEntries(records);
    showMessage(importFeedback, `${records.length} ligne${records.length > 1 ? 's' : ''} importée${records.length > 1 ? 's' : ''}`);
    fileInput.value = '';
  };
  reader.readAsText(file);
}

function handleReset() {
  if (!confirm('Voulez-vous vraiment effacer les données locales ?')) return;
  state.entries = [];
  saveEntries();
  render();
}

function init() {
  loadEntries();
  render();

  entryForm.addEventListener('submit', handleSubmit);
  importBtn.addEventListener('click', handleImport);
  rangeFilter.addEventListener('change', render);
  resetBtn.addEventListener('click', handleReset);
}

window.addEventListener('DOMContentLoaded', init);
