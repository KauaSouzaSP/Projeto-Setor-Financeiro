/* Planilha do dia + mensagens de cobrança. Nada é salvo: tudo vive só na memória da página. */
(() => {
const $ = id => document.getElementById(id);
const norm = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const brl = n => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const MS = 86400000, UTC0 = Date.UTC(1899, 11, 30);
const hoje = () => { const d = new Date(); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); };
const fdata = t => t == null ? '' : new Date(t).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
const aviso = m => typeof Toast !== 'undefined' ? Toast.mostrar(m) : alert(m);
const copiar = async t => { try { await navigator.clipboard.writeText(t); } catch (e) { const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); document.execCommand('copy'); a.remove(); } aviso('Copiado!'); };

/* ---------- leitura de valores ---------- */
function pData(v) {
    if (v === '' || v == null) return null;
    if (typeof v === 'number') return v > 20000 && v < 80000 ? Math.floor(v) * MS + UTC0 : null;
    const s = String(v).trim();
    let m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
    if (m) { let y = +m[3]; if (y < 100) y += 2000; return Date.UTC(y, +m[2] - 1, +m[1]); }
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null;
}
function pValor(v) {
    if (typeof v === 'number') return v;
    let s = String(v ?? '').replace(/[^\d,.\-]/g, '');
    if (!s) return null;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
}

/* ---------- reconhecimento das colunas (em qualquer ordem) ---------- */
const RE = { importacao: /import/, vencimento: /venc/, banco: /banco|bco|portador/, situacao: /situa|status/, razao: /razao|nome|social/, valor: /valor|vlr|saldo|montante/, titulo: /titulo|docu|duplic|boleto|nota|numero/, empresa: /empresa|codigo|cod|cliente/ };
const ROT = { empresa: 'Empresa', razao: 'Razão social', titulo: 'Título', vencimento: 'Vencimento', valor: 'Valor', importacao: 'Data da importação', banco: 'Banco', situacao: 'Situação do boleto' };
const PRIO = ['importacao', 'vencimento', 'banco', 'situacao', 'razao', 'valor', 'titulo', 'empresa'];
const S = { rows: [], h: -1, map: {}, itens: [], grp: [], vis: [], ord: { k: 'dias', d: -1 } };

function detectar(rows) {
    let h = -1, bs = 1, map = {};
    rows.slice(0, 20).forEach((r, i) => {
        const m = {};
        r.forEach((cel, c) => { const n = norm(cel); if (!n) return; for (const k of PRIO) if (m[k] == null && RE[k].test(n)) { m[k] = c; break; } });
        const s = Object.keys(m).length;
        if (s > bs) { bs = s; h = i; map = m; }
    });
    return { h, map };
}

/* Se faltar cabeçalho de algum campo, tenta deduzir pelo conteúdo da coluna. */
function completar() {
    const m = S.map, dados = S.rows.slice(S.h + 1, S.h + 31);
    const n = Math.max(0, ...S.rows.slice(0, 20).map(r => r.length));
    const livres = () => [...Array(n).keys()].filter(c => !Object.values(m).includes(c));
    const col = c => dados.map(r => r[c]).filter(v => v !== '' && v != null);
    const frac = (c, f) => { const v = col(c); return v.length ? v.filter(f).length / v.length : 0; };
    if (m.vencimento == null || m.importacao == null) {
        const uni = c => new Set(col(c).map(String)).size;
        const datas = livres().filter(c => frac(c, v => pData(v) != null) > .8).sort((a, b) => uni(a) - uni(b));
        if (m.vencimento == null && m.importacao == null && datas.length > 1) { m.importacao = datas[0]; m.vencimento = datas[1]; }
        else if (datas.length) m[m.vencimento == null ? 'vencimento' : 'importacao'] = datas[0];
    }
    if (m.valor == null) {
        const c = livres().find(c => frac(c, v => typeof v === 'number' || /^\s*(R\$)?\s*[\d.]+,\d{2}\s*$/.test(String(v))) > .8);
        if (c != null) m.valor = c;
    }
    if (m.razao == null) {
        const med = c => { const v = col(c).filter(x => typeof x === 'string'); return v.length ? v.reduce((s, x) => s + x.length, 0) / v.length : 0; };
        const c = livres().sort((a, b) => med(b) - med(a))[0];
        if (c != null && med(c) > 0) m.razao = c;
    }
}

