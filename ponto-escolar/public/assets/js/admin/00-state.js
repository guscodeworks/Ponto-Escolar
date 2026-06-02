/**
 * ============================================================
 * SISTEMA DE PONTO — SALA DO FUTURO
 * admin-main.js — Lógica da área administrativa
 * ============================================================
 */

'use strict';

/* ============================================================
   DADOS GLOBAIS (simulados — integrar com back-end)
   ============================================================ */
const togglePwButton = document.getElementById('toggle-pw');
if (togglePwButton) {
  togglePwButton.addEventListener('click', function() {
    const inp = document.getElementById('login-senha');
    if (!inp) {
      return;
    }
    const isHidden = inp.type === 'password';
    inp.type = isHidden ? 'text' : 'password';
    this.textContent = isHidden ? '🙈' : '👁';
  });
}
const ADMIN = {
  nome: 'Carlos Eduardo',
  cargo: 'Administrador',
};

let FUNCIONARIOS = [];

async function carregarFuncionariosDoBanco() {
  try {
    const response = await fetch('/api/admin/funcionarios', {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      },
      credentials: 'same-origin'
    });

    const payload = await response.json();
console.log('RESPOSTA FUNCIONARIOS:', payload);
    

    if (!response.ok) {
      throw new Error(payload?.error?.message || 'Erro ao carregar funcionários');
    }

    FUNCIONARIOS = (payload.data.items || []).map(f => ({
      id: f.id,
      nome: f.nome,
      email: f.email,
      cpf: f.cpf,
      cargo: f.cargo || f.cargo_nome || '—',
      tel: f.tel || f.telefone || '—',
      status: f.ativo ? 'ativo' : 'inativo',
      admissao: f.criado_em ? new Date(f.criado_em).toLocaleDateString('pt-BR') : '—'
    }));
    
    console.log('FUNCIONARIOS MONTADOS:', FUNCIONARIOS);

    if (typeof renderizarFuncionarios === 'function') {
      renderizarFuncionarios();
    }

  } catch (error) {
    console.error(error);
    if (typeof toast === 'function') {
      toast('Erro ao carregar funcionários do banco.', 'error');
    }
  }
}

const PONTOS_HOJE = [
  { id:1, funcionarioId:1, entrada:'07:55', pausa:'12:00', retorno:'13:00', saida:'17:05', status:'completo' },
  { id:2, funcionarioId:2, entrada:'08:02', pausa:'12:05', retorno:'13:05', saida:null,    status:'presente' },
  { id:3, funcionarioId:4, entrada:'07:48', pausa:'12:00', retorno:'13:00', saida:'17:00', status:'completo' },
  { id:4, funcionarioId:5, entrada:'07:30', pausa:'11:58', retorno:'12:58', saida:'17:00', status:'completo' },
  { id:5, funcionarioId:7, entrada:'08:10', pausa:null,    retorno:null,    saida:null,    status:'presente' },
];

