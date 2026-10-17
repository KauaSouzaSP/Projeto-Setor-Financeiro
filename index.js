/* =====================================================
   INICIALIZAÇÃO
===================================================== */

document.addEventListener("DOMContentLoaded", () => {

    Tema.iniciar();
    Navegacao.iniciar();
    Relogio.iniciar();
    CalculadoraSimples.iniciar();
    CustasUI.iniciar();
    ConsultaCNPJ.iniciar();

});


/* =====================================================
   UTILITÁRIOS
===================================================== */

function get(id) {
    return document.getElementById(id);
}

function escaparHTML(texto) {
    const div = document.createElement("div");
    div.textContent = String(texto ?? "");
    return div.innerHTML;
}

function criarData(valor) {
    const [ano, mes, dia] = valor.split("-");
    return new Date(Number(ano), Number(mes) - 1, Number(dia));
}

function dataParaInput(data) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const dia = String(data.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
}

function formatarData(data) {
    return data.toLocaleDateString("pt-BR");
}

function adicionarDias(data, quantidade) {
    const resultado = new Date(data);
    resultado.setDate(resultado.getDate() + quantidade);
    return resultado;
}

function adicionarDiasUteis(data, quantidade) {
    const resultado = new Date(data);
    let contador = 0;

    while (contador < quantidade) {
        resultado.setDate(resultado.getDate() + 1);
        const dia = resultado.getDay();
        if (dia !== 0 && dia !== 6) contador++;
    }

    return resultado;
}

function diferencaDias(inicio, fim) {
    const primeiro = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
    const segundo = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate());
    return Math.round((segundo - primeiro) / 86400000);
}

/* Todos os valores internos ficam em CENTAVOS (inteiros),
   evitando erros de ponto flutuante (ex.: 0.1 + 0.2). */
