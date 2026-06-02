/* ============================================================
   FORMULÁRIO — REGISTRAR
   ============================================================ */

function iniciarFormRegistro() {
  const form = document.getElementById('form-registro');
  if (!form) return;

  const inputCPF = document.getElementById('input-cpf');
  const inputTel = document.getElementById('input-tel');

  if (inputCPF) {
    inputCPF.addEventListener('input', e => {
      let v = e.target.value.replace(/\D/g,'');
      if (v.length>11) v=v.slice(0,11);
      v=v.replace(/(\d{3})(\d)/,'$1.$2');
      v=v.replace(/(\d{3})\.(\d{3})(\d)/,'$1.$2.$3');
      v=v.replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/,'$1.$2.$3-$4');
      e.target.value=v;
    });
  }

  if (inputTel) {
    inputTel.addEventListener('input', e => {
      let v = e.target.value.replace(/\D/g,'');
      if (v.length>11) v=v.slice(0,11);
      v=v.replace(/(\d{2})(\d)/,'($1) $2');
      v=v.replace(/(\d{5})(\d)/,'$1-$2');
      e.target.value=v;
    });
  }

  // Preview em tempo real
  function atualizarPreview() {
    const nome  = (document.getElementById('input-nome')?.value||'').trim();
    const email = (document.getElementById('input-email')?.value||'').trim();
    const cpf   = (document.getElementById('input-cpf')?.value||'').trim();
    const cargo = document.getElementById('input-cargo')?.value||'';
    const tel   = (document.getElementById('input-tel')?.value||'').trim();

    const av = document.getElementById('preview-avatar');
    if (av) av.textContent = nome ? getIniciais(nome) : 'FN';
    const pn = document.getElementById('preview-nome');
    if (pn) pn.textContent = nome || 'Nome do Funcionário';
    const pc = document.getElementById('preview-cargo');
    if (pc) pc.textContent = cargo || 'Cargo';
    const pe = document.getElementById('preview-email');
    if (pe) pe.textContent = email || '—';
    const pp = document.getElementById('preview-cpf');
    if (pp) pp.textContent = cpf || '—';
    const pt = document.getElementById('preview-tel');
    if (pt) pt.textContent = tel || '—';
  }

  ['input-nome','input-email','input-cpf','input-cargo','input-tel'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.addEventListener('input', atualizarPreview); el.addEventListener('change', atualizarPreview); }
  });
  form.addEventListener('submit', async e => {
    e.preventDefault();
  
    const nome  = document.getElementById('input-nome')?.value.trim();
    const email = document.getElementById('input-email')?.value.trim();
    const cpfFormatado = document.getElementById('input-cpf')?.value.trim();
    const cargo = document.getElementById('input-cargo')?.value;
    const tel   = document.getElementById('input-tel')?.value.trim();
  
    const cpf = String(cpfFormatado || '').replace(/\D/g, '');
  
    if (!nome || !email || !cpf || !cargo) {
      toast('Preencha todos os campos obrigatórios.', 'error');
      return;
    }
  
    if (cpf.length !== 11) {
      toast('CPF inválido.', 'error');
      return;
    }
  
    const btn = document.getElementById('btn-registrar');
    btn.classList.add('loading');
  
    try {
      const response = await fetch('/api/admin/funcionarios', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          nome,
          email,
          cpf,
          cargo,
          tel: tel || null,
          senha: cpf,
          ativo: true
        })
      });
  
      const payload = await response.json();
  
      if (!response.ok) {
        throw new Error(payload?.error?.message || payload?.message || 'Erro ao cadastrar funcionário');
      }
  
      toast(`Funcionário "${nome}" cadastrado com sucesso!`, 'success');
      form.reset();
      atualizarPreview();
  
    } catch (error) {
      console.error(error);
      toast(error.message || 'Erro ao cadastrar funcionário.', 'error');
    } finally {
      btn.classList.remove('loading');
    }
  });
}