function montar() {
    const { rows, h, map } = S, t = hoje();
    S.itens = [];
    rows.slice(h + 1).forEach(r => {
        const g = k => map[k] == null ? '' : r[map[k]];
        const razao = String(g('razao')).trim(), titulo = String(g('titulo')).trim(), empresa = String(g('empresa')).trim();
        if (!razao && !titulo) return;
        const banco = String(g('banco')).trim(), sit = String(g('situacao')).trim();
        const venc = pData(g('vencimento')), val = pValor(g('valor')) || 0;
        S.itens.push({ empresa, razao, titulo, banco, sit, venc, val, imp: pData(g('importacao')), dias: venc == null ? null : Math.round((t - venc) / MS),
            txt: [empresa, razao, titulo, banco, sit, fdata(venc), val.toFixed(2).replace('.', ',')].map(norm).join(' ') });
    });
}

function mapaUI() {
    const n = Math.max(...S.rows.slice(0, 20).map(r => r.length));
    const nome = c => (S.h >= 0 && String(S.rows[S.h][c] ?? '').trim()) || `Coluna ${c + 1}`;
    const opts = k => `<option value="">— não encontrada —</option>` + [...Array(n).keys()].map(c => `<option value="${c}"${S.map[k] === c ? ' selected' : ''}>${esc(nome(c))}</option>`).join('');
    $('pl-map').hidden = false;
    $('pl-map').innerHTML = ['empresa', 'razao', 'titulo', 'banco', 'situacao', 'vencimento', 'valor', 'importacao']
        .map(k => `<div><label>${ROT[k]}</label><select data-k="${k}">${opts(k)}</select></div>`).join('');
}

/* ---------- pesquisa e tabela ---------- */
function filtrar() {
    const q = $('pl-busca').value.split(/\s+/).map(norm).filter(Boolean), mn = pValor($('pl-min').value) || 0;
    const F = { av: [-1e9, 0], '1-5': [1, 5], '6-30': [6, 30], '31-60': [31, 60], '61-90': [61, 90], '91+': [91, 1e9] }[$('pl-faixa').value];
    return S.itens.filter(i => (!q.length || q.every(t => i.txt.includes(t))) && (!F || (i.dias != null && i.dias >= F[0] && i.dias <= F[1])) && i.val >= mn);
}

function desenhar() {
    const v = filtrar(), { k, d } = S.ord;
    v.sort((a, b) => { const x = a[k] ?? -1e18, y = b[k] ?? -1e18; return (typeof x === 'string' ? x.localeCompare(y, 'pt-BR', { numeric: true }) : x - y) * d; });
    S.vis = v;
    if ($('pl-grp').checked) {
        const mp = new Map();
        v.forEach(i => { const c = i.razao || i.empresa; mp.has(c) || mp.set(c, []); mp.get(c).push(i); });
        S.grp = [...mp.values()];
    } else S.grp = v.map(i => [i]);
    const tot = v.reduce((s, i) => s + i.val, 0), atr = v.filter(i => i.dias > 0).length;
    $('pl-tot').innerHTML = [['TÍTULOS', v.length], ['CLIENTES', new Set(v.map(i => i.razao)).size], ['EM ATRASO', atr], ['VALOR TOTAL', brl(tot)]].map(([a, b]) => `<div>${a}<strong>${b}</strong></div>`).join('');
    const th = (c, t) => `<th data-ord="${c}">${t}${k === c ? (d > 0 ? ' ▲' : ' ▼') : ''}</th>`;
    const bt = g => `<div class="pl-ac"><button type="button" class="btn-mini" data-cob="wa" data-g="${g}">WhatsApp</button><button type="button" class="btn-mini" data-cob="em" data-g="${g}">E-mail</button></div>`;
    const tr = (i, b) => `<tr><td>${esc(i.empresa)}</td><td>${esc(i.razao)}</td><td>${esc(i.titulo)}</td><td>${esc(i.banco)}</td><td>${esc(i.sit)}</td><td>${fdata(i.venc)}</td><td class="pl-r">${brl(i.val)}</td><td>${fdata(i.imp)}</td><td class="${i.dias > 0 ? 'pl-atr' : ''}">${i.dias == null ? '' : i.dias > 0 ? i.dias + ' d' : 'a vencer'}</td><td>${b}</td></tr>`;
    let corpo = '';
    if ($('pl-grp').checked) S.grp.forEach((g, n) => {
        const soma = g.reduce((s, i) => s + i.val, 0), mx = Math.max(...g.map(i => i.dias ?? -1e9));
        corpo += `<tr class="pl-gh"><td colspan="9"><strong>${esc(g[0].razao || g[0].empresa)}</strong> · ${g.length} título(s) · ${brl(soma)}${mx > 0 ? ` · maior atraso ${mx} d` : ''}</td><td>${bt(n)}</td></tr>` + g.map(i => tr(i, '')).join('');
    });
    else corpo = S.grp.map((g, n) => tr(g[0], bt(n))).join('');
    $('pl-tab').innerHTML = `<table><thead><tr>${th('empresa', 'Empresa')}${th('razao', 'Razão Social')}${th('titulo', 'Título')}${th('banco', 'Banco')}${th('sit', 'Situação')}${th('venc', 'Vencimento')}${th('val', 'Valor')}${th('imp', 'Importação')}${th('dias', 'Atraso')}<th></th></tr></thead><tbody>${corpo || '<tr><td colspan="10">Nenhum resultado.</td></tr>'}</tbody></table>`;
}

