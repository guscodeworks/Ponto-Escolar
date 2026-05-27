/* ============================================================
   PDF / IMPRESSÃO
   ============================================================ */

function gerarPDF() {
  const btn = document.getElementById('btn-gerar-pdf');
  if (!btn) return;
  btn.classList.add('loading');
  setTimeout(() => { toast('PDF gerado com sucesso!', 'success'); btn.classList.remove('loading'); }, 1800);
}

function imprimirRelatorio() {
  toast('Abrindo janela de impressão…','info');
  setTimeout(() => window.print(), 600);
}

/* ============================================================
   CONFIGURAÇÕES
   ============================================================ */

function iniciarConfiguracoes() {
  const navItems = document.querySelectorAll('.settings-nav-item[data-panel]');
  if (!navItems.length) return;
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      document.querySelectorAll('.settings-panel').forEach(p => p.style.display = 'none');
      const target = document.getElementById(item.dataset.panel);
      if (target) target.style.display = 'block';
    });
  });
}

/* ============================================================
   AUTENTICAÇÃO — GOV.BR
   Chave compartilhada com ponto-login.html
   ============================================================ */

const ADMIN_AUTH_STORAGE_KEY = 'ponto_escolar_auth';

/**
 * Lê a sessão salva pelo fluxo GOV.BR em ponto-login.html.
 * Retorna { token, admin } ou null se não houver sessão válida.
 */
function carregarAuthAdmin() {
  try {
    const raw = localStorage.getItem(ADMIN_AUTH_STORAGE_KEY)
             || sessionStorage.getItem(ADMIN_AUTH_STORAGE_KEY)
             || '{}';
    const auth = JSON.parse(raw);
    return (typeof auth.token === 'string' && auth.token) ? auth : null;
  } catch (_e) {
    return null;
  }
}

/**
 * Salva (ou atualiza) a sessão no localStorage e sessionStorage.
 */
function salvarAuthAdmin(token, admin) {
  const payload = JSON.stringify({ token, admin });
  localStorage.setItem(ADMIN_AUTH_STORAGE_KEY, payload);
  sessionStorage.setItem(ADMIN_AUTH_STORAGE_KEY, payload);
}

/**
 * Remove completamente a sessão de ambos os storages.
 */
function limparAuthAdmin() {
  localStorage.removeItem(ADMIN_AUTH_STORAGE_KEY);
  sessionStorage.removeItem(ADMIN_AUTH_STORAGE_KEY);
}

/**
 * Resolve o caminho relativo até ponto-login.html a partir de qualquer
 * página dentro da pasta admin/.
 */
function caminhoLogin() {
  // Todas as páginas admin estão em admin/ → um nível acima é a raiz
  return '../ponto-login.html';
}

/**
 * Guard de rota: verifica se existe uma sessão GOV.BR válida.
 * Se não houver, redireciona para ponto-login.html e retorna false.
 */
function validarSessaoAdmin() {
  const auth = carregarAuthAdmin();

  if (!auth) {
    // Sem sessão: redireciona para a tela inicial (GOV.BR login)
    window.location.replace(caminhoLogin());
    return false;
  }

  // Sessão válida: popula estado global se disponível
  if (typeof ADMIN !== 'undefined' && auth.admin) {
    ADMIN.nome = auth.admin.nome || ADMIN.nome;
    ADMIN.cpf  = auth.admin.cpf  || '';
  }

  return true;
}

/**
 * iniciarLogin: mantida por compatibilidade com 09-init.js.
 * O login local foi removido — autenticação é feita pelo GOV.BR.
 */
function iniciarLogin() {
  // Login local removido. Autenticação via GOV.BR em ponto-login.html.
}

/**
 * Logout: limpa sessão e redireciona para a tela inicial (ponto-login.html).
 */
function iniciarLogoutAdmin() {
  document.querySelectorAll('.btn-logout').forEach((button) => {
    button.onclick = null;
    button.removeAttribute('onclick');
    button.addEventListener('click', function (event) {
      event.preventDefault();
      limparAuthAdmin();
      window.location.href = caminhoLogin();
    });
  });
}

/* ============================================================
   BUSCA E FILTROS — FUNCIONÁRIOS
   ============================================================ */

function iniciarFiltrosFuncionarios() {
  const inputBusca = document.getElementById('busca-funcionario');
  const filtroStatus = document.getElementById('filtro-status');
  const filtroCargo  = document.getElementById('filtro-cargo');

  const atualizar = () => renderizarFuncionarios(inputBusca?.value || '');

  if (inputBusca)   inputBusca.addEventListener('input', atualizar);
  if (filtroStatus) filtroStatus.addEventListener('change', atualizar);
  if (filtroCargo)  filtroCargo.addEventListener('change', atualizar);
}

/* ============================================================
   INICIALIZAÇÃO
   ============================================================ */