function formatarMoeda(centavos) {
    return (centavos / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

function formatarPercentual(numero) {
    return numero.toLocaleString("pt-BR", { maximumFractionDigits: 4 }) + "%";
}

/* Aceita "1.234,56", "1234,56" e "1234.56". Retorna NaN se inválido. */
function lerNumero(texto) {
    let valor = String(texto ?? "").trim().replace(/\s/g, "").replace(/^R\$/i, "");

    if (valor === "") return NaN;

    if (valor.includes(",")) {
        valor = valor.replace(/\./g, "").replace(",", ".");
    }

    return /^-?\d+(\.\d+)?$/.test(valor) ? Number(valor) : NaN;
}

/* Remove o espaço "inquebrável" que o navegador coloca em "R$ 1.000,00".
   Necessário para o PDF, cuja fonte padrão não tem todos os caracteres. */
function textoSimples(texto) {
    return String(texto).replace(/[  ]/g, " ");
}

function baixarArquivo(blob, nome) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = nome;
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* Rótulos usados na tela e nos relatórios. */
const Rotulos = {

    encargo(tipo) {
        return tipo === "Custas" ? "Custas" : "Protesto";
    },

    taxa(titulo) {
        const base = formatarPercentual(titulo.percentual) +
            (titulo.periodo === "dia" ? " ao dia" : " ao mês");

        return titulo.multaPercentual > 0
            ? `${formatarPercentual(titulo.multaPercentual)} multa + ${base}`
            : base;
    },

    tituloRelatorio(tipo) {
        return tipo === "Custas" ? "Relatório de Custas" : "Relatório de Protestos";
    }

};


/* =====================================================
   NAVEGAÇÃO ENTRE VISÕES
===================================================== */

const Navegacao = {

    iniciar() {
        document.querySelectorAll(".nav-btn").forEach(botao => {
            botao.addEventListener("click", () => this.mostrar(botao.dataset.view));
        });

        const inicial = location.hash.replace("#", "");
        this.mostrar(get(`view-${inicial}`) ? inicial : "calculadora", false);
    },

    mostrar(nome, atualizarHash = true) {
        document.querySelectorAll(".view").forEach(v =>
            v.classList.toggle("active", v.id === `view-${nome}`)
        );

        document.querySelectorAll(".nav-btn").forEach(b =>
            b.classList.toggle("active", b.dataset.view === nome)
        );

        if (atualizarHash) history.replaceState(null, "", `#${nome}`);

        window.scrollTo({ top: 0, behavior: "smooth" });
    }

};


/* =====================================================
   RELÓGIO
===================================================== */

const Relogio = {

    iniciar() {
        this.atualizar();
        setInterval(() => this.atualizar(), 1000);
    },

    atualizar() {
        const agora = new Date();

        get("data-atual").textContent = agora.toLocaleDateString("pt-BR", {
            weekday: "long",
            day: "2-digit",
            month: "long",
            year: "numeric"
        });

        get("hora-atual").textContent = agora.toLocaleTimeString("pt-BR");

        const hora = agora.getHours();
        let mensagem;

        if (hora >= 5 && hora < 12) {
            mensagem = "Bom dia! Organização hoje evita problemas amanhã.";
        } else if (hora >= 12 && hora < 18) {
            mensagem = "Boa tarde! Continue avançando, um passo de cada vez.";
        } else if (hora >= 18 && hora < 23) {
            mensagem = "Boa noite! Cada tarefa concluída é uma preocupação a menos.";
        } else {
            mensagem = "Até pequenos avanços fazem diferença.";
        }

        get("mensagem").textContent = mensagem;
    }

};


/* =====================================================
   CALCULADORA SIMPLES (funcionalidade original)
===================================================== */

const CalculadoraSimples = {

    iniciar() {
        get("consulta").value = dataParaInput(new Date());

        get("form-calculadora").addEventListener("submit", evento => {
            evento.preventDefault();
            this.calcular();
        });
    },

    /*
        REGRA DA CALCULADORA

        DIA 0 ........... Vencimento
        +5 dias corridos  Entrada no cartório
        +15 dias corridos Carta (após a entrada)
        +3 dias úteis .... Protesto estimado (após a carta)
    */
    calcular() {
        const valorVencimento = get("vencimento").value;
        const valorConsulta = get("consulta").value;

        if (!valorVencimento || !valorConsulta) {
            alert("Informe as datas.");
            return;
        }

        const vencimento = criarData(valorVencimento);
        const consulta = criarData(valorConsulta);
        const dias = diferencaDias(vencimento, consulta);

        const cartorio = adicionarDias(vencimento, 5);
        const carta = adicionarDias(cartorio, 15);
        const protesto = adicionarDiasUteis(carta, 3);

        let situacao, classe, proxima;

        if (dias < 0) {
            situacao = "A VENCER";
            classe = "vencer";
            proxima = `Faltam ${Math.abs(dias)} dia(s) para o vencimento.`;
        } else if (consulta < cartorio) {
            situacao = "VENCIDO";
            classe = "vencido";
            proxima = `Entrada estimada no cartório em ${diferencaDias(consulta, cartorio)} dia(s).`;
        } else if (consulta < carta) {
            situacao = "EM CARTÓRIO";
            classe = "cartorio";
            proxima = "O título está no período estimado de tramitação.";
        } else if (consulta < protesto) {
            situacao = "PRAZO APÓS CARTA";
            classe = "cartorio";
            proxima = "O prazo útil para pagamento ainda está em andamento.";
        } else {
            situacao = "PROTESTO ESTIMADO";
            classe = "protestado";
            proxima = "A data estimada de protesto foi atingida.";
        }

        const status = get("status");
        status.className = `status ${classe}`;
        status.textContent = situacao;

        get("situacao").textContent = situacao;

        get("dias").textContent = dias < 0
            ? `${Math.abs(dias)} dia(s) para vencer`
            : `${dias} dia(s) vencido`;

        get("r-vencimento").textContent = formatarData(vencimento);
        get("r-cartorio").textContent = formatarData(cartorio);
        get("r-carta").textContent = formatarData(carta);
        get("r-protesto").textContent = formatarData(protesto);
        get("proxima").textContent = proxima;

        const resultado = get("resultado");
        resultado.hidden = false;
        resultado.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

};


/* =====================================================
   CUSTAS E PROTESTOS — MODELO (regras de negócio)

   Nenhuma função desta seção mexe no DOM: só dados
   e cálculos. Isso facilita testar e reutilizar.
===================================================== */

const Custas = {

    /* A porcentagem é tirada do VALOR DO TÍTULO. O valor resultante
       é então aplicado a cada dia ou a cada mês de atraso:

         por dia: valor × (% ÷ 100) × dias vencidos
         por mês: valor × (% ÷ 100) × (dias vencidos ÷ 30)

       No modo mensal, o mês é de 30 dias e a conta é proporcional aos dias.
       Se o pagamento for anterior ao vencimento, dias = 0 e o valor = 0. */
    calcularEncargos({ valorCentavos, vencimento, pagamento, percentual, periodo, multa = 0 }) {
        const diasBrutos = diferencaDias(criarData(vencimento), criarData(pagamento));
        const dias = Math.max(0, diasBrutos);

        /* Multa fixa: aplicada UMA única vez, somente quando há atraso. */
        const multaCentavos = dias > 0 && multa > 0
            ? Math.round(valorCentavos * (multa / 100))
            : 0;

        /* Porcentagem diária (ou mensal, se escolhida): multiplicada pelo período de atraso. */
        const valorDaPorcentagem = valorCentavos * (percentual / 100);
        const periodos = periodo === "dia" ? dias : dias / 30;
        const jurosDiariosCentavos = Math.round(valorDaPorcentagem * periodos);

        const jurosCentavos = multaCentavos + jurosDiariosCentavos;

        return {
            dias,
            multaCentavos,
            jurosDiariosCentavos,
            jurosCentavos,
            totalCentavos: valorCentavos + jurosCentavos
        };
    },

    /* A chave de agrupamento é o Código do Cliente, ignorando
       espaços e diferença entre maiúsculas/minúsculas. */
    chaveCliente(codigo) {
        return String(codigo).trim().toUpperCase();
    },

    /* Transforma a lista plana de títulos em uma lista de grupos:
       [{ chave, codigo, razaoSocial, titulos[], subtotais... }]
       A ordem dos clientes segue a ordem em que apareceram pela primeira vez. */
    agruparPorCliente(titulos) {
        const mapa = new Map();

        titulos.forEach(titulo => {
            const chave = this.chaveCliente(titulo.codigo);

            if (!mapa.has(chave)) {
                mapa.set(chave, {
                    chave,
                    codigo: titulo.codigo,
                    razaoSocial: titulo.razaoSocial,
                    titulos: [],
                    subtotalOriginal: 0,
                    subtotalJuros: 0,
                    subtotalAtualizado: 0
                });
            }

            const grupo = mapa.get(chave);
            grupo.titulos.push(titulo);
            grupo.subtotalOriginal += titulo.valorCentavos;
            grupo.subtotalJuros += titulo.jurosCentavos;
            grupo.subtotalAtualizado += titulo.totalCentavos;
        });

        return Array.from(mapa.values());
    },

    totalGeral(grupos) {
        return grupos.reduce((total, grupo) => ({
            titulos: total.titulos + grupo.titulos.length,
            original: total.original + grupo.subtotalOriginal,
            juros: total.juros + grupo.subtotalJuros,
            atualizado: total.atualizado + grupo.subtotalAtualizado
        }), { titulos: 0, original: 0, juros: 0, atualizado: 0 });
    }

};


/* =====================================================
   CUSTAS E PROTESTOS — ARMAZENAMENTO (array de títulos)
===================================================== */

const Armazenamento = {

    CHAVE: "calculadora-titulos:lista:v2",
    CHAVE_RESPONSAVEL: "calculadora-titulos:responsavel",

    titulos: [],

    carregar() {
        try {
            const salvo = JSON.parse(localStorage.getItem(this.CHAVE));

            if (Array.isArray(salvo)) {
                const validos = salvo.filter(t => t && t.tipo && t.periodo);
                const tipo = validos.length ? validos[0].tipo : null;

                /* Garante que a lista tenha um único tipo. */
                this.titulos = validos.filter(t => t.tipo === tipo);
            }
        } catch (erro) {
            this.titulos = [];
        }
    },

    salvar() {
        try {
            localStorage.setItem(this.CHAVE, JSON.stringify(this.titulos));
        } catch (erro) {
            /* Armazenamento indisponível: a lista continua funcionando em memória. */
        }
    },

    lerResponsavel() {
        try {
            return localStorage.getItem(this.CHAVE_RESPONSAVEL) || "";
        } catch (erro) {
            return "";
        }
    },

    salvarResponsavel(nome) {
        try {
            localStorage.setItem(this.CHAVE_RESPONSAVEL, nome);
        } catch (erro) {
            /* Sem armazenamento: o nome vale apenas nesta sessão. */
        }
    },

    /* "Custas", "Protesto" ou null quando a lista está vazia.
       A lista só pode ter UM tipo: o do primeiro título adicionado. */
    tipoLista() {
        return this.titulos.length ? this.titulos[0].tipo : null;
    },

    adicionar(titulo) {
        this.titulos.push(titulo);
        this.salvar();
    },

    remover(id) {
        this.titulos = this.titulos.filter(t => t.id !== id);
        this.salvar();
    },

    removerCliente(chave) {
        this.titulos = this.titulos.filter(t => Custas.chaveCliente(t.codigo) !== chave);
        this.salvar();
    },

    limpar() {
        this.titulos = [];
        this.salvar();
    },

    existe(codigo, numero) {
        const chave = Custas.chaveCliente(codigo);
        const num = numero.trim().toUpperCase();

        return this.titulos.some(t =>
            Custas.chaveCliente(t.codigo) === chave &&
            t.numero.trim().toUpperCase() === num
        );
    },

    razaoDoCliente(codigo) {
        const chave = Custas.chaveCliente(codigo);
        const achado = this.titulos.find(t => Custas.chaveCliente(t.codigo) === chave);
        return achado ? achado.razaoSocial : "";
    }

};


/* =====================================================
   CUSTAS E PROTESTOS — INTERFACE
===================================================== */

const CustasUI = {

    iniciar() {
        Armazenamento.carregar();

        get("responsavel").value = Armazenamento.lerResponsavel();
        get("t-pagamento").value = dataParaInput(new Date());

        get("responsavel").addEventListener("input", () => {
            get("responsavel").classList.remove("invalid");
            Armazenamento.salvarResponsavel(get("responsavel").value.trim());
        });

        get("form-titulo").addEventListener("submit", evento => {
            evento.preventDefault();
            this.adicionarTitulo();
        });

        /* Ao digitar um código já existente, preenche a razão social. */
        get("t-codigo").addEventListener("input", () => {
            const razao = Armazenamento.razaoDoCliente(get("t-codigo").value);
            if (razao) get("t-razao").value = razao;
        });

        document.querySelectorAll('input[name="tipo"]').forEach(radio => {
            radio.addEventListener("change", () => this.atualizarRotulos());
        });

        get("t-periodo").addEventListener("change", () => this.atualizarRotulos());

        get("btn-limpar").addEventListener("click", () => {
            if (Armazenamento.titulos.length === 0) return;

            if (confirm("Remover todos os títulos da lista?")) {
                Armazenamento.limpar();
                this.renderizar();
            }
        });

        get("btn-imprimir").addEventListener("click", () => Relatorio.imprimir());
        get("btn-pdf").addEventListener("click", () => Relatorio.exportarPDF());
        get("btn-excel").addEventListener("click", () => Relatorio.exportarExcel());

        /* Remoções via delegação de eventos (a tabela é recriada a cada render). */
        get("clientes-container").addEventListener("click", evento => {
            const botaoTitulo = evento.target.closest("[data-remover-titulo]");
            const botaoCliente = evento.target.closest("[data-remover-cliente]");
            const botaoTeams = evento.target.closest("[data-teams-cliente]");

            if (botaoTeams) {
                Teams.copiarCliente(botaoTeams.dataset.teamsCliente);
            }

            if (botaoTitulo) {
                Armazenamento.remover(botaoTitulo.dataset.removerTitulo);
                this.renderizar();
            }

            if (botaoCliente && confirm("Remover todos os títulos deste cliente?")) {
                Armazenamento.removerCliente(botaoCliente.dataset.removerCliente);
                this.renderizar();
            }
        });

        this.renderizar();
    },

    /* Tipo marcado no formulário. */
    tipoSelecionado() {
        return document.querySelector('input[name="tipo"]:checked').value;
    },

    /* Tipo em uso: o da lista (se já houver títulos) ou o marcado no formulário. */
    tipoAtual() {
        return Armazenamento.tipoLista() || this.tipoSelecionado();
    },

    /* Custas e Protesto não se misturam: com a lista iniciada,
       só o tipo dela continua disponível. */
    atualizarTipo() {
        const lista = Armazenamento.tipoLista();
        const aviso = get("tipo-aviso");

        document.querySelectorAll('input[name="tipo"]').forEach(radio => {
            if (lista) {
                radio.checked = radio.value === lista;
                radio.disabled = radio.value !== lista;
            } else {
                radio.disabled = false;
            }
        });

        aviso.hidden = !lista;

        if (lista) {
            const outro = lista === "Custas" ? "Protesto" : "Custas";
            aviso.textContent =
                `Esta lista é de ${lista}. Custas e Protesto não podem ser somados na mesma lista: ` +
                `para calcular ${outro}, limpe a lista antes.`;
        }
    },

    atualizarRotulos() {
        const tipo = this.tipoAtual();

        get("lbl-juros").textContent = Rotulos.encargo(tipo).toUpperCase();

        /* A caixa "mostrar porcentagem" existe apenas para Protesto (sigiloso). */
        get("opcao-pct").hidden = tipo !== "Protesto";

        get("formula-txt").textContent = "multa: valor × (multa % ÷ 100) + " + (get("t-periodo").value === "dia"
            ? "valor × (% ÷ 100) × dias vencidos"
            : "valor × (% ÷ 100) × (dias vencidos ÷ 30)");
    },

    mensagem(texto, tipo = "erro") {
        const caixa = get("form-msg");
        caixa.textContent = texto;
        caixa.className = `form-msg ${tipo}`;
        caixa.hidden = !texto;
    },

    mensagemExport(texto, tipo = "erro") {
        const caixa = get("export-msg");
        caixa.textContent = texto;
        caixa.className = `form-msg ${tipo}`;
        caixa.hidden = !texto;
    },

    marcarInvalidos(ids) {
        ["t-codigo", "t-razao", "t-numero", "t-valor", "t-multa", "t-percentual", "t-vencimento", "t-pagamento"]
            .forEach(id => get(id).classList.toggle("invalid", ids.includes(id)));
    },

    adicionarTitulo() {
        const codigo = get("t-codigo").value.trim();
        const razao = get("t-razao").value.trim();
        const numero = get("t-numero").value.trim();
        const valor = lerNumero(get("t-valor").value);
        const percentual = lerNumero(get("t-percentual").value);
        const multaTexto = get("t-multa").value.trim();
        const multa = multaTexto === "" ? 0 : lerNumero(multaTexto);
        const periodo = get("t-periodo").value === "dia" ? "dia" : "mes";
        const vencimento = get("t-vencimento").value;
        const pagamento = get("t-pagamento").value;
        const tipo = this.tipoSelecionado();

        const invalidos = [];

        if (!codigo) invalidos.push("t-codigo");
        if (!razao) invalidos.push("t-razao");
        if (!numero) invalidos.push("t-numero");
        if (!(valor > 0)) invalidos.push("t-valor");
        if (!(percentual >= 0)) invalidos.push("t-percentual");
        if (!(multa >= 0)) invalidos.push("t-multa");
        if (!vencimento) invalidos.push("t-vencimento");
        if (!pagamento) invalidos.push("t-pagamento");

        this.marcarInvalidos(invalidos);

        if (invalidos.length > 0) {
            this.mensagem("Preencha todos os campos corretamente (valor maior que zero e porcentagem válida).");
            return;
        }

        const lista = Armazenamento.tipoLista();

        if (lista && lista !== tipo) {
            this.mensagem(`Esta lista é de ${lista}. Limpe a lista para calcular ${tipo}.`);
            return;
        }

        if (Armazenamento.existe(codigo, numero)) {
            this.marcarInvalidos(["t-numero"]);
            this.mensagem("Este título já foi adicionado para este cliente.");
            return;
        }

        const valorCentavos = Math.round(valor * 100);

        const encargos = Custas.calcularEncargos({
            valorCentavos, vencimento, pagamento, percentual, periodo, multa
        });

        Armazenamento.adicionar({
            id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random())),
            tipo,
            codigo,
            razaoSocial: razao,
            numero,
            valorCentavos,
            vencimento,
            pagamento,
            percentual,
            periodo,
            multaPercentual: multa,
            multaCentavos: encargos.multaCentavos,
            dias: encargos.dias,
            jurosCentavos: encargos.jurosCentavos,
            totalCentavos: encargos.totalCentavos
        });

        if (encargos.dias === 0) {
            this.mensagem("Título adicionado. A data de pagamento não é posterior ao vencimento, então não há valor a acrescentar.", "aviso");
        } else {
            this.mensagem("Título adicionado à lista.", "ok");
        }

        /* Limpa apenas os campos do título: cliente, datas e forma de aplicação
           continuam preenchidos para lançar vários boletos seguidos. */
        ["t-numero", "t-valor", "t-vencimento"].forEach(id => get(id).value = "");
        get("t-numero").focus();

        this.renderizar();
    },

    renderizar() {
        const grupos = Custas.agruparPorCliente(Armazenamento.titulos);
        const total = Custas.totalGeral(grupos);
        const container = get("clientes-container");
        const vazio = grupos.length === 0;

        this.atualizarTipo();
        this.atualizarRotulos();

        get("totais").hidden = vazio;
        get("totais").classList.toggle("protesto", Armazenamento.tipoLista() === "Protesto");

        ["btn-imprimir", "btn-pdf", "btn-excel"].forEach(id => {
            get(id).disabled = vazio;
        });

        get("lista-sub").textContent = vazio
            ? "Agrupados por cliente, com o valor calculado destacado."
            : `Lista de ${Armazenamento.tipoLista()} · agrupada por cliente.`;

        if (vazio) {
            container.innerHTML = `<div class="vazio">Nenhum título adicionado ainda.</div>`;
            return;
        }

        get("tot-clientes").textContent = grupos.length;
        get("tot-titulos").textContent = total.titulos;
        get("tot-original").textContent = formatarMoeda(total.original);
        get("tot-juros").textContent = formatarMoeda(total.juros);
        get("tot-atualizado").textContent = formatarMoeda(total.atualizado);

        container.innerHTML = grupos.map(grupo => this.htmlCliente(grupo)).join("");
    },

    htmlCliente(grupo) {
        const encargo = Rotulos.encargo(Armazenamento.tipoLista());

        /* Protesto: destaca dias de atraso, valor, juros e total. Custas: só o valor das custas. */
        const prot = Armazenamento.tipoLista() === "Protesto";
        const rz = prot ? " destaque-p" : "";

        const linhas = grupo.titulos.map(t => `
            <tr>
                <td>${escaparHTML(t.numero)}</td>
                <td>${formatarData(criarData(t.vencimento))}</td>
                <td>${formatarData(criarData(t.pagamento))}</td>
                <td class="num${rz}">${formatarMoeda(t.valorCentavos)}</td>
                <td class="num dias-atraso${rz}">${t.dias}</td>
                <td class="num">${escaparHTML(Rotulos.taxa(t))}</td>
                <td class="num juros">${formatarMoeda(t.jurosCentavos)}</td>
                <td class="num atualizado${rz}">${formatarMoeda(t.totalCentavos)}</td>
                <td><button type="button" class="btn-remover" title="Remover título"
                        data-remover-titulo="${escaparHTML(t.id)}">×</button></td>
            </tr>
        `).join("");

        return `
            <div class="cliente-bloco${prot ? " tipo-protesto" : ""}">
                <div class="cliente-head">
                    <div>
                        <strong>${escaparHTML(grupo.razaoSocial)}</strong>
                        <small>Código ${escaparHTML(grupo.codigo)} · ${grupo.titulos.length} título(s)</small>
                    </div>
                    <div class="cliente-acoes">
                        <button type="button" class="btn-mini btn-teams"
                            title="Copia o resumo formatado deste cliente para colar no Teams"
                            data-teams-cliente="${escaparHTML(grupo.chave)}">Copiar para o Teams</button>
                        <button type="button" class="btn-mini"
                            data-remover-cliente="${escaparHTML(grupo.chave)}">Remover cliente</button>
                    </div>
                </div>

                <div class="tabela-wrap">
                    <table class="tabela">
                        <thead>
                            <tr>
                                <th>Título</th>
                                <th>Vencimento</th>
                                <th>Pagamento</th>
                                <th class="num">Valor original</th>
                                <th class="num">Dias</th>
                                <th class="num">Taxa</th>
                                <th class="num">${escaparHTML(encargo)}</th>
                                <th class="num">Total atualizado</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>${linhas}</tbody>
                        <tfoot>
                            <tr>
                                <td colspan="3">Subtotal do cliente</td>
                                <td class="num${rz}">${formatarMoeda(grupo.subtotalOriginal)}</td>
                                <td></td>
                                <td></td>
                                <td class="num juros">${formatarMoeda(grupo.subtotalJuros)}</td>
                                <td class="num atualizado${rz}">${formatarMoeda(grupo.subtotalAtualizado)}</td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        `;
    }

};


/* =====================================================
   BIBLIOTECAS EXTERNAS (carregadas só quando necessárias)
   PDF: jsPDF + AutoTable · Excel: ExcelJS
===================================================== */

const Bibliotecas = {

    URLS: {
        jspdf: "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js",
        autotable: "https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js",
        exceljs: "https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js"
    },

    _promessas: {},

    script(src) {
        if (!this._promessas[src]) {
            this._promessas[src] = new Promise((resolve, reject) => {
                const tag = document.createElement("script");
                tag.src = src;
                tag.onload = resolve;
                tag.onerror = () => {
                    delete this._promessas[src];
                    reject(new Error("Falha ao carregar " + src));
                };
                document.head.appendChild(tag);
            });
        }

        return this._promessas[src];
    },

    async pdf() {
        await this.script(this.URLS.jspdf);
        await this.script(this.URLS.autotable);

        const JsPDF = window.jspdf && window.jspdf.jsPDF;

        if (!JsPDF || typeof new JsPDF().autoTable !== "function") {
            throw new Error("jsPDF/AutoTable indisponível");
        }

        return JsPDF;
    },

    async excel() {
        await this.script(this.URLS.exceljs);

        if (!window.ExcelJS) throw new Error("ExcelJS indisponível");

        return window.ExcelJS;
    }

};


/* =====================================================
   RELATÓRIO — impressão, PDF e Excel

   Os três formatos partem do mesmo "modelo":
   { tipo, responsavel, emissao, mostrarPercentual, grupos, total }
   Assim, o conteúdo é igual em qualquer saída.
===================================================== */

const Relatorio = {

    /* ---------- modelo e validações ---------- */

    modelo() {
        const grupos = Custas.agruparPorCliente(Armazenamento.titulos);
        const tipo = Armazenamento.tipoLista();

        return {
            tipo,
            responsavel: get("responsavel").value.trim(),
            emissao: new Date(),
            /* Custas: sempre mostra. Protesto: só se a caixa estiver marcada. */
            mostrarPercentual: tipo === "Custas" || get("mostrar-pct").checked,
            grupos,
            total: Custas.totalGeral(grupos)
        };
    },

    /* Devolve o modelo, ou null (com aviso na tela) se faltar algo. */
    preparar() {
        if (Armazenamento.titulos.length === 0) {
            CustasUI.mensagemExport("Adicione ao menos um título antes de gerar o relatório.");
            return null;
        }

        const modelo = this.modelo();

        if (!modelo.responsavel) {
            CustasUI.mensagemExport("Informe o nome do responsável pelo cálculo antes de gerar o relatório.");

            const campo = get("responsavel");
            campo.classList.add("invalid");
            campo.scrollIntoView({ behavior: "smooth", block: "center" });
            campo.focus();

            return null;
        }

        CustasUI.mensagemExport("");
        return modelo;
    },

    nomeArquivo(modelo, extensao) {
        const tipo = modelo.tipo === "Custas" ? "custas" : "protestos";
        return `relatorio-${tipo}-${dataParaInput(modelo.emissao)}.${extensao}`;
    },

    /* Colunas do relatório. A coluna "Taxa" some quando a porcentagem é ocultada. */
    colunas(modelo) {
        const prot = modelo.tipo === "Protesto";
        const colunas = [];

        colunas.push({ id: "numero", titulo: "Título", formato: "texto", largura: 16 });
        colunas.push({ id: "vencimento", titulo: "Vencimento", formato: "data", largura: 13 });

        if (prot) {
            /* Protesto: Título · Vencimento · Valor original · Juros · Dias de atraso · Valor total */
            colunas.push({ id: "valor", titulo: "Valor original", formato: "moeda", largura: 17, realce: true });
            colunas.push({ id: "juros", titulo: this.rotuloJuros(modelo), formato: "moeda", largura: 16, destaque: true });
            colunas.push({ id: "dias", titulo: "Dias de atraso", formato: "inteiro", largura: 12, realce: true });

            if (modelo.mostrarPercentual) {
                colunas.push({ id: "taxa", titulo: "Taxa", formato: "texto", largura: 30 });
            }

            colunas.push({ id: "total", titulo: "Valor total (protesto)", formato: "moeda", largura: 20, realce: true });
        } else {
            colunas.push({ id: "pagamento", titulo: "Pagamento", formato: "data", largura: 13 });
            colunas.push({ id: "valor", titulo: "Valor original", formato: "moeda", largura: 17 });
            colunas.push({ id: "dias", titulo: "Dias de atraso", formato: "inteiro", largura: 12 });

            if (modelo.mostrarPercentual) {
                colunas.push({ id: "taxa", titulo: "Taxa", formato: "texto", largura: 30 });
            }

            colunas.push({ id: "juros", titulo: this.rotuloJuros(modelo), formato: "moeda", largura: 16, destaque: true });
            colunas.push({ id: "total", titulo: "Valor atualizado", formato: "moeda", largura: 18 });
        }

        return colunas;
    },

    /* No Protesto, a coluna do encargo é "Juros" (o valor do protesto é a soma valor + juros). */
    rotuloJuros(modelo) {
        return modelo.tipo === "Protesto" ? "Juros" : Rotulos.encargo(modelo.tipo);
    },

    /* Quantas colunas iniciais o rótulo do subtotal ocupa (as demais mostram valores). */
    colunasRotulo(modelo) {
        return modelo.tipo === "Protesto" ? 2 : 3;
    },

    /* Valor bruto de uma célula (moeda em centavos, datas em AAAA-MM-DD). */
    valorCelula(titulo, id) {
        switch (id) {
            case "numero": return titulo.numero;
            case "vencimento": return titulo.vencimento;
            case "pagamento": return titulo.pagamento;
            case "valor": return titulo.valorCentavos;
            case "dias": return titulo.dias;
            case "taxa": return Rotulos.taxa(titulo);
            case "juros": return titulo.jurosCentavos;
            case "total": return titulo.totalCentavos;
            default: return "";
        }
    },

    valorSubtotal(grupo, id) {
        switch (id) {
            case "valor": return grupo.subtotalOriginal;
            case "juros": return grupo.subtotalJuros;
            case "total": return grupo.subtotalAtualizado;
            default: return null;
        }
    },

    valorTotalGeral(total, id) {
        switch (id) {
            case "valor": return total.original;
            case "juros": return total.juros;
            case "total": return total.atualizado;
            default: return null;
        }
    },

    formatar(coluna, valor) {
        if (valor === null || valor === undefined) return "";

        switch (coluna.formato) {
            case "data": return formatarData(criarData(valor));
            case "moeda": return formatarMoeda(valor);
            case "inteiro": return String(valor);
            default: return String(valor);
        }
    },

    nota(modelo) {
        const base = "Estimativa sujeita à conferência com os valores oficiais de cartório.";

        return modelo.mostrarPercentual
            ? "A porcentagem é aplicada sobre o valor do título e o resultado é acumulado por dia ou por mês de atraso " +
              "(mês de 30 dias, proporcional aos dias). " + base
            : "Valores calculados conforme parâmetros internos. " + base;
    },

    /* ---------- impressão ---------- */

    imprimir() {
        const modelo = this.preparar();
        if (!modelo) return;

        if (!this.abrirJanela(modelo)) {
            CustasUI.mensagemExport("O navegador bloqueou a nova janela. Permita pop-ups para este site e tente novamente.");
        }
    },

    abrirJanela(modelo) {
        const janela = window.open("", "_blank");
        if (!janela) return false;

        janela.document.open();
        janela.document.write(this.montarHTML(modelo));
        janela.document.close();

        /* Pequena espera para o CSS ser aplicado antes de abrir a impressão. */
        janela.onload = () => setTimeout(() => janela.print(), 300);

        return true;
    },

    montarHTML(modelo) {
        const colunas = this.colunas(modelo);
        const emissao = modelo.emissao.toLocaleString("pt-BR");
        const titulo = Rotulos.tituloRelatorio(modelo.tipo);

        const classeCelula = coluna =>
            [coluna.formato === "texto" || coluna.formato === "data" ? "" : "n", coluna.destaque ? "juros" : "", coluna.realce ? "realce" : ""]
                .filter(Boolean).join(" ");

        const cabecalho = colunas.map(c =>
            `<th class="${c.formato === "texto" || c.formato === "data" ? "" : "n"}${c.realce ? " realce" : ""}">${escaparHTML(c.titulo)}</th>`
        ).join("");

        const secoes = modelo.grupos.map(grupo => {
            const linhas = grupo.titulos.map(t => `
                <tr>${colunas.map(c => {
                    const texto = escaparHTML(this.formatar(c, this.valorCelula(t, c.id)));
                    return `<td class="${classeCelula(c)}">${c.id === "total" && c.realce ? `<b>${texto}</b>` : texto}</td>`;
                }).join("")}</tr>
            `).join("");

            /* Subtotal: o rótulo ocupa as 3 primeiras colunas. */
            const subtotal = colunas.slice(this.colunasRotulo(modelo)).map(c =>
                `<td class="${classeCelula(c)}">${escaparHTML(this.formatar(c, this.valorSubtotal(grupo, c.id)))}</td>`
            ).join("");

            return `
                <section class="cliente">
                    <h2>${escaparHTML(grupo.razaoSocial)}
                        <span>Código ${escaparHTML(grupo.codigo)}</span></h2>

                    <table>
                        <thead><tr>${cabecalho}</tr></thead>
                        <tbody>${linhas}</tbody>
                        <tfoot>
                            <tr>
                                <td colspan="${this.colunasRotulo(modelo)}">Subtotal — ${grupo.titulos.length} título(s)</td>
                                ${subtotal}
                            </tr>
                        </tfoot>
                    </table>
                </section>
            `;
        }).join("");

        return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>${escaparHTML(titulo)}</title>
<style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 32px; font-family: Arial, Helvetica, sans-serif; color: #111827; font-size: 12px; }
    header { display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 14px; border-bottom: 3px solid #1A365D; margin-bottom: 22px; }
    header h1 { margin: 0; font-size: 22px; color: #1A365D; }
    header p { margin: 4px 0 0; color: #6b7280; font-size: 11px; }
    .meta { text-align: right; color: #374151; font-size: 11px; line-height: 1.7; }
    .meta b { color: #111827; }
    .tag { display: inline-block; padding: 2px 9px; border-radius: 999px; background: #dbeafe; color: #1A365D; font-weight: bold; font-size: 11px; }
    .cliente { margin-bottom: 26px; page-break-inside: avoid; }
    .cliente h2 { margin: 0 0 8px; padding: 8px 10px; background: #eff6ff; border-left: 4px solid #1A365D; font-size: 14px; display: flex; justify-content: space-between; }
    .cliente h2 span { color: #6b7280; font-size: 11px; font-weight: normal; }
    table { width: 100%; border-collapse: collapse; }
    th { padding: 7px 8px; text-align: left; background: #f3f4f6; border-bottom: 1px solid #d1d5db; font-size: 10px; text-transform: uppercase; letter-spacing: .03em; color: #4b5563; }
    td { padding: 7px 8px; border-bottom: 1px solid #e5e7eb; }
    .n { text-align: right; white-space: nowrap; }
    .juros { color: #c2410c; font-weight: bold; background: #fff7ed; }
    th.juros { background: #ffedd5; }
    .realce { background: #dbeafe; color: #1A365D; font-weight: bold; }
    th.realce { background: #bfdbfe; }
    tfoot td { border-top: 2px solid #1A365D; border-bottom: none; background: #f9fafb; font-weight: bold; }
    .geral { margin-top: 10px; padding: 14px 16px; background: #1A365D; color: white; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; page-break-inside: avoid; }
    .geral h3 { margin: 0; font-size: 15px; }
    .geral small { opacity: .85; font-size: 11px; }
    .geral .vals { text-align: right; line-height: 1.7; font-size: 13px; }
    .geral .vals .hl { display: inline-block; margin: 3px 0; padding: 4px 12px; border-radius: 4px; background: #fde68a; color: #78350f; font-size: 14px; }
    .geral .vals .hl b { font-size: 19px; }
    .geral .vals .hl2 { background: #bfdbfe; color: #1A365D; }
    .aviso { margin-top: 18px; color: #6b7280; font-size: 10px; }
    .no-print { margin-bottom: 18px; }
    .no-print button { padding: 9px 16px; border: none; border-radius: 6px; background: #1A365D; color: white; font-size: 13px; cursor: pointer; }
    @media print { body { padding: 0; } .no-print { display: none; } * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
    <div class="no-print"><button onclick="window.print()">Imprimir / Salvar como PDF</button></div>

    <header>
        <div>
            <h1>${escaparHTML(titulo)}</h1>
            <p>Cálculo sobre títulos vencidos</p>
        </div>
        <div class="meta">
            Tipo: <span class="tag">${escaparHTML(modelo.tipo)}</span><br>
            Responsável pelo cálculo: <b>${escaparHTML(modelo.responsavel)}</b><br>
            Emitido em ${escaparHTML(emissao)}<br>
            ${modelo.grupos.length} cliente(s) · ${modelo.total.titulos} título(s)
        </div>
    </header>

    ${secoes}

    <div class="geral">
        <div>
            <h3>TOTAL GERAL</h3>
            <small>${modelo.grupos.length} cliente(s) · ${modelo.total.titulos} título(s)</small>
        </div>
        <div class="vals">
            Valor original: ${formatarMoeda(modelo.total.original)}<br>
            <span class="hl">${escaparHTML(this.rotuloJuros(modelo))}: <b>${formatarMoeda(modelo.total.juros)}</b></span><br>
            ${modelo.tipo === "Protesto"
                ? `<span class="hl hl2">Total do protesto: <b>${formatarMoeda(modelo.total.atualizado)}</b></span>`
                : `Total atualizado: ${formatarMoeda(modelo.total.atualizado)}`}
        </div>
    </div>

    <p class="aviso">${escaparHTML(this.nota(modelo))}</p>
</body>
</html>`;
    },

    /* ---------- PDF ---------- */

    async exportarPDF() {
        const modelo = this.preparar();
        if (!modelo) return;

        CustasUI.mensagemExport("Gerando PDF...", "ok");

        let JsPDF;

        try {
            JsPDF = await Bibliotecas.pdf();
        } catch (erro) {
            console.error(erro);

            /* Plano B: sem a biblioteca (ex.: sem internet), usa a impressão,
               onde o navegador permite "Salvar como PDF". */
            CustasUI.mensagemExport(
                "Não foi possível carregar o gerador de PDF. Na janela de impressão, escolha \"Salvar como PDF\".",
                "aviso"
            );

            this.abrirJanela(modelo);
            return;
        }

        try {
            const doc = this.montarPDF(JsPDF, modelo);
            doc.save(this.nomeArquivo(modelo, "pdf"));
            CustasUI.mensagemExport("PDF gerado.", "ok");
        } catch (erro) {
            console.error(erro);
            CustasUI.mensagemExport("Erro ao gerar o PDF. Tente a opção Imprimir e salve como PDF.");
        }
    },

    /* Recebe o construtor jsPDF (já com o plugin AutoTable) e devolve o documento. */
    montarPDF(JsPDF, modelo) {
        const doc = new JsPDF({ unit: "mm", format: "a4" });
        const colunas = this.colunas(modelo);
        const margem = 14;
        const larguraUtil = 210 - margem * 2;
        const alturaPagina = 297;
        const idxJuros = colunas.findIndex(c => c.destaque);
        const t = textoSimples;

        /* Cabeçalho */
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.setTextColor(26, 54, 93);
        doc.text(Rotulos.tituloRelatorio(modelo.tipo), margem, 18);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(75, 85, 99);
        doc.text(`Tipo: ${modelo.tipo}`, margem, 25);
        doc.text(`Responsável pelo cálculo: ${modelo.responsavel}`, margem, 30);
        doc.text(`Emitido em ${modelo.emissao.toLocaleString("pt-BR")}`, 210 - margem, 25, { align: "right" });
        doc.text(`${modelo.grupos.length} cliente(s) - ${modelo.total.titulos} título(s)`, 210 - margem, 30, { align: "right" });

        doc.setDrawColor(26, 54, 93);
        doc.setLineWidth(0.8);
        doc.line(margem, 34, 210 - margem, 34);

        let y = 44;

        modelo.grupos.forEach(grupo => {
            if (y > alturaPagina - 55) {
                doc.addPage();
                y = 20;
            }

            /* Faixa com o nome do cliente */
            doc.setFillColor(239, 246, 255);
            doc.rect(margem, y - 5, larguraUtil, 8, "F");
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(17, 24, 39);
            doc.text(t(grupo.razaoSocial), margem + 2, y);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(107, 114, 128);
            doc.text(`Código ${t(grupo.codigo)}`, 210 - margem - 2, y, { align: "right" });

            const corpo = grupo.titulos.map(titulo =>
                colunas.map(c => t(this.formatar(c, this.valorCelula(titulo, c.id))))
            );

            const rodape = [{ content: `Subtotal - ${grupo.titulos.length} título(s)`, colSpan: this.colunasRotulo(modelo) }];
            colunas.slice(this.colunasRotulo(modelo)).forEach(c => {
                rodape.push(t(this.formatar(c, this.valorSubtotal(grupo, c.id))));
            });

            doc.autoTable({
                startY: y + 4,
                head: [colunas.map(c => c.titulo)],
                body: corpo,
                foot: [rodape],
                showFoot: "lastPage",
                theme: "plain",
                margin: { left: margem, right: margem },
                styles: { fontSize: 8, cellPadding: 1.8, textColor: [31, 41, 55], lineColor: [229, 231, 235], lineWidth: 0 },
                headStyles: { fillColor: [243, 244, 246], textColor: [75, 85, 99], fontStyle: "bold" },
                footStyles: { fillColor: [249, 250, 251], textColor: [17, 24, 39], fontStyle: "bold" },
                didParseCell: dados => {
                    const coluna = colunas[dados.column.index];

                    if (coluna && coluna.formato !== "texto" && coluna.formato !== "data") {
                        dados.cell.styles.halign = "right";
                    }

                    if (coluna && coluna.realce && (dados.section === "body" || dados.section === "foot")) {
                        dados.cell.styles.fillColor = [219, 234, 254];
                        dados.cell.styles.textColor = [26, 54, 93];
                        dados.cell.styles.fontStyle = "bold";
                    }

                    if (dados.column.index === idxJuros) {
                        if (dados.section === "body") {
                            dados.cell.styles.fillColor = [255, 247, 237];
                            dados.cell.styles.textColor = [194, 65, 12];
                            dados.cell.styles.fontStyle = "bold";
                        } else if (dados.section === "foot") {
                            dados.cell.styles.textColor = [194, 65, 12];
                        }
                    }
                }
            });

            y = doc.lastAutoTable.finalY + 10;
        });

        /* Total geral */
        if (y > alturaPagina - 52) {
            doc.addPage();
            y = 20;
        }

        doc.setFillColor(26, 54, 93);
        const prot = modelo.tipo === "Protesto";
        const alturaCaixa = prot ? 35 : 26;
        doc.roundedRect(margem, y, larguraUtil, alturaCaixa, 2, 2, "F");

        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("TOTAL GERAL", margem + 5, y + 10);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text(`${modelo.grupos.length} cliente(s) - ${modelo.total.titulos} título(s)`, margem + 5, y + 16);

        doc.setFontSize(9);
        doc.text(t(`Valor original: ${formatarMoeda(modelo.total.original)}`), 210 - margem - 5, y + 7, { align: "right" });
        if (!prot) doc.text(t(`Total atualizado: ${formatarMoeda(modelo.total.atualizado)}`), 210 - margem - 5, y + 12, { align: "right" });

        /* Único destaque do relatório: o valor das custas/encargo. */
        const textoEncargo = t(`${this.rotuloJuros(modelo)}: ${formatarMoeda(modelo.total.juros)}`);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        const larguraEncargo = doc.getTextWidth(textoEncargo);
        doc.setFillColor(253, 230, 138);
        const yEnc = prot ? 9.5 : 14.5;
        doc.roundedRect(210 - margem - 5 - larguraEncargo - 3, y + yEnc, larguraEncargo + 6, 8, 1.5, 1.5, "F");
        doc.setTextColor(120, 53, 15);
        doc.text(textoEncargo, 210 - margem - 5, y + yEnc + 5.8, { align: "right" });

        /* Protesto: o total (valor + juros) também é destacado. */
        if (prot) {
            const textoTotal = t(`Total do protesto: ${formatarMoeda(modelo.total.atualizado)}`);
            const larguraTotal = doc.getTextWidth(textoTotal);
            doc.setFillColor(191, 219, 254);
            doc.roundedRect(210 - margem - 5 - larguraTotal - 3, y + 20, larguraTotal + 6, 8, 1.5, 1.5, "F");
            doc.setTextColor(26, 54, 93);
            doc.text(textoTotal, 210 - margem - 5, y + 25.8, { align: "right" });
        }

        /* Nota */
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(107, 114, 128);
        doc.text(doc.splitTextToSize(this.nota(modelo), larguraUtil), margem, y + alturaCaixa + 7);

        /* Numeração de páginas */
        const paginas = doc.getNumberOfPages();

        for (let i = 1; i <= paginas; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(`Página ${i} de ${paginas}`, 210 / 2, alturaPagina - 8, { align: "center" });
        }

        return doc;
    },

    /* ---------- Excel ---------- */

    async exportarExcel() {
        const modelo = this.preparar();
        if (!modelo) return;

        CustasUI.mensagemExport("Gerando Excel...", "ok");

        let ExcelJS;

        try {
            ExcelJS = await Bibliotecas.excel();
        } catch (erro) {
            console.error(erro);

            /* Plano B: sem a biblioteca, baixa um CSV que o Excel abre normalmente. */
            const csv = this.montarCSV(modelo);
            baixarArquivo(new Blob([csv], { type: "text/csv;charset=utf-8" }), this.nomeArquivo(modelo, "csv"));

            CustasUI.mensagemExport(
                "Não foi possível carregar o gerador de Excel. Baixei um arquivo CSV, que abre no Excel.",
                "aviso"
            );
            return;
        }

        try {
            const planilha = await this.montarExcel(ExcelJS, modelo);
            const buffer = await planilha.xlsx.writeBuffer();

            baixarArquivo(
                new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
                this.nomeArquivo(modelo, "xlsx")
            );

            CustasUI.mensagemExport("Planilha Excel gerada.", "ok");
        } catch (erro) {
            console.error(erro);
            CustasUI.mensagemExport("Erro ao gerar o Excel.");
        }
    },

    /* Recebe a classe ExcelJS e devolve o workbook montado. Valores numéricos
       e datas são gravados como números/datas reais, para calcular no Excel. */
    async montarExcel(ExcelJS, modelo) {
        const colunas = this.colunas(modelo);
        const formatoMoeda = '"R$" #,##0.00';
        const dataUTC = iso => {
            const [a, m, d] = iso.split("-").map(Number);
            return new Date(Date.UTC(a, m - 1, d));
        };

        const preenchimento = argb => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
        const borda = { bottom: { style: "thin", color: { argb: "FFE5E7EB" } } };

        const wb = new ExcelJS.Workbook();
        wb.creator = modelo.responsavel;
        wb.created = modelo.emissao;

        const ws = wb.addWorksheet(modelo.tipo === "Custas" ? "Custas" : "Protestos", {
            views: [{ showGridLines: false }]
        });

        ws.columns = colunas.map(c => ({ width: c.largura }));

        /* Formata a célula conforme o tipo da coluna. */
        const aplicarFormato = (celula, coluna) => {
            if (coluna.formato === "moeda") celula.numFmt = formatoMoeda;
            if (coluna.formato === "data") celula.numFmt = "dd/mm/yyyy";
            if (coluna.formato === "moeda" || coluna.formato === "inteiro") {
                celula.alignment = { horizontal: "right" };
            }
        };

        /* Cabeçalho do relatório */
        const titulo = ws.addRow([Rotulos.tituloRelatorio(modelo.tipo)]);
        titulo.getCell(1).font = { bold: true, size: 15, color: { argb: "FF1A365D" } };

        [
            ["Tipo:", modelo.tipo],
            ["Responsável:", modelo.responsavel],
            ["Emitido em:", modelo.emissao.toLocaleString("pt-BR")]
        ].forEach(([rotulo, valor]) => {
            const linha = ws.addRow([rotulo, valor]);
            linha.getCell(1).font = { bold: true };
        });

        ws.addRow([]);

        /* Um bloco por cliente */
        modelo.grupos.forEach(grupo => {
            const faixa = ws.addRow([`${grupo.razaoSocial}  -  Código ${grupo.codigo}`]);
            ws.mergeCells(faixa.number, 1, faixa.number, colunas.length);
            faixa.getCell(1).font = { bold: true, size: 11 };
            faixa.getCell(1).fill = preenchimento("FFEFF6FF");

            const cab = ws.addRow(colunas.map(c => c.titulo));
            colunas.forEach((c, i) => {
                const celula = cab.getCell(i + 1);
                celula.font = { bold: true, color: { argb: "FF4B5563" } };
                celula.fill = preenchimento(c.destaque ? "FFFFEDD5" : c.realce ? "FFBFDBFE" : "FFF3F4F6");
                celula.alignment = { horizontal: c.formato === "texto" || c.formato === "data" ? "left" : "right" };
            });

            grupo.titulos.forEach(t => {
                const valores = colunas.map(c => {
                    const bruto = this.valorCelula(t, c.id);

                    if (c.formato === "data") return dataUTC(bruto);
                    if (c.formato === "moeda") return bruto / 100;
                    return bruto;
                });

                const linha = ws.addRow(valores);

                colunas.forEach((c, i) => {
                    const celula = linha.getCell(i + 1);
                    aplicarFormato(celula, c);
                    celula.border = borda;

                    if (c.destaque) {
                        celula.font = { bold: true, color: { argb: "FFC2410C" } };
                        celula.fill = preenchimento("FFFFF7ED");
                    }

                    if (c.realce) {
                        celula.font = { bold: true, color: { argb: "FF1A365D" } };
                        celula.fill = preenchimento("FFDBEAFE");
                    }
                });
            });

            /* Subtotal do cliente */
            const valoresSub = colunas.map((c, i) => {
                if (i === 0) return `Subtotal - ${grupo.titulos.length} título(s)`;
                const bruto = this.valorSubtotal(grupo, c.id);
                return bruto === null ? null : bruto / 100;
            });

            const sub = ws.addRow(valoresSub);
            ws.mergeCells(sub.number, 1, sub.number, this.colunasRotulo(modelo));

            colunas.forEach((c, i) => {
                const celula = sub.getCell(i + 1);
                aplicarFormato(celula, c);
                celula.font = { bold: true, color: { argb: c.destaque ? "FFC2410C" : c.realce ? "FF1A365D" : "FF111827" } };
                celula.fill = preenchimento(c.realce ? "FFDBEAFE" : "FFF9FAFB");
                celula.border = { top: { style: "medium", color: { argb: "FF1A365D" } } };
            });

            ws.addRow([]);
        });

        /* Total geral */
        const valoresTotal = colunas.map((c, i) => {
            if (i === 0) {
                return `TOTAL GERAL - ${modelo.grupos.length} cliente(s), ${modelo.total.titulos} título(s)`;
            }

            const bruto = this.valorTotalGeral(modelo.total, c.id);
            return bruto === null ? null : bruto / 100;
        });

        const geral = ws.addRow(valoresTotal);
        ws.mergeCells(geral.number, 1, geral.number, this.colunasRotulo(modelo));

        colunas.forEach((c, i) => {
            const celula = geral.getCell(i + 1);
            aplicarFormato(celula, c);
            celula.font = { bold: i === 0 || !!c.destaque, size: 11, color: { argb: "FFFFFFFF" } };
            celula.fill = preenchimento("FF1A365D");

            /* Único destaque do total: a coluna de custas/encargo. */
            if (c.destaque) {
                celula.font = { bold: true, size: 12, color: { argb: "FF78350F" } };
                celula.fill = preenchimento("FFFDE68A");
            } else if (c.realce && this.valorTotalGeral(modelo.total, c.id) !== null) {
                celula.font = { bold: true, size: 12, color: { argb: "FF1A365D" } };
                celula.fill = preenchimento("FFBFDBFE");
            }
        });

        ws.addRow([]);

        const nota = ws.addRow([this.nota(modelo)]);
        nota.getCell(1).font = { italic: true, size: 9, color: { argb: "FF6B7280" } };

        return wb;
    },

    /* Plano B do Excel: CSV com ponto e vírgula e BOM (acentos corretos no Excel brasileiro). */
    montarCSV(modelo) {
        const colunas = this.colunas(modelo);
        const campo = valor => `"${String(valor).replace(/"/g, '""')}"`;
        const numero = centavos => (centavos / 100).toFixed(2).replace(".", ",");

        const linhas = [
            [Rotulos.tituloRelatorio(modelo.tipo)],
            ["Tipo", modelo.tipo],
            ["Responsável", modelo.responsavel],
            ["Emitido em", modelo.emissao.toLocaleString("pt-BR")],
            [],
            ["Código", "Razão social", ...colunas.map(c => c.titulo)]
        ];

        modelo.grupos.forEach(grupo => {
            grupo.titulos.forEach(t => {
                linhas.push([
                    grupo.codigo,
                    grupo.razaoSocial,
                    ...colunas.map(c => {
                        const bruto = this.valorCelula(t, c.id);
                        return c.formato === "moeda" ? numero(bruto) : this.formatar(c, bruto);
                    })
                ]);
            });

            linhas.push([
                grupo.codigo,
                `Subtotal - ${grupo.razaoSocial}`,
                ...colunas.map(c => {
                    const bruto = this.valorSubtotal(grupo, c.id);
                    return bruto === null ? "" : numero(bruto);
                })
            ]);
        });

        linhas.push([
            "",
            "TOTAL GERAL",
            ...colunas.map(c => {
                const bruto = this.valorTotalGeral(modelo.total, c.id);
                return bruto === null ? "" : numero(bruto);
            })
        ]);

        return "﻿" + linhas.map(l => l.map(campo).join(";")).join("\r\n");
    }

};


/* =====================================================
   TOAST — aviso rápido na tela
===================================================== */

const Toast = {

    _timer: null,

    mostrar(texto, tipo = "ok") {
        let el = get("toast");

        if (!el) {
            el = document.createElement("div");
            el.id = "toast";
            el.setAttribute("role", "status");
            el.setAttribute("aria-live", "polite");
            document.body.appendChild(el);
        }

        el.textContent = texto;
        el.className = `toast ${tipo} visivel`;

        clearTimeout(this._timer);
        this._timer = setTimeout(() => el.classList.remove("visivel"), 3500);
    }

};


/* =====================================================
   COPIAR PARA O TEAMS (auditoria / histórico)

   Gera um resumo em Rich Text (text/html) de UM cliente e
   copia para a área de transferência. No Teams, basta Ctrl+V.

   Regra de destaque: só o total de CUSTAS/ENCARGO calculado
   é destacado. Nenhuma soma "valor original + custas" é exibida.
   A porcentagem aplicada NÃO entra no resumo (no Protesto ela é sigilosa).
===================================================== */

const Teams = {

    async copiarCliente(chave) {
        const grupo = Custas.agruparPorCliente(Armazenamento.titulos)
            .find(g => g.chave === chave);

        if (!grupo) return;

        const responsavel = get("responsavel").value.trim();

        if (!responsavel) {
            Toast.mostrar("Informe o nome do responsável antes de copiar para o Teams.", "erro");

            const campo = get("responsavel");
            campo.classList.add("invalid");
            campo.scrollIntoView({ behavior: "smooth", block: "center" });
            campo.focus();
            return;
        }

        const dados = {
            tipo: Armazenamento.tipoLista(),
            responsavel,
            dataHora: new Date().toLocaleString("pt-BR"),
            grupo
        };

        try {
            await this.escrever(this.montarHTML(dados), this.montarTexto(dados));
            Toast.mostrar("Copiado para o Teams com sucesso!", "ok");
        } catch (erro) {
            Toast.mostrar("Não foi possível copiar. Verifique as permissões do navegador.", "erro");
        }
    },

    /* Hífen e espaço "inquebráveis": o número do título (ex.: 7895-1)
       nunca é partido em duas linhas dentro da célula. */
    semQuebra(texto) {
        return String(texto).replace(/-/g, "\u2011").replace(/ /g, "\u00A0");
    },

    /* ---------- conteúdo ---------- */

    /* Colunas do resumo. Protesto: Título · Vencimento · Valor Orig. · Juros · Dias Atraso · Valor Total.
       Custas: Título · Vencimento · Dias Atraso · Valor Orig. · Custas (valor calculado). */
    colunasResumo(tipo) {
        const encargo = Rotulos.encargo(tipo);
        const titulo = t => this.semQuebra(t.numero);
        const venc = t => formatarData(criarData(t.vencimento));

        if (tipo === "Protesto") {
            return [
                { cab: "Título", dir: false, html: t => escaparHTML(titulo(t)), txt: titulo },
                { cab: "Vencimento", dir: false, html: venc, txt: venc },
                { cab: "Valor Orig.", dir: true, rel: "azul", html: t => formatarMoeda(t.valorCentavos), txt: t => formatarMoeda(t.valorCentavos) },
                { cab: "Juros", dir: true, rel: "ambar", html: t => `<b>${formatarMoeda(t.jurosCentavos)}</b>`, txt: t => formatarMoeda(t.jurosCentavos) },
                { cab: "Dias Atraso", dir: true, rel: "azul", html: t => String(t.dias), txt: t => String(t.dias) },
                { cab: "Valor Total<br>(Valor + Juros)", cabTxt: "Valor Total (Valor + Juros)", dir: true, rel: "azul", html: t => `<b>${formatarMoeda(t.totalCentavos)}</b>`, txt: t => formatarMoeda(t.totalCentavos) }
            ];
        }

        return [
            { cab: "Título", dir: false, html: t => escaparHTML(titulo(t)), txt: titulo },
            { cab: "Vencimento", dir: false, html: venc, txt: venc },
            { cab: "Dias Atraso", dir: true, html: t => String(t.dias), txt: t => String(t.dias) },
            { cab: "Valor Orig.", dir: true, html: t => formatarMoeda(t.valorCentavos), txt: t => formatarMoeda(t.valorCentavos) },
            { cab: `${escaparHTML(encargo)}<br>(Valor Calculado)`, cabTxt: `${encargo} (Valor Calculado)`, dir: true, html: t => `<b>${formatarMoeda(t.jurosCentavos)}</b>`, txt: t => formatarMoeda(t.jurosCentavos) }
        ];
    },

    montarHTML({ tipo, responsavel, dataHora, grupo }) {
        const encargo = Rotulos.encargo(tipo);
        const p = tipo === "Protesto";
        const borda = "border:1px solid #ADB5BD;padding:6px 10px;";
        const fundos = {
            azul: "background-color:#DBEAFE;color:#1A365D;font-weight:bold;",
            ambar: "background-color:#FFF4D6;color:#9A5B00;font-weight:bold;"
        };
        const colunas = this.colunasResumo(tipo);

        const cabecalho = colunas.map(c => `
                <th nowrap="nowrap" valign="middle" style="${borda}white-space:nowrap;background-color:#1A365D;color:#FFFFFF;text-align:${c.dir ? "right" : "left"};">${c.cab}</th>`).join("");

        const linhas = grupo.titulos.map(t => `
            <tr>${colunas.map(c => `
                <td nowrap="nowrap" valign="middle"${c.dir ? ' align="right"' : ""} style="${borda}${fundos[c.rel] || ""}${c.dir ? "text-align:right;" : ""}white-space:nowrap;">${c.html(t)}</td>`).join("")}
            </tr>`).join("");

        /* Protesto: o valor do protesto é valor original + juros. Custas: só o valor das custas. */
        const rotuloTotal = p ? "TOTAL DE PROTESTO" : `TOTAL DE ${encargo.toUpperCase()}`;
        const valorTotal = p ? grupo.subtotalAtualizado : grupo.subtotalJuros;
        const estiloTotal = p
            ? "background-color:#DBEAFE;color:#1A365D;font-size:16px;"
            : "background-color:#FFF4D6;color:#9A5B00;font-size:16px;";

        return `
<div>
    <p>
        <b>🕒 Data e Hora:</b> ${escaparHTML(dataHora)}<br>
        <b>👤 Responsável:</b> ${escaparHTML(responsavel)}<br>
        <b>🏢 Cliente:</b> ${escaparHTML(grupo.razaoSocial)}
    </p>
    <table style="border-collapse:collapse;" border="1" cellpadding="6" cellspacing="0">
        <thead>
            <tr style="background-color:#1A365D;color:#FFFFFF;">${cabecalho}
            </tr>
        </thead>
        <tbody>${linhas}</tbody>
    </table>
    <p style="margin-top:8px;">
        <b>${rotuloTotal}:</b>
        <span style="${estiloTotal}"><b>&nbsp;${formatarMoeda(valorTotal)}&nbsp;</b></span>
    </p>
</div>`;
    },

    /* Versão em texto puro (usada quando o destino não aceita HTML). */
    montarTexto({ tipo, responsavel, dataHora, grupo }) {
        const encargo = Rotulos.encargo(tipo);
        const p = tipo === "Protesto";
        const colunas = this.colunasResumo(tipo);

        const linhas = grupo.titulos.map(t => colunas.map(c => c.txt(t)).join("\t"));

        return textoSimples([
            `🕒 Data e Hora: ${dataHora}`,
            `👤 Responsável: ${responsavel}`,
            `🏢 Cliente: ${grupo.razaoSocial}`,
            "",
            colunas.map(c => c.cabTxt || c.cab).join("\t"),
            ...linhas,
            "",
            p
                ? `TOTAL DE PROTESTO: ${formatarMoeda(grupo.subtotalAtualizado)}`
                : `TOTAL DE ${encargo.toUpperCase()}: ${formatarMoeda(grupo.subtotalJuros)}`
        ].join("\n"));
    },

    /* ---------- área de transferência ---------- */

    async escrever(html, texto) {
        if (navigator.clipboard && navigator.clipboard.write && window.ClipboardItem) {
            try {
                await navigator.clipboard.write([
                    new ClipboardItem({
                        "text/html": new Blob([html], { type: "text/html" }),
                        "text/plain": new Blob([texto], { type: "text/plain" })
                    })
                ]);
                return;
            } catch (erro) {
                /* Cai no método alternativo abaixo. */
            }
        }

        this.copiarAlternativo(html);
    },

    /* Navegadores sem ClipboardItem ou página sem contexto seguro (ex.: HTTP). */
    copiarAlternativo(html) {
        const area = document.createElement("div");

        area.contentEditable = "true";
        area.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0;";
        area.innerHTML = html;
        document.body.appendChild(area);

        const selecao = window.getSelection();
        const faixa = document.createRange();

        faixa.selectNodeContents(area);
        selecao.removeAllRanges();
        selecao.addRange(faixa);

        let copiou = false;

        try {
            copiou = document.execCommand("copy");
        } finally {
            selecao.removeAllRanges();
            area.remove();
        }

        if (!copiou) throw new Error("Falha ao copiar");
    }

};


/* =====================================================
   CONSULTA DE CNPJ

   Fonte: dados abertos da Receita Federal, servidos pela
   BrasilAPI (principal) e Minha Receita (reserva). Não há API
   oficial da Receita liberada para uso direto no navegador.
   Aceita CNPJ numérico e alfanumérico (vigente desde jul/2026).
===================================================== */

function titulo(texto) {
    const menores = ["de", "da", "do", "das", "dos", "e", "em", "para", "por", "com", "ou", "a", "o", "na", "no"];

    return String(texto || "").toLowerCase().split(/(\s+)/).map((p, i) =>
        i > 0 && menores.includes(p)
            ? p
            : p.replace(/^([("\/-]*)([a-zà-ú])/, (m, a, b) => a + b.toUpperCase())
    ).join("");
}

const CNPJ = {

    PESOS1: [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
    PESOS2: [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],

    FONTES: [
        { nome: "Receita Federal (dados abertos) via BrasilAPI", url: c => `https://brasilapi.com.br/api/cnpj/v1/${c}` },
        { nome: "Receita Federal (dados abertos) via Minha Receita", url: c => `https://minhareceita.org/${c}` }
    ],

    limpar(valor) {
        return String(valor || "").toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 14);
    },

    mascara(valor) {
        const c = this.limpar(valor);
        let s = c.slice(0, 2);
        if (c.length > 2) s += "." + c.slice(2, 5);
        if (c.length > 5) s += "." + c.slice(5, 8);
        if (c.length > 8) s += "/" + c.slice(8, 12);
        if (c.length > 12) s += "-" + c.slice(12);
        return s;
    },

    /* Dígito verificador: cada caractere vale (código ASCII − 48), o que
       cobre números e letras (módulo 11 da Receita). */
    dv(base) {
        const pesos = base.length === 12 ? this.PESOS1 : this.PESOS2;
        const soma = [...base].reduce((total, ch, i) => total + (ch.charCodeAt(0) - 48) * pesos[i], 0);
        const resto = soma % 11;
        return resto < 2 ? 0 : 11 - resto;
    },

    calcularDVs(base12) {
        const d1 = this.dv(base12);
        return `${d1}${this.dv(base12 + d1)}`;
    },

    valido(c) {
        return /^[0-9A-Z]{12}[0-9]{2}$/.test(c) && !/^(.)\1+$/.test(c) &&
            this.calcularDVs(c.slice(0, 12)) === c.slice(12);
    },

    /* Tenta cada fonte em ordem; lança "nao-encontrado" ou "indisponivel". */
    async buscar(cnpj) {
        let naoEncontrado = false;

        for (const fonte of this.FONTES) {
            const controle = new AbortController();
            const limite = setTimeout(() => controle.abort(), 12000);

            try {
                const resposta = await fetch(fonte.url(cnpj), {
                    signal: controle.signal,
                    headers: { Accept: "application/json" }
                });

                if (resposta.ok) return { dados: await resposta.json(), fonte: fonte.nome };
                if (resposta.status === 404) naoEncontrado = true;
            } catch (erro) {
                /* tenta a próxima fonte */
            } finally {
                clearTimeout(limite);
            }
        }

        throw new Error(naoEncontrado ? "nao-encontrado" : "indisponivel");
    }

};


const ConsultaCNPJ = {

    CHAVE_HIST: "calculadora-titulos:cnpj-historico",
    ultimo: null,

    iniciar() {
        const campo = get("cnpj-input");

        campo.addEventListener("input", () => {
            campo.value = CNPJ.mascara(campo.value);
            campo.classList.remove("invalid");
        });

        get("form-cnpj").addEventListener("submit", evento => {
            evento.preventDefault();
            this.consultar(campo.value);
        });

        get("cnpj-historico").addEventListener("click", evento => {
            const chip = evento.target.closest("[data-consultar-cnpj]");
            if (chip) this.consultar(chip.dataset.consultarCnpj);
        });

        get("cnpj-resultado").addEventListener("click", evento => {
            const alvo = evento.target.closest("button");
            if (!alvo) return;

            if (alvo.dataset.copiarCnpj) this.copiar(alvo.dataset.copiarCnpj, null, "CNPJ copiado!");
            if (alvo.dataset.copiarValor) this.copiar(alvo.dataset.copiarValor, null, "Copiado!");

            if (alvo.dataset.fechar !== undefined) {
                get("cnpj-resultado").hidden = true;
                get("cnpj-resultado").innerHTML = "";
            }
            if (alvo.dataset.copiarResumo !== undefined) this.copiarResumo();
            if (alvo.dataset.usarRazao !== undefined) this.usarNoCalculo();

            if (alvo.dataset.consultarCnpj) {
                get("cnpj-input").value = CNPJ.mascara(alvo.dataset.consultarCnpj);
                this.consultar(alvo.dataset.consultarCnpj);
            }
        });

        /* Dropdown "Investigar Cliente" */
        const menu = get("menu-investigar");

        get("btn-investigar").addEventListener("click", evento => {
            evento.stopPropagation();
            this.alternarMenu(menu.hidden);
        });

        menu.addEventListener("click", evento => {
            const item = evento.target.closest("[data-fonte]");

            if (item) {
                this.alternarMenu(false);
                this.investigar(item.dataset.fonte);
            }
        });

        document.addEventListener("click", () => this.alternarMenu(false));
        document.addEventListener("keydown", evento => {
            if (evento.key === "Escape") this.alternarMenu(false);
        });

        this.renderizarHistorico();
    },

    mensagem(texto, tipo = "erro") {
        const caixa = get("cnpj-msg");
        caixa.textContent = texto;
        caixa.className = `form-msg ${tipo}`;
        caixa.hidden = !texto;
    },

    async consultar(valor) {
        const cnpj = CNPJ.limpar(valor);
        const campo = get("cnpj-input");

        if (!CNPJ.valido(cnpj)) {
            campo.classList.add("invalid");
            this.mensagem("CNPJ inválido. Confira os 14 caracteres e os dígitos verificadores.");
            return;
        }

        campo.value = CNPJ.mascara(cnpj);
        this.mensagem("");

        const botao = get("btn-cnpj");
        botao.disabled = true;
        get("cnpj-resultado").hidden = false;
        get("cnpj-resultado").innerHTML = `<div class="cnpj-loading"><i></i>Consultando a base da Receita Federal…</div>`;

        try {
            const { dados, fonte } = await CNPJ.buscar(cnpj);

            this.ultimo = dados;
            get("cnpj-resultado").innerHTML = this.html(dados, fonte);
            this.guardarHistorico(cnpj, dados.razao_social);
        } catch (erro) {
            get("cnpj-resultado").hidden = true;
            get("cnpj-resultado").innerHTML = "";
            this.mensagem(erro.message === "nao-encontrado"
                ? "CNPJ com formato válido, mas não localizado na base. Se for recém-aberto, a base pode ainda não ter sido atualizada."
                : "Serviço de consulta indisponível no momento. Tente novamente em instantes.");
        } finally {
            botao.disabled = false;
        }
    },

    /* ---------- histórico ---------- */

    lerHistorico() {
        try {
            const lista = JSON.parse(localStorage.getItem(this.CHAVE_HIST));
            return Array.isArray(lista) ? lista : [];
        } catch (erro) {
            return [];
        }
    },

    guardarHistorico(cnpj, razao) {
        const lista = this.lerHistorico().filter(i => i.cnpj !== cnpj);
        lista.unshift({ cnpj, razao: razao || "" });

        try {
            localStorage.setItem(this.CHAVE_HIST, JSON.stringify(lista.slice(0, 6)));
        } catch (erro) { /* sem armazenamento: segue sem histórico */ }

        this.renderizarHistorico();
    },

    renderizarHistorico() {
        const lista = this.lerHistorico();
        const caixa = get("cnpj-historico");

        caixa.hidden = lista.length === 0;
        caixa.innerHTML = lista.length ? `<small>Consultas recentes</small>` + lista.map(i => `
            <button type="button" class="chip-hist" data-consultar-cnpj="${escaparHTML(i.cnpj)}"
                title="${escaparHTML(i.razao)}">${escaparHTML(CNPJ.mascara(i.cnpj))}
                <span>${escaparHTML(titulo(i.razao).slice(0, 22))}</span></button>`).join("") : "";
    },

    /* ---------- formatadores ---------- */

    data(iso) {
        return iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? formatarData(criarData(iso.slice(0, 10))) : "";
    },

    telefone(texto) {
        const n = String(texto || "").replace(/\D/g, "");
        if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
        if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
        return n;
    },

    idade(iso) {
        const inicio = criarData(iso.slice(0, 10));
        const hoje = new Date();
        let meses = (hoje.getFullYear() - inicio.getFullYear()) * 12 + hoje.getMonth() - inicio.getMonth();
        if (hoje.getDate() < inicio.getDate()) meses--;
        meses = Math.max(0, meses);

        const a = Math.floor(meses / 12);
        const m = meses % 12;

        return { meses, texto: a ? `${a} ano(s)${m ? ` e ${m} mês(es)` : ""}` : `${m} mês(es)` };
    },

    situacao(d) {
        const codigos = { 1: "NULA", 2: "ATIVA", 3: "SUSPENSA", 4: "INAPTA", 8: "BAIXADA" };
        const texto = String(d.descricao_situacao_cadastral || codigos[d.situacao_cadastral] || "NÃO INFORMADA").toUpperCase();
        const classe = texto === "ATIVA" ? "ok" : texto === "SUSPENSA" ? "warn" : "bad";

        return { texto, classe };
    },

    regime(d) {
        if (d.opcao_pelo_mei) return "MEI";
        if (d.opcao_pelo_simples) return "Simples Nacional";
        return "Fora do Simples Nacional";
    },

    endereco(d) {
        const rua = [d.descricao_tipo_de_logradouro, d.logradouro].filter(Boolean).join(" ");
        const cep = String(d.cep || "").replace(/\D/g, "").padStart(8, "0");

        return [
            [rua, d.numero].filter(Boolean).join(", ") + (d.complemento ? ` - ${d.complemento}` : ""),
            d.bairro,
            [d.municipio, d.uf].filter(Boolean).join("/"),
            d.cep ? `CEP ${cep.slice(0, 5)}-${cep.slice(5)}` : ""
        ].filter(Boolean).map(titulo).join(" · ").replace(/Cep /, "CEP ");
    },

    /* Indicadores rápidos para apoiar a decisão de cobrança. */
    alertas(d, sit, idade, capital) {
        const lista = [];

        lista.push(sit.classe === "ok"
            ? { t: "ok", x: "Situação cadastral ATIVA na Receita Federal." }
            : { t: sit.classe, x: `Situação cadastral ${sit.texto}` +
                (d.data_situacao_cadastral ? ` desde ${this.data(d.data_situacao_cadastral)}` : "") +
                (d.descricao_motivo_situacao_cadastral && d.descricao_motivo_situacao_cadastral !== "SEM MOTIVO"
                    ? `. Motivo: ${titulo(d.descricao_motivo_situacao_cadastral)}.` : ".") });

        if (d.situacao_especial) lista.push({ t: "warn", x: `Situação especial registrada: ${titulo(d.situacao_especial)}.` });

        if (idade) {
            lista.push(idade.meses < 12
                ? { t: "warn", x: `Empresa aberta há apenas ${idade.texto}: histórico comercial curto.` }
                : { t: "ok", x: `Empresa com ${idade.texto} de atividade.` });
        }

        if (capital <= 0) lista.push({ t: "warn", x: "Capital social zerado ou não informado." });
        else if (capital < 10000) lista.push({ t: "info", x: `Capital social baixo (${formatarMoeda(Math.round(capital * 100))}): avalie o risco em valores altos.` });

        if (Number(d.identificador_matriz_filial) === 2) {
            lista.push({ t: "info", x: "Este CNPJ é de uma filial. Verifique também a matriz.", matriz: true });
        }

        const socios = Array.isArray(d.qsa) ? d.qsa.length : 0;
        if (socios) lista.push({ t: "info", x: `${socios} sócio(s)/administrador(es) no quadro societário.` });

        return lista;
    },

    /* ---------- tela ---------- */

    html(d, fonte) {
        const cnpj = CNPJ.limpar(d.cnpj);
        const cnpjMasc = CNPJ.mascara(cnpj);
        const sit = this.situacao(d);
        const idade = d.data_inicio_atividade ? this.idade(d.data_inicio_atividade) : null;
        const capital = Number(d.capital_social) || 0;
        const filial = Number(d.identificador_matriz_filial) === 2;
        const porte = titulo(d.descricao_porte || d.porte || "Não informado");
        const matrizCnpj = filial ? cnpj.slice(0, 8) + "0001" + CNPJ.calcularDVs(cnpj.slice(0, 8) + "0001") : "";

        const linha = (rotulo, valor, bruto = false) => valor
            ? `<div><dt>${rotulo}</dt><dd>${bruto ? valor : escaparHTML(valor)}</dd></div>` : "";

        const caixa = (tituloCaixa, conteudo, larga = false) => `
            <section class="cnpj-box${larga ? " larga" : ""}"><h3>${tituloCaixa}</h3>${conteudo}</section>`;

        const alertas = this.alertas(d, sit, idade, capital).map(a => `
            <li class="${a.t}"><span></span><p>${escaparHTML(a.x)}${a.matriz
                ? ` <button type="button" class="link" data-consultar-cnpj="${matrizCnpj}">Consultar matriz</button>` : ""}</p></li>`).join("");

        const fones = [d.ddd_telefone_1, d.ddd_telefone_2]
            .map(t => String(t || "").replace(/\D/g, "")).filter(n => n.length >= 10);
        const email = d.email ? String(d.email).trim().toLowerCase() : "";

        const linhaContato = (rotulo, valor, extra = "") => `
            <div class="contato-linha">
                <label>${rotulo}</label>
                <input type="text" readonly value="${escaparHTML(valor)}" aria-label="${rotulo}">
                <button type="button" class="btn-mini btn-teams" data-copiar-valor="${escaparHTML(valor)}">Copiar</button>
                ${extra}
            </div>`;

        const contatos = `
        <section class="cnpj-contatos">
            <div class="cnpj-contatos-head">
                <h3>Contatos para cobrança</h3>
                <small>Dados do cadastro da Receita: costumam ser os do contador.</small>
            </div>
            ${fones.map((n, i) => linhaContato(
                fones.length > 1 ? `Telefone ${i + 1}` : "Telefone",
                this.telefone(n),
                n.length === 11 && n[2] === "9"
                    ? `<a class="btn-mini" target="_blank" rel="noopener noreferrer" href="https://wa.me/55${n}">WhatsApp</a>` : ""
            )).join("")}
            ${email ? linhaContato("E-mail", email,
                `<a class="btn-mini" href="mailto:${escaparHTML(email)}">Enviar</a>`) : ""}
            ${!fones.length && !email
                ? `<p class="cnpj-vazio">Nenhum telefone ou e-mail informado na base. Use "Investigar Cliente" para buscar contatos.</p>` : ""}
        </section>`;
        const enderecoTxt = this.endereco(d);
        const mapa = enderecoTxt
            ? `<a class="link" target="_blank" rel="noopener noreferrer" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enderecoTxt)}">${escaparHTML(enderecoTxt)} ↗</a>` : "";

        const secundarias = Array.isArray(d.cnaes_secundarios) ? d.cnaes_secundarios.filter(c => c.codigo) : [];

        const atividades = `
            <dl>${linha("Principal", d.cnae_fiscal ? `${d.cnae_fiscal} — ${titulo(d.cnae_fiscal_descricao)}` : "")}</dl>
            ${secundarias.length ? `<details><summary>${secundarias.length} atividade(s) secundária(s)</summary><ul>${
                secundarias.map(c => `<li><b>${escaparHTML(c.codigo)}</b> ${escaparHTML(titulo(c.descricao))}</li>`).join("")}</ul></details>` : ""}`;

        const socios = Array.isArray(d.qsa) && d.qsa.length ? `
            <div class="tabela-wrap"><table class="tabela compacta">
                <thead><tr><th>Nome</th><th>Qualificação</th><th>Entrada</th><th>Faixa etária</th></tr></thead>
                <tbody>${d.qsa.map(s => `<tr>
                    <td>${escaparHTML(titulo(s.nome_socio))}</td>
                    <td>${escaparHTML(titulo(s.qualificacao_socio))}</td>
                    <td>${escaparHTML(this.data(s.data_entrada_sociedade))}</td>
                    <td>${escaparHTML(s.faixa_etaria ? titulo(s.faixa_etaria) : "—")}</td></tr>`).join("")}</tbody>
            </table></div>` : `<p class="cnpj-vazio">Nenhum sócio informado na base.</p>`;

        return `
        <section class="cnpj-hero">
            <div class="cnpj-hero-top">
                <div>
                    <small>RAZÃO SOCIAL</small>
                    <h2>${escaparHTML(d.razao_social)}</h2>
                    ${d.nome_fantasia ? `<p>Nome fantasia: <b>${escaparHTML(titulo(d.nome_fantasia))}</b></p>` : ""}
                </div>
                <span class="sit ${sit.classe}">${escaparHTML(sit.texto)}</span>
            </div>
            <div class="cnpj-hero-bottom">
                <button type="button" class="cnpj-copy" data-copiar-cnpj="${escaparHTML(cnpjMasc)}" title="Copiar CNPJ">
                    ${escaparHTML(cnpjMasc)} <em>copiar</em></button>
                <span class="chip">${filial ? "Filial" : "Matriz"}</span>
                <span class="chip">${escaparHTML(porte)}</span>
            </div>
        </section>

        ${contatos}

        <div class="cnpj-kpis">
            <div><small>TEMPO DE ATIVIDADE</small><strong>${idade ? escaparHTML(idade.texto) : "—"}</strong><span>${d.data_inicio_atividade ? "Desde " + this.data(d.data_inicio_atividade) : ""}</span></div>
            <div><small>CAPITAL SOCIAL</small><strong>${formatarMoeda(Math.round(capital * 100))}</strong><span>Declarado à Receita</span></div>
            <div><small>PORTE</small><strong>${escaparHTML(porte)}</strong><span>${filial ? "Filial" : "Matriz"}</span></div>
            <div><small>REGIME</small><strong>${escaparHTML(this.regime(d))}</strong><span>${d.data_opcao_pelo_simples ? "Opção em " + this.data(d.data_opcao_pelo_simples) : "Tributação"}</span></div>
        </div>

        <section class="card">
            <div class="title"><div class="number">!</div><div><h2>Análise rápida</h2><p>Pontos de atenção para decidir a cobrança.</p></div></div>
            <ul class="cnpj-alertas">${alertas}</ul>
        </section>

        <div class="cnpj-grid">
            ${caixa("Dados cadastrais", `<dl>
                ${linha("Natureza jurídica", titulo(d.natureza_juridica))}
                ${linha("Abertura", this.data(d.data_inicio_atividade))}
                ${linha("Situação", sit.texto + (d.data_situacao_cadastral ? ` desde ${this.data(d.data_situacao_cadastral)}` : ""))}
                ${linha("Motivo", d.descricao_motivo_situacao_cadastral && d.descricao_motivo_situacao_cadastral !== "SEM MOTIVO" ? titulo(d.descricao_motivo_situacao_cadastral) : "")}
                ${linha("Situação especial", d.situacao_especial ? titulo(d.situacao_especial) : "")}
                ${linha("Simples Nacional", d.opcao_pelo_simples ? "Optante" + (d.data_opcao_pelo_simples ? ` desde ${this.data(d.data_opcao_pelo_simples)}` : "") : "Não optante")}
                ${linha("MEI", d.opcao_pelo_mei ? "Sim" : "Não")}</dl>`)}
            ${caixa("Endereço", `<dl>${linha("Endereço", mapa, true)}</dl>`)}
            ${caixa("Atividade econômica", atividades, true)}
            ${caixa("Quadro societário", socios, true)}
        </div>

        <section class="card cnpj-acoes">
            <div>
                <strong>Conferência oficial</strong>
                <p>Fonte: ${escaparHTML(fonte)}. A base pode ter defasagem de alguns dias em relação ao cadastro vivo.</p>
            </div>
            <div class="cnpj-botoes">
                <button type="button" class="btn-mini btn-teams" data-usar-razao>Usar no cálculo</button>
                <button type="button" class="btn-mini btn-teams" data-copiar-resumo>Copiar resumo</button>
                <button type="button" class="btn-mini" data-fechar>Fechar consulta</button>
                <a class="btn-mini" target="_blank" rel="noopener noreferrer" href="https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/Cnpjreva_Solicitacao.asp">Comprovante da Receita ↗</a>
                <a class="btn-mini" target="_blank" rel="noopener noreferrer" href="https://resolve.cenprot.org.br/">Consultar protestos ↗</a>
            </div>
        </section>`;
    },

    /* ---------- dossiê rápido (atalhos gratuitos, sem login) ---------- */

    alternarMenu(abrir) {
        get("menu-investigar").hidden = !abrir;
        get("btn-investigar").setAttribute("aria-expanded", String(abrir));
    },

    /* Copia texto puro; usa um campo temporário se a Clipboard API não estiver disponível. */
    async copiarTexto(texto) {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(texto);
                return true;
            }
        } catch (erro) { /* tenta o método alternativo */ }

        const campo = document.createElement("textarea");
        campo.value = texto;
        campo.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0;";
        document.body.appendChild(campo);
        campo.select();

        let copiou = false;

        try {
            copiou = document.execCommand("copy");
        } catch (erro) { /* falhou */ }

        campo.remove();
        return copiou;
    },

    investigar(fonte) {
        /* Mantém só os caracteres do CNPJ (sem pontos, barra e traço).
           Para o CNPJ alfanumérico, as letras são preservadas. */
        const cnpj = CNPJ.limpar(get("cnpj-input").value);

        if (!CNPJ.valido(cnpj)) {
            get("cnpj-input").classList.add("invalid");
            get("cnpj-input").focus();
            this.mensagem("Digite um CNPJ válido para investigar o cliente.");
            return;
        }

        this.mensagem("");

        const destinos = {
            casadosdados: `https://casadosdados.com.br/solucao/cnpj/${cnpj}`,
            cnpjbiz: `https://cnpj.biz/${cnpj}`,
            jusbrasil: `https://www.jusbrasil.com.br/consulta-processual/busca?q=${cnpj}`,
            protestos: "https://pesquisaprotesto.com.br/"
        };

        if (!destinos[fonte]) return;

        /* A cópia começa antes de abrir a nova aba, ainda dentro do clique. */
        if (fonte === "protestos") {
            this.copiarTexto(cnpj).then(copiou => Toast.mostrar(
                copiou ? "CNPJ copiado! Cole no site de Protestos" : "Não foi possível copiar. Digite o CNPJ no site de Protestos.",
                copiou ? "ok" : "aviso"
            ));
        }

        window.open(destinos[fonte], "_blank", "noopener,noreferrer");
    },

    /* ---------- ações ---------- */

    async copiar(texto, html, aviso) {
        try {
            await Teams.escrever(html || escaparHTML(texto), texto);
            Toast.mostrar(aviso, "ok");
        } catch (erro) {
            Toast.mostrar("Não foi possível copiar. Verifique as permissões do navegador.", "erro");
        }
    },

    copiarResumo() {
        const d = this.ultimo;
        if (!d) return;

        const sit = this.situacao(d);
        const idade = d.data_inicio_atividade ? this.idade(d.data_inicio_atividade).texto : "—";
        const linhas = [
            ["🏢 Empresa", d.razao_social],
            ["🔢 CNPJ", CNPJ.mascara(d.cnpj)],
            ["📌 Situação", sit.texto + (d.data_situacao_cadastral ? ` desde ${this.data(d.data_situacao_cadastral)}` : "")],
            ["📅 Abertura", `${this.data(d.data_inicio_atividade)} (${idade})`],
            ["💰 Capital social", formatarMoeda(Math.round((Number(d.capital_social) || 0) * 100))],
            ["🧾 Regime", this.regime(d)],
            ["📞 Telefone", [d.ddd_telefone_1, d.ddd_telefone_2].map(t => this.telefone(t)).filter(Boolean).join(" · ")],
            ["✉️ E-mail", d.email ? String(d.email).trim().toLowerCase() : ""],
            ["📍 Endereço", this.endereco(d)],
            ["🕒 Consultado em", new Date().toLocaleString("pt-BR")]
        ].filter(l => l[1]);

        this.copiar(
            textoSimples(linhas.map(l => `${l[0]}: ${l[1]}`).join("\n")),
            `<p>${linhas.map(l => `<b>${l[0]}:</b> ${escaparHTML(l[1])}`).join("<br>")}</p>`,
            "Resumo do CNPJ copiado!"
        );
    },

    usarNoCalculo() {
        const d = this.ultimo;
        if (!d) return;

        get("t-razao").value = d.razao_social;
        get("form-titulo").scrollIntoView({ behavior: "smooth", block: "start" });
        get("t-codigo").focus({ preventScroll: true });
        Toast.mostrar("Razão social enviada para o cálculo. Informe o código do cliente.", "ok");
    }

};


/* =====================================================
   TEMA CLARO / ESCURO (preferência salva no localStorage)
   O tema inicial é aplicado por um script no <head>, antes da pintura.
===================================================== */

const Tema = {

    CHAVE: "calculadora-titulos:tema",

    iniciar() {
        this.aplicar(document.documentElement.dataset.theme === "dark" ? "dark" : "light");

        get("btn-tema").addEventListener("click", () => {
            const novo = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
            this.aplicar(novo);

            try {
                localStorage.setItem(this.CHAVE, novo);
            } catch (erro) { /* sem armazenamento: vale só nesta sessão */ }
        });
    },

    aplicar(tema) {
        const botao = get("btn-tema");
        const rotulo = tema === "dark" ? "Mudar para Modo Claro" : "Mudar para Modo Escuro";

        document.documentElement.dataset.theme = tema;
        botao.setAttribute("aria-pressed", String(tema === "dark"));
        botao.setAttribute("aria-label", rotulo);
        botao.title = rotulo;
    }

};