function ler(file) {
    const m = $('pl-msg'), erro = t => { m.textContent = t; m.hidden = false; };
    if (typeof XLSX === 'undefined') return erro('Biblioteca de leitura indisponível (sem internet). Conecte-se e recarregue a página.');
    const fr = new FileReader();
    fr.onload = e => {
        try {
            const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
            S.rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' }).filter(r => r.some(c => String(c).trim() !== ''));
            const d = detectar(S.rows); S.h = d.h; S.map = d.map;
            completar(); mapaUI(); montar(); desenhar();
            $('pl-lista').hidden = false;
            const falta = Object.keys(ROT).filter(k => S.map[k] == null).map(k => ROT[k]);
            m.textContent = `${S.itens.length} título(s) lidos de "${file.name}". Os dados ficam só nesta página.` + (falta.length ? ` Não localizei: ${falta.join(', ')}. Ajuste abaixo, se necessário.` : '');
            m.hidden = false;
        } catch (x) { erro('Não foi possível ler o arquivo. Use .xlsx, .xls ou .csv.'); }
    };
    fr.readAsArrayBuffer(file);
}

$('pl-arquivo').addEventListener('change', e => e.target.files[0] && ler(e.target.files[0]));
$('pl-map').addEventListener('change', e => { const k = e.target.dataset.k; if (!k) return; e.target.value === '' ? delete S.map[k] : S.map[k] = +e.target.value; montar(); desenhar(); });
['pl-busca', 'pl-min'].forEach(id => $(id).addEventListener('input', desenhar));
['pl-faixa', 'pl-grp'].forEach(id => $(id).addEventListener('change', desenhar));
$('pl-xls').addEventListener('click', () => {
    if (typeof XLSX === 'undefined' || !S.vis.length) return aviso('Nada para exportar.');
    const ws = XLSX.utils.json_to_sheet(S.vis.map(i => ({ Empresa: i.empresa, 'Razão Social': i.razao, 'Título': i.titulo, Banco: i.banco, 'Situação do boleto': i.sit, Vencimento: fdata(i.venc), Valor: i.val, 'Data da importação': fdata(i.imp), 'Dias de atraso': i.dias })));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Resultado'); XLSX.writeFile(wb, 'resultado-pesquisa.xlsx');
});
$('pl-lista').addEventListener('click', e => {
    const h = e.target.closest('[data-ord]');
    if (h) { const k = h.dataset.ord; S.ord = S.ord.k === k ? { k, d: -S.ord.d } : { k, d: 1 }; return desenhar(); }
    const b = e.target.closest('[data-cob]'); if (!b) return;
    const g = S.grp[+b.dataset.g], p = b.dataset.cob, vs = g.map(i => i.venc).filter(x => x != null);
    $(p + '-nome').value = g[0].razao; $(p + '-nome').dataset.qtd = g.length;
    $(p + '-titulo').value = g.map(i => i.titulo).filter(Boolean).join(', ');
    $(p + '-venc').value = vs.length ? new Date(Math.min(...vs)).toISOString().slice(0, 10) : '';
    $(p + '-valor').value = g.reduce((s, i) => s + i.val, 0).toFixed(2).replace('.', ',');
    p === 'wa' ? waGerar() : emRefresh(true);
    document.querySelector(`.nav-btn[data-view="${p === 'wa' ? 'whatsapp' : 'email'}"]`).click();
});

