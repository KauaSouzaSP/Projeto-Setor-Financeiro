/* Acesso restrito (Planilha, WhatsApp e E-mail). Sessão só na memória: ao recarregar, pede login de novo. */
(() => {
const USER = 'kaua', PASS = '1234', RESTRITAS = ['planilha', 'whatsapp', 'email'];
const $ = id => document.getElementById(id);
let logado = false;

const original = Navegacao.mostrar.bind(Navegacao);
Navegacao.mostrar = (nome, atualizarHash) => original(!logado && RESTRITAS.includes(nome) ? 'acesso' : nome, atualizarHash);

function estado() {
    RESTRITAS.forEach(v => { document.querySelector(`.nav-btn[data-view="${v}"]`).hidden = !logado; });
    $('nav-acesso').hidden = logado;
    $('ac-sair').hidden = !logado;
}

$('form-acesso').addEventListener('submit', e => {
    e.preventDefault();
    const msg = $('ac-msg');
    if ($('ac-user').value.trim().toLowerCase() === USER && $('ac-pass').value === PASS) {
        logado = true; msg.hidden = true;
        $('ac-user').value = ''; $('ac-pass').value = '';
        estado();
        Navegacao.mostrar('planilha');
    } else {
        msg.textContent = 'Login ou senha incorretos.'; msg.hidden = false;
        $('ac-pass').value = '';
    }
});

/* Sair recarrega a página para apagar da memória qualquer dado importado. */
$('ac-sair').addEventListener('click', () => { history.replaceState(null, '', location.pathname); location.reload(); });
estado();
})();
