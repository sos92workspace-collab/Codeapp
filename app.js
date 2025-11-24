import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://ixwzkhitzykokvzggmix.supabase.co';
const SUPABASE_KEY = 'sb_publishable_apJygRnFeCm6G6MW7IWfGw_LeOr31BK';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const authPanel = document.getElementById('auth-panel');
const dashboard = document.getElementById('dashboard');
const authForm = document.getElementById('auth-form');
const authMessage = document.getElementById('auth-message');
const logoutBtn = document.getElementById('logout-btn');
const roleLabel = document.getElementById('role-label');
const welcomeMessage = document.getElementById('welcome-message');
const periodLabel = document.getElementById('period-label');
const adminTools = document.getElementById('admin-tools');
const overview = document.getElementById('overview');
const personal = document.getElementById('personal');
const periodFilter = document.getElementById('period-filter');
const personalPeriod = document.getElementById('personal-period');
const calledTotal = document.getElementById('called-total');
const paidTotal = document.getElementById('paid-total');
const pendingTotal = document.getElementById('pending-total');
const annualRows = document.getElementById('annual-rows');
const personalRows = document.getElementById('personal-rows');
const parseBtn = document.getElementById('parse-btn');
const feeFile = document.getElementById('fee-file');
const manualForm = document.getElementById('manual-form');
const manualFeedback = document.getElementById('manual-feedback');
const statusPill = document.getElementById('status-pill');

const state = {
  user: null,
  role: null,
  profile: null,
  fees: [],
};

const statusLabels = {
  appelee: 'Appelée',
  payee: 'Payée',
  en_attente: 'En attente',
};

function formatCurrency(value) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(value);
}

function showAuthMessage(message) {
  authMessage.textContent = message;
  authMessage.hidden = !message;
}

async function fetchProfile(user) {
  const { data, error } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).single();
  if (error) {
    console.warn('Profil introuvable, utilisation du rôle sélectionné.', error.message);
    return null;
  }
  return data;
}

async function fetchFees(userId, role) {
  const fourYearsAgo = new Date();
  fourYearsAgo.setFullYear(fourYearsAgo.getFullYear() - 4);
  const cutoff = `${fourYearsAgo.getFullYear()}-${String(fourYearsAgo.getMonth() + 1).padStart(2, '0')}`;

  const query = supabase
    .from('redevances')
    .select('id, actor_name, actor_role, period, amount, status')
    .gte('period', cutoff)
    .order('period', { ascending: false });

  if (role !== 'administrateur') {
    query.eq('actor_id', userId);
  }

  const { data, error } = await query;

  if (error) {
    console.warn('Utilisation de données locales (Supabase indisponible):', error.message);
    state.fees = sampleFees();
    return;
  }

  state.fees = data || [];
}

function sampleFees() {
  const now = new Date();
  const items = [];
  for (let i = 0; i < 24; i += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const amount = Math.round(200 + Math.random() * 400);
    const statusKeys = ['appelee', 'payee', 'en_attente'];
    const status = statusKeys[i % statusKeys.length];
    items.push({
      id: `mock-${i}`,
      actor_name: i % 2 === 0 ? 'Dr. Dupont' : 'Remplaçant Martin',
      actor_role: i % 2 === 0 ? 'medecin' : 'remplacant',
      actor_id: state.user?.id || 'demo',
      period,
      amount,
      status,
    });
  }
  return items;
}

function summarizeFees(fees) {
  const totals = { appelee: 0, payee: 0, en_attente: 0 };
  fees.forEach((fee) => {
    if (totals[fee.status] !== undefined) {
      totals[fee.status] += fee.amount;
    }
  });
  return totals;
}

function groupByYear(fees) {
  const byYear = new Map();
  fees.forEach((fee) => {
    const [year] = fee.period.split('-');
    if (!byYear.has(year)) {
      byYear.set(year, { appelee: 0, payee: 0, en_attente: 0 });
    }
    const group = byYear.get(year);
    group[fee.status] += fee.amount;
  });
  return Array.from(byYear.entries())
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .map(([year, totals]) => ({ year, ...totals }));
}

function renderOverview(fees) {
  const summary = summarizeFees(fees);
  calledTotal.textContent = formatCurrency(summary.appelee);
  paidTotal.textContent = formatCurrency(summary.payee);
  pendingTotal.textContent = formatCurrency(summary.en_attente);

  const rows = groupByYear(fees)
    .map((row) => `
      <tr>
        <td>${row.year}</td>
        <td>${formatCurrency(row.appelee)}</td>
        <td>${formatCurrency(row.payee)}</td>
        <td>${formatCurrency(row.en_attente)}</td>
      </tr>
    `)
    .join('');
  annualRows.innerHTML = rows || '<tr><td colspan="4">Aucune donnée</td></tr>';
}

function renderPersonal(fees) {
  const rows = fees
    .sort((a, b) => b.period.localeCompare(a.period))
    .map((fee) => `
      <tr>
        <td>${fee.period}</td>
        <td>${formatCurrency(fee.amount)}</td>
        <td><span class="pill">${statusLabels[fee.status] || fee.status}</span></td>
      </tr>
    `)
    .join('');
  personalRows.innerHTML = rows || '<tr><td colspan="3">Aucune redevance trouvée</td></tr>';
}

