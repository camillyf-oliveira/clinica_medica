/*
 * app.js - Interface, navegacao e carregamento.
 *
 * Responsabilidades:
 *   - trocar de tela, sempre com indicador de carregamento (RNF01);
 *   - proteger as telas internas quando nao ha sessao (RN01);
 *   - montar as listas e os detalhes a partir do DB;
 *   - validar formularios e exibir o erro junto ao campo (RNF02).
 *
 * Nenhuma escrita no localStorage acontece aqui - isso e papel do db.js (RNF06).
 */

(function () {
    'use strict';

    /* ------------------------------------------------------------------
     * Estado da interface
     * ------------------------------------------------------------------ */

    const estado = {
        telaAtual: 'tela-login',
        filtroConsultas: 'todas',
        filtroExames: 'todos',
        consultaAberta: null,
        exameAberto: null,
        consultaParaCancelar: null,
        // Rascunho do fluxo de agendamento.
        agendamento: { passo: 1, especialidadeId: null, medicoId: null, data: null, hora: null }
    };

    const TELAS_PROTEGIDAS = [
        'tela-inicio', 'tela-agendar', 'tela-consultas',
        'tela-consulta-detalhe', 'tela-exames', 'tela-exame-detalhe', 'tela-perfil'
    ];

    const PASSOS = ['Especialidade', 'Profissional', 'Data', 'Horário', 'Confirmação', 'Concluído'];

    /* ------------------------------------------------------------------
     * Carregamento (RNF01)
     * ------------------------------------------------------------------ */

    const overlay = document.getElementById('loading');
    const overlayTexto = document.getElementById('loading-texto');

    function esperar(ms) {
        return new Promise(function (resolve) { setTimeout(resolve, ms); });
    }

    /*
     * Envolve uma acao no indicador de carregamento de tela cheia.
     * O atraso e artificial: simula a latencia que existiria em uma
     * chamada ao servidor, mantendo o total bem abaixo dos 3 s do RNF01.
     */
    async function comCarregamento(acao, opcoes) {
        const config = opcoes || {};
        const ms = config.ms || 420;

        overlayTexto.textContent = config.texto || 'Carregando';
        overlay.classList.add('active');

        await esperar(ms);

        try {
            await acao();
        } finally {
            overlay.classList.remove('active');
        }
    }

    /* Coloca um botao em estado de carregamento durante a "requisicao". */
    async function comBotao(botao, acao, ms) {
        if (!botao) { return acao(); }

        botao.classList.add('is-loading');
        botao.disabled = true;

        await esperar(ms || 700);

        try {
            return await acao();
        } finally {
            botao.classList.remove('is-loading');
            botao.disabled = false;
        }
    }

    /* ------------------------------------------------------------------
     * Mensagens e modal
     * ------------------------------------------------------------------ */

    const areaToasts = document.getElementById('toasts');

    const ICONE_TOAST = {
        sucesso: 'check-circle',
        erro: 'alert-circle',
        aviso: 'alert-triangle',
        info: 'info'
    };

    function avisar(mensagem, tipo) {
        const categoria = tipo || 'info';
        const toast = document.createElement('div');

        toast.className = 'toast toast-' + categoria;
        toast.innerHTML = Icones.marcar(ICONE_TOAST[categoria], 'icon-sm') +
                          '<span>' + escapar(mensagem) + '</span>';

        areaToasts.appendChild(toast);
        Icones.aplicar();

        setTimeout(function () {
            toast.classList.add('saindo');
            setTimeout(function () { toast.remove(); }, 200);
        }, 3200);
    }

    const modalCancelar = document.getElementById('modal-cancelar');

    function abrirModal() { modalCancelar.classList.add('active'); }
    function fecharModal() { modalCancelar.classList.remove('active'); }

    /* ------------------------------------------------------------------
     * Utilidades de formatacao
     * ------------------------------------------------------------------ */

    const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const DIAS_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                   'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const MESES_CURTO = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
                         'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    // Evita que texto vindo do cadastro seja interpretado como HTML.
    function escapar(texto) {
        return String(texto === undefined || texto === null ? '' : texto)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function dataPorExtenso(iso) {
        const d = DB.deISO(iso);
        return DIAS[d.getDay()] + ', ' + d.getDate() + ' de ' + MESES[d.getMonth()] + ' de ' + d.getFullYear();
    }

    function dataCurta(iso) {
        const d = DB.deISO(iso);
        return String(d.getDate()).padStart(2, '0') + '/' +
               String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
    }

    function iniciaisDe(nome) {
        const partes = String(nome || '').trim().split(/\s+/).filter(function (p) { return p.length > 2; });
        const base = partes.length ? partes : String(nome || '?').trim().split(/\s+/);
        const primeira = (base[0] || '?')[0];
        const ultima = base.length > 1 ? base[base.length - 1][0] : '';
        return (primeira + ultima).toUpperCase();
    }

    function primeiroNome(nome) {
        return String(nome || '').trim().split(/\s+/)[0];
    }

    function formatarCPF(cpf) {
        const d = String(cpf || '').replace(/\D/g, '');
        if (d.length !== 11) { return cpf; }
        return d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-' + d.slice(9);
    }

    function classeStatus(status) {
        const mapa = {
            'Agendada': 'badge-agendada',
            'Realizada': 'badge-realizada',
            'Cancelada': 'badge-cancelada',
            'Pronto': 'badge-pronto',
            'Em Análise': 'badge-analise'
        };
        return mapa[status] || 'badge-realizada';
    }

    function iconeStatus(status) {
        const mapa = {
            'Agendada': 'calendar-check',
            'Realizada': 'check',
            'Cancelada': 'x',
            'Pronto': 'file-check',
            'Em Análise': 'clock'
        };
        return mapa[status] || 'circle';
    }

    function badge(status) {
        return '<span class="badge ' + classeStatus(status) + '">' +
               Icones.marcar(iconeStatus(status), 'icon-sm') + escapar(status) + '</span>';
    }

    function linhaDetalhe(rotulo, valor) {
        return '<div class="detail-row"><dt>' + escapar(rotulo) + '</dt><dd>' + valor + '</dd></div>';
    }

    function vazio(icone, titulo, texto, acao, rotuloAcao) {
        return '<div class="empty-state">' +
                   '<div class="empty-icon">' + Icones.marcar(icone, 'icon-lg') + '</div>' +
                   '<p class="empty-title">' + escapar(titulo) + '</p>' +
                   '<p>' + escapar(texto) + '</p>' +
                   (acao ? '<button class="btn btn-outline btn-sm" data-acao="' + acao + '">' +
                           '<span class="btn-label">' + escapar(rotuloAcao) + '</span></button>' : '') +
               '</div>';
    }

    /* Esqueleto exibido enquanto a lista "carrega" (RNF01). */
    function esqueleto(quantidade) {
        let html = '';
        for (let i = 0; i < (quantidade || 3); i++) {
            html += '<div class="skeleton skeleton-card"></div>';
        }
        return html;
    }

    /* ------------------------------------------------------------------
     * Navegacao
     * ------------------------------------------------------------------ */

    const ITENS_NAV = [
        { id: 'inicio',    tela: 'tela-inicio',    icone: 'home',            rotulo: 'Inicio' },
        { id: 'consultas', tela: 'tela-consultas', icone: 'calendar-days',   rotulo: 'Consultas' },
        { id: 'exames',    tela: 'tela-exames',    icone: 'clipboard-list',  rotulo: 'Exames' },
        { id: 'perfil',    tela: 'tela-perfil',    icone: 'user-round',      rotulo: 'Perfil' }
    ];

    function montarNavegacao() {
        document.querySelectorAll('.bottom-nav').forEach(function (nav) {
            const atual = nav.getAttribute('data-nav');

            nav.innerHTML = ITENS_NAV.map(function (item) {
                return '<button class="nav-item' + (item.id === atual ? ' active' : '') +
                       '" data-ir-tela="' + item.tela + '">' +
                       Icones.marcar(item.icone, 'icon') +
                       '<span>' + item.rotulo + '</span></button>';
            }).join('');
        });
    }

    /* Troca de tela, sempre passando pelo indicador de carregamento. */
    function irPara(telaId, opcoes) {
        const config = opcoes || {};

        // RN01 - telas internas exigem sessao ativa.
        if (TELAS_PROTEGIDAS.indexOf(telaId) !== -1 && !DB.validarRN01_sessaoAtiva()) {
            avisar('Sua sessão expirou. Entre novamente.', 'aviso');
            return trocar('tela-login');
        }

        DB.renovarSessao();

        return comCarregamento(function () {
            trocar(telaId);
            if (config.aoAbrir) { config.aoAbrir(); }
        }, { texto: config.texto, ms: config.ms });
    }

    function trocar(telaId) {
        document.querySelectorAll('.screen').forEach(function (tela) {
            tela.classList.remove('active');
        });

        const alvo = document.getElementById(telaId);
        if (!alvo) { return; }

        alvo.classList.add('active');
        alvo.scrollTop = 0;

        const corpo = alvo.querySelector('.screen-body');
        if (corpo) { corpo.scrollTop = 0; }

        estado.telaAtual = telaId;
        Icones.aplicar();
    }

    /* ------------------------------------------------------------------
     * Formularios
     * ------------------------------------------------------------------ */

    function limparErros(formulario) {
        formulario.querySelectorAll('.field').forEach(function (campo) {
            campo.classList.remove('has-error');
        });
    }

    /* RNF02 - o erro aparece junto ao campo que o originou. */
    function marcarErro(formulario, nomeCampo, mensagem) {
        const campo = formulario.querySelector('[data-campo="' + nomeCampo + '"]');

        if (!campo) {
            avisar(mensagem, 'erro');
            return;
        }

        campo.classList.add('has-error');
        campo.querySelector('.field-error-text').textContent = mensagem;

        const entrada = campo.querySelector('input, select');
        if (entrada) { entrada.focus(); }
    }

    function valores(formulario) {
        const dados = {};
        new FormData(formulario).forEach(function (valor, chave) {
            dados[chave] = typeof valor === 'string' ? valor.trim() : valor;
        });
        return dados;
    }

    /* Mascaras de digitacao. */
    function mascaraCPF(valor) {
        const d = valor.replace(/\D/g, '').slice(0, 11);
        if (d.length <= 3)  { return d; }
        if (d.length <= 6)  { return d.slice(0, 3) + '.' + d.slice(3); }
        if (d.length <= 9)  { return d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6); }
        return d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-' + d.slice(9);
    }

    function mascaraTelefone(valor) {
        const d = valor.replace(/\D/g, '').slice(0, 11);
        if (d.length <= 2)  { return d.length ? '(' + d : d; }
        if (d.length <= 6)  { return '(' + d.slice(0, 2) + ') ' + d.slice(2); }
        if (d.length <= 10) { return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6); }
        return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
    }

    function aplicarMascaras() {
        ['login-cpf', 'cad-cpf'].forEach(function (id) {
            const campo = document.getElementById(id);
            campo.addEventListener('input', function () {
                campo.value = mascaraCPF(campo.value);
            });
        });

        const telefone = document.getElementById('cad-telefone');
        telefone.addEventListener('input', function () {
            telefone.value = mascaraTelefone(telefone.value);
        });
    }

    /* ------------------------------------------------------------------
     * RF02 / RF01 - entrar e cadastrar
     * ------------------------------------------------------------------ */

    async function entrar(botao) {
        const formulario = document.getElementById('form-login');
        limparErros(formulario);

        const dados = valores(formulario);

        await comBotao(botao, async function () {
            const resposta = DB.autenticar(dados.cpf, dados.senha);

            if (!resposta.ok) {
                marcarErro(formulario, resposta.campo, resposta.mensagem);
                return;
            }

            formulario.reset();
            await irPara('tela-inicio', { aoAbrir: renderInicio, texto: 'Entrando' });
            avisar('Bem-vindo, ' + primeiroNome(resposta.usuario.nome) + '.', 'sucesso');
        });
    }

    async function cadastrar(botao) {
        const formulario = document.getElementById('form-cadastro');
        limparErros(formulario);

        const dados = valores(formulario);

        await comBotao(botao, async function () {
            const resposta = DB.criarUsuario(dados);

            if (!resposta.ok) {
                marcarErro(formulario, resposta.campo, resposta.mensagem);
                return;
            }

            // Cadastro concluido ja inicia a sessao.
            DB.autenticar(resposta.usuario.cpf, resposta.usuario.senha);
            formulario.reset();

            await irPara('tela-inicio', { aoAbrir: renderInicio, texto: 'Criando sua conta' });
            avisar('Cadastro realizado. Bem-vindo!', 'sucesso');
        });
    }

    async function sair(botao) {
        await comBotao(botao, async function () {
            DB.encerrarSessao();
            await irPara('tela-login', { texto: 'Saindo' });
            avisar('Sessão encerrada.', 'info');
        }, 500);
    }

    /* ------------------------------------------------------------------
     * RF10 - tela inicial
     * ------------------------------------------------------------------ */

    function saudacao() {
        const hora = new Date().getHours();
        if (hora < 12) { return 'Bom dia'; }
        if (hora < 18) { return 'Boa tarde'; }
        return 'Boa noite';
    }

    function renderInicio() {
        const usuario = DB.usuarioLogado();
        if (!usuario) { return; }

        document.getElementById('home-saudacao').textContent = saudacao();
        document.getElementById('home-nome').textContent = primeiroNome(usuario.nome);

        const agendadas = DB.contarAgendadas(usuario.id);
        document.getElementById('home-contador').textContent =
            agendadas === 0 ? 'Nenhuma agendada'
                            : agendadas + (agendadas === 1 ? ' agendada' : ' agendadas');

        // RF10 - destaque da proxima consulta.
        const proxima = DB.proximaConsulta(usuario.id);
        const destino = document.getElementById('home-proxima');

        if (!proxima) {
            destino.innerHTML =
                '<div class="highlight-card">' +
                    '<div class="highlight-label">' + Icones.marcar('calendar-plus', 'icon-sm') + 'Nenhuma consulta marcada</div>' +
                    '<p class="text-muted" style="margin-bottom: 12px;">Você não possui consultas agendadas no momento.</p>' +
                    '<button class="btn btn-outline btn-sm" data-acao="ir-agendar">' +
                        '<span class="btn-label">Agendar agora</span></button>' +
                '</div>';
        } else {
            const medico = medicoPorId(proxima.medicoId);
            const especialidade = especialidadePorId(proxima.especialidadeId);

            // Somente <span> dentro do <button>, para manter a marcacao valida.
            destino.innerHTML =
                '<button class="highlight-card" data-abrir-consulta="' + proxima.id + '">' +
                    '<span class="highlight-label">' + Icones.marcar('bell', 'icon-sm') + 'Próxima consulta</span>' +
                    '<span class="highlight-main">' + escapar(medico ? medico.nome : 'Profissional') + '</span>' +
                    '<span class="highlight-sub">' + escapar(especialidade ? especialidade.nome : '') + '</span>' +
                    '<span class="highlight-meta">' +
                        '<span>' + Icones.marcar('calendar', 'icon-sm') + dataCurta(proxima.data) + '</span>' +
                        '<span>' + Icones.marcar('clock', 'icon-sm') + proxima.hora + '</span>' +
                    '</span>' +
                '</button>';
        }

        document.getElementById('unidade-nome').textContent = CATALOGO.unidade.nome;
        document.getElementById('unidade-endereco').textContent = CATALOGO.unidade.endereco;
        document.getElementById('unidade-telefone').textContent = CATALOGO.unidade.telefone;

        Icones.aplicar();
    }

    /* ------------------------------------------------------------------
     * RF04 - fluxo de agendamento
     * ------------------------------------------------------------------ */

    function reiniciarAgendamento() {
        estado.agendamento = { passo: 1, especialidadeId: null, medicoId: null, data: null, hora: null };
        renderPasso();
    }

    function renderPasso() {
        const passo = estado.agendamento.passo;

        document.querySelectorAll('#tela-agendar .step').forEach(function (bloco) {
            bloco.classList.toggle('active', Number(bloco.getAttribute('data-passo')) === passo);
        });

        const stepper = document.getElementById('agendar-stepper');
        const rodapeConfirmar = document.getElementById('agendar-footer');
        const rodapeSucesso = document.getElementById('sucesso-footer');

        // O passo 6 e a tela de sucesso: sem barra de progresso.
        stepper.hidden = passo > 5;
        rodapeConfirmar.hidden = passo !== 5;
        rodapeSucesso.hidden = passo !== 6;

        if (passo <= 5) {
            document.getElementById('stepper-passo').textContent = 'Passo ' + Math.min(passo, 4) + ' de 4';
            document.getElementById('stepper-titulo').textContent = PASSOS[passo - 1];
            document.getElementById('stepper-fill').style.width = Math.min(passo * 25, 100) + '%';
        }

        if (passo === 1) { renderEspecialidades(); }
        if (passo === 2) { renderMedicos(); }
        if (passo === 3) { renderDatas(); }
        if (passo === 4) { renderHorarios(); }
        if (passo === 5) { renderRevisao(); }

        Icones.aplicar();
    }

    function renderEspecialidades() {
        document.getElementById('lista-especialidades').innerHTML =
            CATALOGO.especialidades.map(function (e) {
                const selecionada = estado.agendamento.especialidadeId === e.id;
                return '<button class="option-card' + (selecionada ? ' selected' : '') +
                           '" data-especialidade="' + e.id + '">' +
                           '<span class="option-icon">' + Icones.marcar(e.icone, 'icon') + '</span>' +
                           '<span class="option-body">' +
                               '<span class="option-title">' + escapar(e.nome) + '</span>' +
                               '<span class="option-sub">' + escapar(e.descricao) + '</span>' +
                           '</span>' +
                           Icones.marcar('chevron-right', 'icon-sm') +
                       '</button>';
            }).join('');
    }

    function renderMedicos() {
        const medicos = medicosPorEspecialidade(estado.agendamento.especialidadeId);

        document.getElementById('lista-medicos').innerHTML =
            medicos.map(function (m) {
                const selecionado = estado.agendamento.medicoId === m.id;
                return '<button class="option-card' + (selecionado ? ' selected' : '') +
                           '" data-medico="' + m.id + '">' +
                           '<span class="avatar">' + escapar(iniciaisDe(m.nome)) + '</span>' +
                           '<span class="option-body">' +
                               '<span class="option-title">' + escapar(m.nome) + '</span>' +
                               '<span class="option-sub">' + escapar(m.crm) + '</span>' +
                           '</span>' +
                           Icones.marcar('chevron-right', 'icon-sm') +
                       '</button>';
            }).join('');
    }

    /* RN04 - o seletor so oferece datas dentro da janela permitida. */
    function renderDatas() {
        const datas = DB.datasDisponiveis(30);

        document.getElementById('lista-datas').innerHTML =
            datas.map(function (iso) {
                const d = DB.deISO(iso);
                const selecionada = estado.agendamento.data === iso;
                return '<button class="date-chip' + (selecionada ? ' selected' : '') +
                           '" data-data="' + iso + '">' +
                           '<span class="dow">' + DIAS_CURTO[d.getDay()] + '</span>' +
                           '<span class="day">' + d.getDate() + '</span>' +
                           '<span class="month">' + MESES_CURTO[d.getMonth()] + '</span>' +
                       '</button>';
            }).join('');
    }

    /* RN05 - horarios ocupados vem desabilitados. */
    function renderHorarios() {
        const agenda = estado.agendamento;
        const horarios = DB.horariosDoDia(agenda.medicoId, agenda.data);

        document.getElementById('lista-horarios').innerHTML =
            horarios.map(function (h) {
                const selecionado = agenda.hora === h.hora;
                return '<button class="time-chip' + (selecionado ? ' selected' : '') +
                           '" data-hora="' + h.hora + '"' + (h.livre ? '' : ' disabled') + '>' +
                           h.hora +
                       '</button>';
            }).join('');
    }

    function renderRevisao() {
        const agenda = estado.agendamento;
        const medico = medicoPorId(agenda.medicoId);
        const especialidade = especialidadePorId(agenda.especialidadeId);

        document.getElementById('revisao-dados').innerHTML =
            linhaDetalhe('Especialidade', escapar(especialidade ? especialidade.nome : '')) +
            linhaDetalhe('Profissional', escapar(medico ? medico.nome : '')) +
            linhaDetalhe('CRM', escapar(medico ? medico.crm : '')) +
            linhaDetalhe('Data', escapar(dataPorExtenso(agenda.data))) +
            linhaDetalhe('Horário', escapar(agenda.hora)) +
            linhaDetalhe('Local', escapar(CATALOGO.unidade.nome));

    }

    /* Avanca no fluxo com carregamento, como se consultasse a agenda. */
    function avancarPasso(passo, texto) {
        return comCarregamento(function () {
            estado.agendamento.passo = passo;
            renderPasso();
        }, { texto: texto, ms: 380 });
    }

    function voltarAgendamento() {
        const passo = estado.agendamento.passo;

        if (passo <= 1) {
            return irPara('tela-inicio', { aoAbrir: renderInicio });
        }
        if (passo === 6) {
            return irPara('tela-inicio', { aoAbrir: renderInicio });
        }
        return avancarPasso(passo - 1, 'Voltando');
    }

    async function confirmarAgendamento(botao) {
        const usuario = DB.usuarioLogado();
        if (!usuario) {
            avisar('Sua sessão expirou. Entre novamente.', 'aviso');
            return irPara('tela-login');
        }

        const agenda = estado.agendamento;

        await comBotao(botao, async function () {
            const resposta = DB.criarConsulta({
                usuarioId: usuario.id,
                especialidadeId: agenda.especialidadeId,
                medicoId: agenda.medicoId,
                data: agenda.data,
                hora: agenda.hora
            });

            if (!resposta.ok) {
                avisar(resposta.mensagem, 'erro');
                return;
            }

            const consulta = resposta.consulta;
            const medico = medicoPorId(consulta.medicoId);
            const especialidade = especialidadePorId(consulta.especialidadeId);

            estado.consultaAberta = consulta.id;

            document.getElementById('sucesso-protocolo').textContent = consulta.protocolo;
            document.getElementById('sucesso-dados').innerHTML =
                linhaDetalhe('Profissional', escapar(medico ? medico.nome : '')) +
                linhaDetalhe('Especialidade', escapar(especialidade ? especialidade.nome : '')) +
                linhaDetalhe('Data', escapar(dataCurta(consulta.data))) +
                linhaDetalhe('Horário', escapar(consulta.hora));

            estado.agendamento.passo = 6;
            renderPasso();
            avisar('Consulta agendada com sucesso.', 'sucesso');
        }, 850);
    }

    /* ------------------------------------------------------------------
     * RF05 - lista de consultas
     * ------------------------------------------------------------------ */

    function renderConsultas() {
        const usuario = DB.usuarioLogado();
        const destino = document.getElementById('lista-consultas');
        if (!usuario) { return; }

        // Esqueleto antes do conteudo, para dar retorno imediato (RNF01).
        destino.innerHTML = esqueleto(3);

        setTimeout(function () {
            const consultas = DB.listarConsultas(usuario.id, estado.filtroConsultas);

            if (consultas.length === 0) {
                destino.innerHTML = vazio(
                    'calendar-x',
                    'Nenhuma consulta encontrada',
                    estado.filtroConsultas === 'todas'
                        ? 'Você ainda não possui consultas registradas.'
                        : 'Não há consultas com este status.',
                    'ir-agendar',
                    'Agendar consulta'
                );
                Icones.aplicar();
                return;
            }

            destino.innerHTML = consultas.map(function (c) {
                const medico = medicoPorId(c.medicoId);
                const especialidade = especialidadePorId(c.especialidadeId);

                return '<button class="list-card" data-abrir-consulta="' + c.id + '">' +
                           '<span class="avatar">' + escapar(iniciaisDe(medico ? medico.nome : '?')) + '</span>' +
                           '<span class="list-body">' +
                               '<span class="list-title">' + escapar(medico ? medico.nome : 'Profissional') + '</span>' +
                               '<span class="list-meta">' +
                                   Icones.marcar('calendar', 'icon-sm') + dataCurta(c.data) +
                                   ' &middot; ' + escapar(c.hora) +
                               '</span>' +
                               badge(c.status) +
                           '</span>' +
                           Icones.marcar('chevron-right', 'icon-sm') +
                       '</button>';
            }).join('');

            Icones.aplicar();
        }, 260);
    }

    /* RF06 / RF07 - detalhes e cancelamento */
    function renderConsultaDetalhe() {
        const consulta = DB.buscarConsulta(estado.consultaAberta);
        const corpo = document.getElementById('consulta-detalhe-corpo');
        const rodape = document.getElementById('consulta-detalhe-rodape');

        if (!consulta) {
            corpo.innerHTML = vazio('search-x', 'Consulta não encontrada',
                                    'O registro solicitado não está disponível.');
            rodape.hidden = true;
            Icones.aplicar();
            return;
        }

        const medico = medicoPorId(consulta.medicoId);
        const especialidade = especialidadePorId(consulta.especialidadeId);
        const prazo = DB.validarRN06_prazoCancelamento(consulta);

        let html =
            '<div class="text-center" style="margin-bottom: 20px;">' +
                '<div class="avatar avatar-lg" style="margin: 0 auto 12px;">' +
                    escapar(iniciaisDe(medico ? medico.nome : '?')) +
                '</div>' +
                '<h3>' + escapar(medico ? medico.nome : 'Profissional') + '</h3>' +
                '<p class="text-soft">' + escapar(medico ? medico.crm : '') + '</p>' +
                '<div style="margin-top: 12px;">' + badge(consulta.status) + '</div>' +
            '</div>' +
            '<div class="card"><dl>' +
                linhaDetalhe('Protocolo', escapar(consulta.protocolo || '-')) +
                linhaDetalhe('Especialidade', escapar(especialidade ? especialidade.nome : '')) +
                linhaDetalhe('Data', escapar(dataPorExtenso(consulta.data))) +
                linhaDetalhe('Horário', escapar(consulta.hora)) +
                linhaDetalhe('Local', escapar(CATALOGO.unidade.nome)) +
                linhaDetalhe('Endereço', '<span style="font-weight:400;">' +
                             escapar(CATALOGO.unidade.endereco) + '</span>') +
                linhaDetalhe('Telefone', escapar(CATALOGO.unidade.telefone)) +
            '</dl></div>';

        if (consulta.status === 'Agendada') {
            html += prazo.valido
                ? '<div class="notice notice-info" style="margin-top: 16px;">' +
                      Icones.marcar('info', 'icon-sm') +
                      '<div>Chegue com 15 minutos de antecedência e leve um documento com foto.</div>' +
                  '</div>'
                : '<div class="notice notice-warning" style="margin-top: 16px;">' +
                      Icones.marcar('alert-triangle', 'icon-sm') +
                      '<div>' + escapar(prazo.mensagem) + '</div>' +
                  '</div>';
        }

        if (consulta.status === 'Cancelada' && consulta.canceladoEm) {
            const quando = new Date(consulta.canceladoEm);
            html += '<div class="notice notice-danger" style="margin-top: 16px;">' +
                        Icones.marcar('x-circle', 'icon-sm') +
                        '<div>Cancelada em ' + quando.toLocaleDateString('pt-BR') +
                        ' às ' + quando.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) +
                        '.</div></div>';
        }

        corpo.innerHTML = html;

        // O botao de cancelar so aparece quando a RN06 permite.
        rodape.hidden = !DB.podeCancelar(consulta);

        Icones.aplicar();
    }

    async function cancelarConsulta(botao) {
        await comBotao(botao, async function () {
            const resposta = DB.cancelarConsulta(estado.consultaParaCancelar);

            fecharModal();

            if (!resposta.ok) {
                avisar(resposta.mensagem, 'erro');
                return;
            }

            estado.consultaAberta = resposta.consulta.id;
            renderConsultaDetalhe();
            avisar('Consulta cancelada.', 'sucesso');
        }, 750);
    }

    /* ------------------------------------------------------------------
     * RF08 / RF09 - exames
     * ------------------------------------------------------------------ */

    function renderExames() {
        const usuario = DB.usuarioLogado();
        const destino = document.getElementById('lista-exames');
        if (!usuario) { return; }

        destino.innerHTML = esqueleto(3);

        setTimeout(function () {
            const exames = DB.listarExames(usuario.id, estado.filtroExames);

            if (exames.length === 0) {
                destino.innerHTML = vazio('file-search', 'Nenhum exame encontrado',
                                          'Não há exames com este status.');
                Icones.aplicar();
                return;
            }

            destino.innerHTML = exames.map(function (e) {
                return '<button class="list-card" data-abrir-exame="' + e.id + '">' +
                           '<span class="menu-icon">' + Icones.marcar('file-text', 'icon') + '</span>' +
                           '<span class="list-body">' +
                               '<span class="list-title">' + escapar(e.nome) + '</span>' +
                               '<span class="list-meta">' +
                                   Icones.marcar('calendar', 'icon-sm') + dataCurta(e.data) +
                               '</span>' +
                               badge(e.status) +
                           '</span>' +
                           Icones.marcar('chevron-right', 'icon-sm') +
                       '</button>';
            }).join('');

            Icones.aplicar();
        }, 260);
    }

    function renderExameDetalhe() {
        const exame = DB.buscarExame(estado.exameAberto);
        const corpo = document.getElementById('exame-detalhe-corpo');

        if (!exame) {
            corpo.innerHTML = vazio('search-x', 'Exame não encontrado',
                                    'O registro solicitado não está disponível.');
            Icones.aplicar();
            return;
        }

        let html =
            '<div class="text-center" style="margin-bottom: 20px;">' +
                '<div class="menu-icon" style="width: 56px; height: 56px; margin: 0 auto 12px;">' +
                    Icones.marcar('file-text', 'icon-lg') +
                '</div>' +
                '<h3>' + escapar(exame.nome) + '</h3>' +
                '<div style="margin-top: 12px;">' + badge(exame.status) + '</div>' +
            '</div>' +
            '<div class="card"><dl>' +
                linhaDetalhe('Data de coleta', escapar(dataCurta(exame.data))) +
                linhaDetalhe('Laboratório', escapar(exame.laboratorio)) +
                linhaDetalhe('Solicitante', escapar(exame.solicitante)) +
            '</dl></div>';

        // RF09 - o resultado so aparece quando o exame esta pronto.
        if (exame.status === 'Pronto' && exame.resultado.length) {
            html += '<p class="section-title" style="margin-top: 20px;">Resultado</p>' +
                    '<div class="card"><table class="result-table">' +
                        '<thead><tr><th>Item</th><th>Valor</th><th>Referência</th></tr></thead><tbody>' +
                        exame.resultado.map(function (r) {
                            return '<tr>' +
                                       '<td>' + escapar(r.item) + '</td>' +
                                       '<td class="value">' + escapar(r.valor) + ' ' +
                                           '<span class="ref">' + escapar(r.unidade) + '</span></td>' +
                                       '<td class="ref">' + escapar(r.referencia) + '</td>' +
                                   '</tr>';
                        }).join('') +
                        '</tbody></table></div>' +
                    '<div class="notice notice-info" style="margin-top: 16px;">' +
                        Icones.marcar('info', 'icon-sm') +
                        '<div>Os valores de referência podem variar conforme o laboratório. ' +
                        'A interpretação deve ser feita pelo médico solicitante.</div>' +
                    '</div>';
        } else {
            html += '<div class="notice notice-warning" style="margin-top: 20px;">' +
                        Icones.marcar('clock', 'icon-sm') +
                        '<div><strong>Resultado disponível em breve</strong><br>' +
                        'Este exame ainda está em análise. Você será avisado quando o laudo for liberado.</div>' +
                    '</div>';
        }

        corpo.innerHTML = html;
        Icones.aplicar();
    }

    /* ------------------------------------------------------------------
     * RF03 - perfil
     * ------------------------------------------------------------------ */

    function renderPerfil() {
        const usuario = DB.usuarioLogado();
        if (!usuario) { return; }

        document.getElementById('perfil-iniciais').textContent = iniciaisDe(usuario.nome);
        document.getElementById('perfil-nome').textContent = usuario.nome;
        document.getElementById('perfil-email').textContent = usuario.email;

        document.getElementById('perfil-dados').innerHTML =
            linhaDetalhe('CPF', escapar(formatarCPF(usuario.cpf))) +
            linhaDetalhe('Nascimento', escapar(usuario.nascimento ? dataCurta(usuario.nascimento) : '-')) +
            linhaDetalhe('Telefone', escapar(usuario.telefone)) +
            linhaDetalhe('E-mail', '<span style="font-weight:400;">' + escapar(usuario.email) + '</span>') +
            linhaDetalhe('Consultas agendadas', String(DB.contarAgendadas(usuario.id)));

        Icones.aplicar();
    }

    async function restaurarDados(botao) {
        await comBotao(botao, async function () {
            DB.reiniciar();
            DB.encerrarSessao();
            await irPara('tela-login', { texto: 'Restaurando' });
            avisar('Dados de demonstração restaurados.', 'info');
        }, 600);
    }

    /* ------------------------------------------------------------------
     * Acoes declaradas por data-acao
     * ------------------------------------------------------------------ */

    const ACOES = {
        'ir-cadastro':   function () { irPara('tela-cadastro'); },
        'voltar-login':  function () { irPara('tela-login'); },
        'entrar':        function (botao) { entrar(botao); },
        'cadastrar':     function (botao) { cadastrar(botao); },
        'sair':          function (botao) { sair(botao); },

        'esqueci-senha': function () {
            avisar('Recuperação de senha não faz parte do escopo deste protótipo.', 'info');
        },

        'ir-inicio':    function () { irPara('tela-inicio', { aoAbrir: renderInicio }); },
        'ir-consultas': function () { irPara('tela-consultas', { aoAbrir: renderConsultas }); },
        'ir-exames':    function () { irPara('tela-exames', { aoAbrir: renderExames }); },
        'ir-perfil':    function () { irPara('tela-perfil', { aoAbrir: renderPerfil }); },

        'ir-agendar': function () {
            irPara('tela-agendar', { aoAbrir: reiniciarAgendamento, texto: 'Abrindo agenda' });
        },

        'agendar-voltar':    function () { voltarAgendamento(); },
        'agendar-confirmar': function (botao) { confirmarAgendamento(botao); },

        'ver-consulta-criada': function () {
            irPara('tela-consulta-detalhe', { aoAbrir: renderConsultaDetalhe });
        },

        'abrir-modal-cancelar': function () {
            estado.consultaParaCancelar = estado.consultaAberta;
            abrirModal();
        },
        'fechar-modal':          function () { fecharModal(); },
        'confirmar-cancelamento': function (botao) { cancelarConsulta(botao); },

        'reiniciar-dados': function (botao) { restaurarDados(botao); }
    };

    /* ------------------------------------------------------------------
     * Ligacao dos eventos
     * ------------------------------------------------------------------ */

    function ligarEventos() {
        // Uma unica delegacao cobre inclusive o conteudo criado depois.
        document.addEventListener('click', function (evento) {
            const alvo = evento.target.closest('[data-acao], [data-ir-tela], [data-especialidade], ' +
                '[data-medico], [data-data], [data-hora], [data-filtro-consulta], ' +
                '[data-filtro-exame], [data-abrir-consulta], [data-abrir-exame]');

            if (!alvo) { return; }

            DB.renovarSessao();

            // Acoes nomeadas.
            const acao = alvo.getAttribute('data-acao');
            if (acao && ACOES[acao]) {
                evento.preventDefault();
                ACOES[acao](alvo);
                return;
            }

            // Navegacao inferior.
            const tela = alvo.getAttribute('data-ir-tela');
            if (tela) {
                const render = {
                    'tela-inicio': renderInicio,
                    'tela-consultas': renderConsultas,
                    'tela-exames': renderExames,
                    'tela-perfil': renderPerfil
                }[tela];
                irPara(tela, { aoAbrir: render });
                return;
            }

            // Passo 1 - especialidade.
            const especialidade = alvo.getAttribute('data-especialidade');
            if (especialidade) {
                estado.agendamento.especialidadeId = especialidade;
                estado.agendamento.medicoId = null;
                estado.agendamento.hora = null;
                avancarPasso(2, 'Buscando profissionais');
                return;
            }

            // Passo 2 - medico.
            const medico = alvo.getAttribute('data-medico');
            if (medico) {
                estado.agendamento.medicoId = medico;
                estado.agendamento.hora = null;
                avancarPasso(3, 'Consultando agenda');
                return;
            }

            // Passo 3 - data.
            const data = alvo.getAttribute('data-data');
            if (data) {
                estado.agendamento.data = data;
                estado.agendamento.hora = null;
                avancarPasso(4, 'Verificando horários');
                return;
            }

            // Passo 4 - horario.
            const hora = alvo.getAttribute('data-hora');
            if (hora) {
                estado.agendamento.hora = hora;
                avancarPasso(5, 'Preparando confirmação');
                return;
            }

            // Filtros.
            const filtroConsulta = alvo.getAttribute('data-filtro-consulta');
            if (filtroConsulta) {
                estado.filtroConsultas = filtroConsulta;
                marcarFiltroAtivo('filtro-consultas', alvo);
                renderConsultas();
                return;
            }

            const filtroExame = alvo.getAttribute('data-filtro-exame');
            if (filtroExame) {
                estado.filtroExames = filtroExame;
                marcarFiltroAtivo('filtro-exames', alvo);
                renderExames();
                return;
            }

            // Abertura de detalhes.
            const idConsulta = alvo.getAttribute('data-abrir-consulta');
            if (idConsulta) {
                estado.consultaAberta = idConsulta;
                irPara('tela-consulta-detalhe', { aoAbrir: renderConsultaDetalhe });
                return;
            }

            const idExame = alvo.getAttribute('data-abrir-exame');
            if (idExame) {
                estado.exameAberto = idExame;
                irPara('tela-exame-detalhe', { aoAbrir: renderExameDetalhe });
            }
        });

        // Os formularios tambem respondem ao Enter.
        document.getElementById('form-login').addEventListener('submit', function (evento) {
            evento.preventDefault();
            entrar(evento.target.querySelector('[data-acao="entrar"]'));
        });

        document.getElementById('form-cadastro').addEventListener('submit', function (evento) {
            evento.preventDefault();
            cadastrar(evento.target.querySelector('[data-acao="cadastrar"]'));
        });

        // Digitar limpa o erro daquele campo.
        document.addEventListener('input', function (evento) {
            const campo = evento.target.closest('.field');
            if (campo) { campo.classList.remove('has-error'); }
        });

        // Clique fora do modal e tecla Esc fecham a confirmacao.
        modalCancelar.addEventListener('click', function (evento) {
            if (evento.target === modalCancelar) { fecharModal(); }
        });

        document.addEventListener('keydown', function (evento) {
            if (evento.key === 'Escape') { fecharModal(); }
        });
    }

    function marcarFiltroAtivo(containerId, botao) {
        document.getElementById(containerId)
            .querySelectorAll('.filter-chip')
            .forEach(function (chip) { chip.classList.remove('active'); });
        botao.classList.add('active');
    }

    /* ------------------------------------------------------------------
     * Inicializacao
     * ------------------------------------------------------------------ */

    async function iniciar() {
        DB.semear();
        Icones.iniciar();
        montarNavegacao();
        aplicarMascaras();
        ligarEventos();
        Icones.aplicar();

        // RN01 - com sessao valida, entra direto; sem sessao, vai para o login.
        const usuario = DB.usuarioLogado();

        await comCarregamento(function () {
            if (usuario) {
                trocar('tela-inicio');
                renderInicio();
            } else {
                trocar('tela-login');
            }
        }, { texto: 'Iniciando', ms: 600 });
    }

    document.addEventListener('DOMContentLoaded', iniciar);
})();