/* ---------- mensagens ---------- */
const saud = () => { const h = new Date().getHours(); return h < 12 ? 'bom dia' : h < 18 ? 'boa tarde' : 'boa noite'; };
const cap = s => s[0].toUpperCase() + s.slice(1);
const AB = [(n, s) => `Prezado(a)${n}, ${s}.`, (n, s) => `Olá${n}, ${s}!`, (n, s) => `${cap(s)}${n}! Tudo bem?`, (n, s) => `Prezado(a)${n}, ${s}. Esperamos que esteja bem.`];
const CO = [(t, c, x) => `Informamos que ${c} ${t} em atraso no seu cadastro${x}.`, (t, c, x) => `Identificamos ${t} em atraso no seu cadastro${x}.`, (t, c, x) => `Estamos entrando em contato porque ${c} ${t} em atraso em seu nome${x}.`, (t, c, x) => `Passando para avisar que ${c} ${t} em atraso no seu cadastro${x}.`];
const SV = ['Caso precise da segunda via do boleto, basta solicitar.', 'Se precisar da segunda via do boleto, é só nos pedir.', 'Para receber a segunda via do boleto, basta nos solicitar por aqui.', 'Precisando da segunda via do boleto, é só avisar.'];
const CA1 = ['Ressaltamos que o banco costuma enviar o título a cartório com 5 dias corridos de atraso.', 'Lembramos que, após 5 dias corridos de atraso, o banco costuma encaminhar o título a cartório.', 'Vale lembrar que o banco costuma enviar o título para cartório com 5 dias corridos.'];
const CA2 = ['Como o vencimento já passou de 5 dias corridos, o título pode já ter sido encaminhado a cartório. Entre em contato para regularizarmos.', 'Lembramos que o banco costuma enviar o título a cartório após 5 dias corridos, e esse prazo já foi ultrapassado. Fale conosco para regularizar.'];
const FE = ['Ficamos à disposição.', 'Qualquer dúvida, estamos à disposição.', 'Aguardamos seu retorno.', 'Obrigado pela atenção.'];

function dados(p) {
    const g = s => $(p + '-' + s), venc = pData(g('venc').value);
    return { nome: g('nome').value.trim(), titulo: g('titulo').value.trim(), venc, valor: pValor(g('valor').value), qtd: +g('nome').dataset.qtd || 1, dias: venc == null ? null : Math.round((hoje() - venc) / MS) };
}
function texto(d, fixo) {
    const r = a => fixo ? a[0] : a[Math.floor(Math.random() * a.length)];
    const n = d.nome ? ' ' + d.nome : '', s = saud(), t = d.qtd > 1 ? `${d.qtd} títulos` : 'um título', c = d.qtd > 1 ? 'constam' : 'consta';
    const det = [d.titulo, d.venc != null && 'vencimento ' + fdata(d.venc), d.valor != null && brl(d.valor)].filter(Boolean).join(', ');
    return [r(AB)(n, s), r(CO)(t, c, det ? ` (${det})` : '') + ' ' + r(SV), r(d.dias != null && d.dias > 5 ? CA2 : CA1), r(FE)].join('\n\n');
}
const campo = (p, id, l, ph, tp = 'text') => `<div class="field"><label for="${p}-${id}">${l}</label><input type="${tp}" id="${p}-${id}" placeholder="${ph}" autocomplete="off"></div>`;
const base = p => campo(p, 'nome', 'Nome do cliente', 'Razão social ou contato') + campo(p, 'titulo', 'Título (opcional)', 'Ex.: NF 4587-1') + campo(p, 'venc', 'Vencimento (opcional)', '', 'date') + campo(p, 'valor', 'Valor (opcional)', '0,00');
const topo = (n, cor, h, t) => `<div class="title"><div class="number ${cor}">${n}</div><div><h2>${h}</h2><p>${t}</p></div></div>`;

