// Relógio em tempo real
setInterval(() => {
    const agora = new Date().toLocaleTimeString('pt-BR');
    document.getElementById('relogio').innerText = agora;
}, 1000);

function fazerLogin() {
    const cpf = document.getElementById('cpf-login').value;
    if (cpf.length < 11) {
        alert("Digite um CPF válido para testar.");
        return;
    }
    document.getElementById('user-display').innerText = `Logado: ${cpf}`;
    document.getElementById('tela-login').style.display = 'none';
    document.getElementById('tela-ponto').style.display = 'block';
}

function registrar(etapa) {
    const nomes = ["", "Entrada", "Saída Almoço", "Volta Almoço", "Saída"];
    const hora = new Date().toLocaleTimeString('pt-BR');
    
    // Adiciona ao histórico
    const lista = document.getElementById('lista-ponto');
    lista.innerHTML += `<li><span>${nomes[etapa]}</span> <strong>${hora}</strong></li>`;
    
    // Trava atual e libera próxima
    document.getElementById(`btn-${etapa}`).disabled = true;
    
    if (etapa < 4) {
        const proxima = etapa + 1;
        document.getElementById(`btn-${proxima}`).disabled = false;
        document.getElementById('status-msg').innerText = `Próximo: ${nomes[proxima]}`;
    } else {
        document.getElementById('status-msg').innerText = "Expediente Finalizado!";
        document.getElementById('status-msg').style.color = "#10b981";
    }
}

function logout() {
    if(confirm("Deseja sair do sistema?")) location.reload();
}
