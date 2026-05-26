'use strict';

const API_BASE = '/api';
const AUTH_STORAGE_KEY = 'ponto_escolar_auth';
const DEFAULT_REQUEST_TIMEOUT_MS = 15000;

function getCurrentPath() {
  return window.location.pathname || '/';
}

function isLoginPage() {
  const path = getCurrentPath();
  return path === '/' || path === '/login' || path === '/home';
}

function isAdminPage() {
  const path = getCurrentPath();
  return path === '/admin' || path.startsWith('/admin/');
}

function isPublicPunchPage() {
  return false;
}

function loadAuthState() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      return { token: null, admin: null };
    }
    const parsed = JSON.parse(raw);
    return {
      token: typeof parsed?.token === 'string' ? parsed.token : null,
      admin: parsed?.admin || null
    };
  } catch (_error) {
    return { token: null, admin: null };
  }
}

function saveAuthState(token, admin) {
  const payload = { token, admin };
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload));
}

function clearAuthState() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

function getAuthToken() {
  return loadAuthState().token;
}

function redirectToLogin() {
  window.location.href = '/login';
}

function redirectToDashboard() {
  window.location.href = '/admin/dashboard';
}

function getIniciais(nomeCompleto) {
  const partes = String(nomeCompleto || '')
    .trim()
    .split(' ')
    .filter(Boolean);
  if (!partes.length) {
    return 'AD';
  }
  if (partes.length === 1) {
    return partes[0].slice(0, 2).toUpperCase();
  }
  return `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase();
}

function getPrimeiroNome(nomeCompleto) {
  return String(nomeCompleto || '').trim().split(' ')[0] || 'Administrador';
}

function formatDateLong(date) {
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
}

function formatDateShort(dateString) {
  const parsed = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return dateString;
  }
  return parsed.toLocaleDateString('pt-BR');
}

function formatTimeFromIso(value) {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value).slice(11, 16) || '—';
  }
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function sanitizeMessage(value, fallback) {
  const text = String(value || '').trim();
  return text || fallback;
}

function mostrarToast(mensagem, tipo = 'info', duracao = 3500) {
  const icons = {
    success: '✓',
    error: '✕',
    info: 'i'
  };

  const container = document.getElementById('toast-container');
  if (!container) {
    return;
  }

  const toast = document.createElement('div');
  toast.className = `toast ${tipo}`;
  toast.innerHTML = `<span>${icons[tipo] || icons.info}</span> ${mensagem}`;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duracao);
}

function initClock() {
  const elHora = document.getElementById('topbar-time');
  const elData = document.getElementById('topbar-date');

  if (!elHora || !elData) {
    return;
  }

  function updateClock() {
    const now = new Date();
    elHora.textContent = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    elData.textContent = formatDateLong(now);
  }

  updateClock();
  setInterval(updateClock, 1000);
}

function initSidebar() {
  const toggleBtn = document.getElementById('menu-toggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');

  if (!toggleBtn || !sidebar || !overlay) {
    return;
  }

  toggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
  });

  overlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
  });
}

function bindLogoutButtons() {
  const logoutButtons = document.querySelectorAll('.logout-btn');
  logoutButtons.forEach((button) => {
    button.onclick = null;
    button.addEventListener('click', () => {
      clearAuthState();
      redirectToLogin();
    });
  });
}

function setLoadingButton(button, loadingText) {
  if (!button) {
    return () => { };
  }
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = loadingText;
  return () => {
    button.disabled = false;
    button.textContent = originalText;
  };
}