$('wa-root').innerHTML = topo('01', 'green', 'Mensagens para WhatsApp', 'Gera variações diferentes do mesmo aviso. Envie uma conversa por vez, do seu próprio número.') +
    `<div class="fields fields-3">${campo('wa', 'fone', 'WhatsApp com DDD', '11 99999-9999')}${base('wa')}</div>` +
    `<button type="button" class="primary" id="wa-gerar"><span>GERAR NOVAS VARIAÇÕES</span><strong>↻</strong></button><div id="wa-saida"></div>`;
let WA = [];
function waGerar() {
    const d = dados('wa'), set = new Set();
    for (let k = 0; k < 40 && set.size < 3; k++) set.add(texto(d));
    WA = [...set];
    $('wa-saida').innerHTML = WA.map((t, i) => `<div class="pl-msg"><pre>${esc(t)}</pre><div class="pl-acoes"><button type="button" class="btn-mini" data-cp="${i}">Copiar</button><button type="button" class="btn-mini" data-wa="${i}">Abrir no WhatsApp</button></div></div>`).join('');
}
$('wa-gerar').addEventListener('click', waGerar);
['nome', 'titulo'].forEach(s => $('wa-' + s).addEventListener('input', () => delete $('wa-nome').dataset.qtd));
['nome', 'titulo', 'venc', 'valor'].forEach(s => $('wa-' + s).addEventListener('change', waGerar));
$('wa-saida').addEventListener('click', e => {
    const c = e.target.closest('[data-cp]'), w = e.target.closest('[data-wa]');
    if (c) copiar(WA[+c.dataset.cp]);
    if (w) { let f = $('wa-fone').value.replace(/\D/g, ''); if (f.length === 10 || f.length === 11) f = '55' + f; window.open(`https://wa.me/${f}?text=${encodeURIComponent(WA[+w.dataset.wa])}`, '_blank', 'noopener'); }
});
waGerar();

$('em-root').innerHTML = topo('01', 'orange', 'Mensagem para e-mail', 'Mesmo aviso, com a saudação (bom dia, boa tarde ou boa noite) atualizada pelo horário.') +
    `<div class="fields fields-3">${campo('em', 'para', 'Destinatário', 'cliente@empresa.com.br', 'email')}${base('em')}${campo('em', 'assunto', 'Assunto', 'Título em atraso')}</div>` +
    `<div class="field"><label for="em-texto">Texto</label><textarea id="em-texto"></textarea><small>A saudação se atualiza sozinha enquanto você não editar o texto.</small></div>` +
    `<div class="pl-acoes"><button type="button" class="btn-mini" id="em-copiar">Copiar texto</button><button type="button" class="btn-mini" id="em-abrir">Abrir no e-mail</button><button type="button" class="btn-mini" id="em-rest">Restaurar texto</button></div>`;
$('em-assunto').value = 'Título em atraso';
let editado = false;
function emRefresh(f) { if (f) editado = false; if (!editado) $('em-texto').value = texto(dados('em'), true); }
$('em-texto').addEventListener('input', () => editado = true);
['nome', 'titulo'].forEach(s => $('em-' + s).addEventListener('input', () => delete $('em-nome').dataset.qtd));
['nome', 'titulo', 'venc', 'valor'].forEach(s => $('em-' + s).addEventListener('change', () => emRefresh(true)));
$('em-rest').addEventListener('click', () => emRefresh(true));
$('em-copiar').addEventListener('click', () => { emRefresh(); copiar($('em-texto').value); });
$('em-abrir').addEventListener('click', () => { emRefresh(); location.href = `mailto:${encodeURIComponent($('em-para').value.trim())}?subject=${encodeURIComponent($('em-assunto').value)}&body=${encodeURIComponent($('em-texto').value)}`; });
setInterval(() => emRefresh(), 30000);
emRefresh(true);
})();
