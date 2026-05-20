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
   LOGIN
   ============================================================ */

function iniciarLogin() {
  const form = document.getElementById('form-login');
  if (!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    const btn = form.querySelector('#btn-login');
    if (btn) btn.classList.add('loading');
    setTimeout(() => { window.location.href = '/admin/dashboard'; }, 900);
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