function filterByPeriod(fees, months) {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  return fees.filter((fee) => {
    const [year, month] = fee.period.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    return date >= cutoff;
  });
}

function applyAdminFilters() {
  const filter = periodFilter.value;
  const now = new Date();
  let filtered = [...state.fees];

  if (filter === 'current-year') {
    filtered = filtered.filter((fee) => fee.period.startsWith(String(now.getFullYear())));
    periodLabel.textContent = `Année ${now.getFullYear()}`;
  } else if (filter === 'last-year') {
    const last = now.getFullYear() - 1;
    filtered = filtered.filter((fee) => fee.period.startsWith(String(last)));
    periodLabel.textContent = `Année ${last}`;
  } else {
    periodLabel.textContent = '4 dernières années';
  }

  renderOverview(filtered);
}

function applyPersonalFilters() {
  const months = Number(personalPeriod.value);
  renderPersonal(filterByPeriod(state.fees, months));
}

async function handleAuth(event) {
  event.preventDefault();
  const formData = new FormData(authForm);
  const email = formData.get('email');
  const password = formData.get('password');
  const selectedRole = formData.get('role');

  showAuthMessage('Connexion en cours...');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data?.user) {
    showAuthMessage('Connexion impossible. Vérifiez vos identifiants.');
    return;
  }

  state.user = data.user;
  state.profile = await fetchProfile(data.user);
  state.role = state.profile?.role || selectedRole || 'medecin';

  showAuthMessage('');
  statusPill.textContent = 'Connecté';
  statusPill.classList.remove('pill--warning');

  welcomeMessage.textContent = state.profile?.full_name || data.user.email;
  roleLabel.textContent = `Profil : ${state.role}`;

  authPanel.hidden = true;
  dashboard.hidden = false;
  logoutBtn.hidden = false;

  adminTools.hidden = state.role !== 'administrateur';
  overview.hidden = state.role !== 'administrateur';
  personal.hidden = state.role === 'administrateur';

  await fetchFees(data.user.id, state.role);
  if (state.role === 'administrateur') {
    applyAdminFilters();
  } else {
    applyPersonalFilters();
  }
}

async function handleLogout() {
  await supabase.auth.signOut();
  state.user = null;
  state.fees = [];
  authPanel.hidden = false;
  dashboard.hidden = true;
  logoutBtn.hidden = true;
  showAuthMessage('Vous avez été déconnecté.');
}

function parseCsv(text) {
  const [headerLine, ...lines] = text.trim().split(/\r?\n/);
  const headers = headerLine.split(',').map((h) => h.trim().toLowerCase());
  return lines.map((line) => {
    const values = line.split(',').map((v) => v.trim());
    const record = Object.fromEntries(headers.map((h, index) => [h, values[index]]));
    return {
      actor_name: record.identite || record.nom || 'N/A',
      actor_role: record.profil || record.role || 'medecin',
      period: record.periode || record.period || '2024-01',
      amount: Number(record.montant || record.amount || 0),
      status: (record.statut || 'appelee').toLowerCase(),
    };
  });
}

async function importFees(records) {
  const payload = records.map((row) => ({
    actor_name: row.actor_name,
    actor_role: row.actor_role,
    actor_id: state.user?.id,
    period: row.period,
    amount: row.amount,
    status: row.status,
  }));

  const { error } = await supabase.from('redevances').insert(payload);
  if (error) {
    console.warn('Enregistrement local (Supabase indisponible)', error.message);
    state.fees.unshift(...payload);
  } else {
    await fetchFees(state.user.id, state.role);
  }

  applyAdminFilters();
}

function handleFileImport() {
  const file = feeFile.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    const records = parseCsv(String(reader.result));
    await importFees(records);
  };
  reader.readAsText(file);
}

async function handleManual(event) {
  event.preventDefault();
  const formData = new FormData(manualForm);
  const record = {
    actor_name: formData.get('identity'),
    actor_role: formData.get('profile'),
    actor_id: state.user?.id,
    period: formData.get('period'),
    amount: Number(formData.get('amount')),
    status: formData.get('status'),
  };

  const { error } = await supabase.from('redevances').insert(record);
  if (error) {
    console.warn('Enregistrement local (Supabase indisponible)', error.message);
    state.fees.unshift(record);
  } else {
    await fetchFees(state.user.id, state.role);
  }

  manualFeedback.hidden = false;
  setTimeout(() => { manualFeedback.hidden = true; }, 2000);
  manualForm.reset();
  applyAdminFilters();
}

function initEventListeners() {
  authForm.addEventListener('submit', handleAuth);
  logoutBtn.addEventListener('click', handleLogout);
  parseBtn.addEventListener('click', handleFileImport);
  manualForm.addEventListener('submit', handleManual);
  periodFilter.addEventListener('change', applyAdminFilters);
  personalPeriod.addEventListener('change', applyPersonalFilters);
}

document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
});
