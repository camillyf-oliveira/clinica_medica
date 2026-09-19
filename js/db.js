/*
 * db.js - Camada de persistencia e regras de negocio.
 *
 * Toda leitura e escrita no localStorage passa por aqui, assim como
 * as validacoes RN01 a RN07 descritas em docs/REQUISITOS.md.
 * A interface (app.js) nunca toca no localStorage diretamente.
 */

const DB = (function () {

    const CHAVES = {
        usuarios:   'clinica:usuarios',
        sessao:     'clinica:sessao',
        consultas:  'clinica:consultas',
        exames:     'clinica:exames',
        versaoSeed: 'clinica:versaoSeed'
    };

    const VERSAO_SEED = 2;

    /* ------------------------------------------------------------------
     * Acesso bruto ao localStorage
     * ------------------------------------------------------------------ */

    function ler(chave, padrao) {
        try {
            const bruto = localStorage.getItem(chave);
            return bruto === null ? padrao : JSON.parse(bruto);
        } catch (erro) {
            // Navegador em modo privado ou dado corrompido: nao derruba o app.
            console.warn('Falha ao ler ' + chave, erro);
            return padrao;
        }
    }

    function gravar(chave, valor) {
        try {
            localStorage.setItem(chave, JSON.stringify(valor));
            return true;
        } catch (erro) {
            console.warn('Falha ao gravar ' + chave, erro);
            return false;
        }
    }

    function novoId(prefixo) {
        return prefixo + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    }

    /* ------------------------------------------------------------------
     * Utilidades de data
     * ------------------------------------------------------------------ */

    // Datas trafegam como 'AAAA-MM-DD' para evitar fuso horario.
    function paraISO(data) {
        const ano = data.getFullYear();
        const mes = String(data.getMonth() + 1).padStart(2, '0');
        const dia = String(data.getDate()).padStart(2, '0');
        return ano + '-' + mes + '-' + dia;
    }

    function deISO(iso, hora) {
        const partes = iso.split('-').map(Number);
        const relogio = (hora || '00:00').split(':').map(Number);
        return new Date(partes[0], partes[1] - 1, partes[2], relogio[0], relogio[1], 0, 0);
    }

    function somarDias(data, dias) {
        const copia = new Date(data.getTime());
        copia.setDate(copia.getDate() + dias);
        return copia;
    }

    function hojeISO() {
        return paraISO(new Date());
    }

    /* ------------------------------------------------------------------
     * Usuarios e sessao
     * ------------------------------------------------------------------ */

    function listarUsuarios() {
        return ler(CHAVES.usuarios, []);
    }

    function somenteDigitos(texto) {
        return String(texto || '').replace(/\D/g, '');
    }

    /* RN02 - o CPF e unico e deve ter 11 digitos. */
    function validarRN02_cpfUnico(cpf) {
        const limpo = somenteDigitos(cpf);

        if (limpo.length !== 11) {
            return { valido: false, campo: 'cpf', mensagem: 'O CPF deve conter 11 dígitos.' };
        }
        const jaExiste = listarUsuarios().some(function (u) { return u.cpf === limpo; });
        if (jaExiste) {
            return { valido: false, campo: 'cpf', mensagem: 'Já existe um cadastro com este CPF.' };
        }
        return { valido: true };
    }

    /* RN03 - senha com no minimo 6 caracteres e igual a confirmacao. */
    function validarRN03_senha(senha, confirmacao) {
        if (String(senha || '').length < CATALOGO.regras.tamanhoMinimoSenha) {
            return {
                valido: false,
                campo: 'senha',
                mensagem: 'A senha deve ter ao menos ' + CATALOGO.regras.tamanhoMinimoSenha + ' caracteres.'
            };
        }
        if (senha !== confirmacao) {
            return { valido: false, campo: 'confirmacao', mensagem: 'A confirmação não corresponde à senha.' };
        }
        return { valido: true };
    }

    /* RF01 - cadastrar paciente. */
    function criarUsuario(dados) {
        const obrigatorios = [
            { campo: 'nome',       rotulo: 'Informe o nome completo.' },
            { campo: 'cpf',        rotulo: 'Informe o CPF.' },
            { campo: 'email',      rotulo: 'Informe o e-mail.' },
            { campo: 'telefone',   rotulo: 'Informe o telefone.' },
            { campo: 'nascimento', rotulo: 'Informe a data de nascimento.' }
        ];

        for (let i = 0; i < obrigatorios.length; i++) {
            const item = obrigatorios[i];
            if (!String(dados[item.campo] || '').trim()) {
                return { ok: false, campo: item.campo, mensagem: item.rotulo };
            }
        }

        if (String(dados.nome).trim().split(/\s+/).length < 2) {
            return { ok: false, campo: 'nome', mensagem: 'Informe o nome e o sobrenome.' };
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email)) {
            return { ok: false, campo: 'email', mensagem: 'Informe um e-mail válido.' };
        }
        if (somenteDigitos(dados.telefone).length < 10) {
            return { ok: false, campo: 'telefone', mensagem: 'Informe o telefone com DDD.' };
        }

        const cpfOk = validarRN02_cpfUnico(dados.cpf);
        if (!cpfOk.valido) {
            return { ok: false, campo: cpfOk.campo, mensagem: cpfOk.mensagem };
        }

        const senhaOk = validarRN03_senha(dados.senha, dados.confirmacao);
        if (!senhaOk.valido) {
            return { ok: false, campo: senhaOk.campo, mensagem: senhaOk.mensagem };
        }

        const usuario = {
            id: novoId('u'),
            nome: String(dados.nome).trim(),
            cpf: somenteDigitos(dados.cpf),
            email: String(dados.email).trim().toLowerCase(),
            telefone: String(dados.telefone).trim(),
            nascimento: dados.nascimento,
            senha: dados.senha,
            criadoEm: new Date().toISOString()
        };

        const usuarios = listarUsuarios();
        usuarios.push(usuario);
        gravar(CHAVES.usuarios, usuarios);

        return { ok: true, usuario: usuario };
    }

    /* RF02 - autenticar por CPF e senha. */
    function autenticar(cpf, senha) {
        const limpo = somenteDigitos(cpf);

        if (!limpo) {
            return { ok: false, campo: 'cpf', mensagem: 'Informe o CPF.' };
        }
        if (!senha) {
            return { ok: false, campo: 'senha', mensagem: 'Informe a senha.' };
        }

        const usuario = listarUsuarios().find(function (u) { return u.cpf === limpo; });

        // Mensagem unica para CPF inexistente e senha errada: nao revela
        // quais CPFs estao cadastrados (RNF05).
        if (!usuario || usuario.senha !== senha) {
            return { ok: false, campo: 'senha', mensagem: 'CPF ou senha incorretos.' };
        }

        abrirSessao(usuario.id);
        return { ok: true, usuario: usuario };
    }

    function abrirSessao(usuarioId) {
        const expiraEm = Date.now() + CATALOGO.regras.minutosDeSessao * 60 * 1000;
        gravar(CHAVES.sessao, { usuarioId: usuarioId, expiraEm: expiraEm });
    }

    /* RF03 - encerrar sessao. */
    function encerrarSessao() {
        try {
            localStorage.removeItem(CHAVES.sessao);
        } catch (erro) {
            console.warn('Falha ao encerrar sessao', erro);
        }
    }

    /* RNF05 - a sessao expira apos 30 minutos de inatividade. */
    function usuarioLogado() {
        const sessao = ler(CHAVES.sessao, null);
        if (!sessao) { return null; }

        if (Date.now() > sessao.expiraEm) {
            encerrarSessao();
            return null;
        }

        const usuario = listarUsuarios().find(function (u) { return u.id === sessao.usuarioId; });
        if (!usuario) {
            encerrarSessao();
            return null;
        }

        return usuario;
    }

    // Cada interacao do usuario renova a contagem de inatividade.
    function renovarSessao() {
        const sessao = ler(CHAVES.sessao, null);
        if (sessao && Date.now() <= sessao.expiraEm) {
            abrirSessao(sessao.usuarioId);
        }
    }

    /* RN01 - apenas usuarios autenticados acessam as telas internas. */
    function validarRN01_sessaoAtiva() {
        return usuarioLogado() !== null;
    }

    /* ------------------------------------------------------------------
     * Consultas
     * ------------------------------------------------------------------ */

    function todasConsultas() {
        return ler(CHAVES.consultas, []);
    }

    /* RF05 - lista as consultas do usuario, opcionalmente por status. */
    function listarConsultas(usuarioId, status) {
        return todasConsultas()
            .filter(function (c) {
                if (c.usuarioId !== usuarioId) { return false; }
                if (status && status !== 'todas' && c.status !== status) { return false; }
                return true;
            })
            .sort(function (a, b) {
                // Mais recentes primeiro.
                return deISO(b.data, b.hora) - deISO(a.data, a.hora);
            });
    }

    function buscarConsulta(id) {
        return todasConsultas().find(function (c) { return c.id === id; }) || null;
    }

    /* RF10 - proxima consulta agendada, da mais proxima para a mais distante. */
    function proximaConsulta(usuarioId) {
        const agora = new Date();
        return todasConsultas()
            .filter(function (c) {
                return c.usuarioId === usuarioId
                    && c.status === 'Agendada'
                    && deISO(c.data, c.hora) > agora;
            })
            .sort(function (a, b) { return deISO(a.data, a.hora) - deISO(b.data, b.hora); })[0] || null;
    }

    /* RN04 - a partir do dia seguinte e em ate 90 dias. */
    function validarRN04_janelaAgendamento(dataISO) {
        const regras = CATALOGO.regras;
        const primeiroDia = paraISO(somarDias(new Date(), regras.antecedenciaMinimaDias));
        const ultimoDia = paraISO(somarDias(new Date(), regras.janelaMaximaDias));

        if (dataISO < primeiroDia) {
            return { valido: false, mensagem: 'Escolha uma data a partir de amanhã.' };
        }
        if (dataISO > ultimoDia) {
            return { valido: false, mensagem: 'A agenda vai até ' + regras.janelaMaximaDias + ' dias à frente.' };
        }
        return { valido: true };
    }

    /* Lista de datas selecionaveis, ja obedecendo a RN04. */
    function datasDisponiveis(quantidade) {
        const total = quantidade || 30;
        const regras = CATALOGO.regras;
        const limite = Math.min(total, regras.janelaMaximaDias);
        const datas = [];

        for (let i = regras.antecedenciaMinimaDias; i < regras.antecedenciaMinimaDias + limite; i++) {
            datas.push(paraISO(somarDias(new Date(), i)));
        }
        return datas;
    }

    /* RN05 - um medico nao atende dois pacientes no mesmo dia e horario. */
    function validarRN05_horarioLivre(medicoId, dataISO, hora) {
        const ocupado = todasConsultas().some(function (c) {
            return c.medicoId === medicoId
                && c.data === dataISO
                && c.hora === hora
                && c.status === 'Agendada';
        });

        if (ocupado) {
            return { valido: false, mensagem: 'Este horário já está ocupado para o médico escolhido.' };
        }
        return { valido: true };
    }

    /* Horarios do dia com a marcacao de ocupado, para desabilitar na tela. */
    function horariosDoDia(medicoId, dataISO) {
        return CATALOGO.horarios.map(function (hora) {
            return {
                hora: hora,
                livre: validarRN05_horarioLivre(medicoId, dataISO, hora).valido
            };
        });
    }

    /* RN07 - no maximo 3 consultas com status Agendada por paciente. */
    function validarRN07_limiteConsultas(usuarioId) {
        const limite = CATALOGO.regras.maximoConsultasAgendadas;
        const ativas = listarConsultas(usuarioId, 'Agendada').length;

        if (ativas >= limite) {
            return {
                valido: false,
                mensagem: 'Você já possui ' + limite + ' consultas agendadas. Cancele uma para marcar outra.'
            };
        }
        return { valido: true };
    }

    function contarAgendadas(usuarioId) {
        return listarConsultas(usuarioId, 'Agendada').length;
    }

    /* RF04 - agendar consulta. */
    function criarConsulta(dados) {
        if (!validarRN01_sessaoAtiva()) {
            return { ok: false, mensagem: 'Sua sessão expirou. Entre novamente.' };
        }
        if (!dados.especialidadeId || !dados.medicoId || !dados.data || !dados.hora) {
            return { ok: false, mensagem: 'Complete todas as etapas do agendamento.' };
        }

        const janela = validarRN04_janelaAgendamento(dados.data);
        if (!janela.valido) { return { ok: false, mensagem: janela.mensagem }; }

        const horario = validarRN05_horarioLivre(dados.medicoId, dados.data, dados.hora);
        if (!horario.valido) { return { ok: false, mensagem: horario.mensagem }; }

        const limite = validarRN07_limiteConsultas(dados.usuarioId);
        if (!limite.valido) { return { ok: false, mensagem: limite.mensagem }; }

        const consulta = {
            id: novoId('c'),
            protocolo: gerarProtocolo(),
            usuarioId: dados.usuarioId,
            especialidadeId: dados.especialidadeId,
            medicoId: dados.medicoId,
            data: dados.data,
            hora: dados.hora,
            status: 'Agendada',
            criadoEm: new Date().toISOString(),
            canceladoEm: null
        };

        const consultas = todasConsultas();
        consultas.push(consulta);
        gravar(CHAVES.consultas, consultas);

        return { ok: true, consulta: consulta };
    }

    function gerarProtocolo() {
        const ano = new Date().getFullYear();
        const sequencia = String(Math.floor(Math.random() * 900000) + 100000);
        return ano + '-' + sequencia;
    }

    /* RN06 - cancelamento exige 24 h de antecedencia. */
    function validarRN06_prazoCancelamento(consulta) {
        const horasMinimas = CATALOGO.regras.horasParaCancelar;
        const momento = deISO(consulta.data, consulta.hora);
        const horasRestantes = (momento - new Date()) / (1000 * 60 * 60);

        if (horasRestantes < horasMinimas) {
            return {
                valido: false,
                mensagem: 'O cancelamento exige ' + horasMinimas +
                          ' h de antecedência. Entre em contato com a recepção.'
            };
        }
        return { valido: true };
    }

    function podeCancelar(consulta) {
        return consulta.status === 'Agendada' && validarRN06_prazoCancelamento(consulta).valido;
    }

    /* RF07 - cancelar consulta. */
    function cancelarConsulta(id) {
        const consultas = todasConsultas();
        const indice = consultas.findIndex(function (c) { return c.id === id; });

        if (indice === -1) {
            return { ok: false, mensagem: 'Consulta não encontrada.' };
        }

        const consulta = consultas[indice];

        if (consulta.status !== 'Agendada') {
            return { ok: false, mensagem: 'Esta consulta não está mais agendada.' };
        }

        const prazo = validarRN06_prazoCancelamento(consulta);
        if (!prazo.valido) { return { ok: false, mensagem: prazo.mensagem }; }

        consulta.status = 'Cancelada';
        consulta.canceladoEm = new Date().toISOString();
        consultas[indice] = consulta;
        gravar(CHAVES.consultas, consultas);

        return { ok: true, consulta: consulta };
    }

    /* ------------------------------------------------------------------
     * Exames
     * ------------------------------------------------------------------ */

    function todosExames() {
        return ler(CHAVES.exames, []);
    }

    /* RF08 - lista os exames do usuario, opcionalmente por status. */
    function listarExames(usuarioId, status) {
        return todosExames()
            .filter(function (e) {
                if (e.usuarioId !== usuarioId) { return false; }
                if (status && status !== 'todos' && e.status !== status) { return false; }
                return true;
            })
            .sort(function (a, b) { return b.data.localeCompare(a.data); });
    }

    /* RF09 - detalhes do exame. */
    function buscarExame(id) {
        return todosExames().find(function (e) { return e.id === id; }) || null;
    }

    /* ------------------------------------------------------------------
     * Carga inicial de demonstracao
     * ------------------------------------------------------------------ */

    const DEMO = { cpf: '01234567890', senha: '123456' };

    function semear() {
        if (ler(CHAVES.versaoSeed, 0) === VERSAO_SEED) { return; }

        const usuario = {
            id: 'u-demo',
            nome: 'Carlos Henrique Souza',
            cpf: DEMO.cpf,
            email: 'carlos.souza@email.com',
            telefone: '(81) 98877-6655',
            nascimento: '1990-04-17',
            senha: DEMO.senha,
            criadoEm: new Date().toISOString()
        };

        const usuarios = listarUsuarios();
        const indiceDemo = usuarios.findIndex(function (u) { return u.id === 'u-demo'; });

        if (indiceDemo === -1) {
            usuarios.push(usuario);
        } else {
            // Atualiza no lugar: a conta pode ter mudado de CPF ou de senha
            // entre versoes do seed, e duplicar o id quebraria as consultas.
            usuarios[indiceDemo] = usuario;
        }

        gravar(CHAVES.usuarios, usuarios);

        // Uma consulta daqui a 6 dias (cancelavel) e outra para amanha,
        // que serve para demonstrar o bloqueio da RN06 na apresentacao.
        const consultas = [
            {
                id: 'c-demo-1',
                protocolo: '2026-480321',
                usuarioId: 'u-demo',
                especialidadeId: 'cardiologia',
                medicoId: 'm1',
                data: paraISO(somarDias(new Date(), 6)),
                hora: '14:30',
                status: 'Agendada',
                criadoEm: new Date().toISOString(),
                canceladoEm: null
            },
            {
                id: 'c-demo-2',
                protocolo: '2026-480644',
                usuarioId: 'u-demo',
                especialidadeId: 'dermatologia',
                medicoId: 'm5',
                data: paraISO(somarDias(new Date(), 1)),
                hora: '09:00',
                status: 'Agendada',
                criadoEm: new Date().toISOString(),
                canceladoEm: null
            },
            {
                id: 'c-demo-3',
                protocolo: '2026-471002',
                usuarioId: 'u-demo',
                especialidadeId: 'pediatria',
                medicoId: 'm3',
                data: paraISO(somarDias(new Date(), -20)),
                hora: '10:00',
                status: 'Realizada',
                criadoEm: new Date().toISOString(),
                canceladoEm: null
            },
            {
                id: 'c-demo-4',
                protocolo: '2026-468815',
                usuarioId: 'u-demo',
                especialidadeId: 'ginecologia',
                medicoId: 'm7',
                data: paraISO(somarDias(new Date(), -45)),
                hora: '16:00',
                status: 'Cancelada',
                criadoEm: new Date().toISOString(),
                canceladoEm: new Date().toISOString()
            }
        ];

        const exames = [
            {
                id: 'e-demo-1',
                usuarioId: 'u-demo',
                nome: 'Hemograma Completo',
                data: paraISO(somarDias(new Date(), -9)),
                status: 'Pronto',
                laboratorio: 'Laboratório Central',
                solicitante: 'Dra. Ana Silva',
                resultado: [
                    { item: 'Hemoglobina', valor: '14,2', unidade: 'g/dL', referencia: '13,0 a 17,0' },
                    { item: 'Hematócrito', valor: '42,1', unidade: '%',    referencia: '39,0 a 50,0' },
                    { item: 'Leucócitos',  valor: '7.100', unidade: '/mm3', referencia: '4.000 a 11.000' },
                    { item: 'Plaquetas',   valor: '245.000', unidade: '/mm3', referencia: '150.000 a 450.000' }
                ]
            },
            {
                id: 'e-demo-2',
                usuarioId: 'u-demo',
                nome: 'Ressonância Magnética',
                data: paraISO(somarDias(new Date(), -5)),
                status: 'Em Análise',
                laboratorio: 'Centro de Imagem',
                solicitante: 'Dr. Ricardo Nunes',
                resultado: []
            },
            {
                id: 'e-demo-3',
                usuarioId: 'u-demo',
                nome: 'Colesterol Total e Frações',
                data: paraISO(somarDias(new Date(), -30)),
                status: 'Pronto',
                laboratorio: 'Laboratório Central',
                solicitante: 'Dra. Ana Silva',
                resultado: [
                    { item: 'Colesterol total', valor: '188', unidade: 'mg/dL', referencia: 'abaixo de 190' },
                    { item: 'HDL',              valor: '52',  unidade: 'mg/dL', referencia: 'acima de 40' },
                    { item: 'LDL',              valor: '112', unidade: 'mg/dL', referencia: 'abaixo de 130' },
                    { item: 'Triglicérides',    valor: '120', unidade: 'mg/dL', referencia: 'abaixo de 150' }
                ]
            }
        ];

        if (todasConsultas().length === 0) { gravar(CHAVES.consultas, consultas); }
        if (todosExames().length === 0)    { gravar(CHAVES.exames, exames); }

        gravar(CHAVES.versaoSeed, VERSAO_SEED);
    }

    /* Restaura o estado de demonstracao - util antes de apresentar. */
    function reiniciar() {
        Object.keys(CHAVES).forEach(function (nome) {
            try { localStorage.removeItem(CHAVES[nome]); } catch (erro) { /* ignora */ }
        });
        semear();
    }

    /* ------------------------------------------------------------------
     * Interface publica
     * ------------------------------------------------------------------ */

    return {
        DEMO: DEMO,

        semear: semear,
        reiniciar: reiniciar,

        criarUsuario: criarUsuario,
        autenticar: autenticar,
        encerrarSessao: encerrarSessao,
        usuarioLogado: usuarioLogado,
        renovarSessao: renovarSessao,

        listarConsultas: listarConsultas,
        buscarConsulta: buscarConsulta,
        proximaConsulta: proximaConsulta,
        criarConsulta: criarConsulta,
        cancelarConsulta: cancelarConsulta,
        contarAgendadas: contarAgendadas,
        podeCancelar: podeCancelar,
        datasDisponiveis: datasDisponiveis,
        horariosDoDia: horariosDoDia,

        listarExames: listarExames,
        buscarExame: buscarExame,

        // Validacoes expostas para consulta e para a defesa do trabalho.
        validarRN01_sessaoAtiva: validarRN01_sessaoAtiva,
        validarRN02_cpfUnico: validarRN02_cpfUnico,
        validarRN03_senha: validarRN03_senha,
        validarRN04_janelaAgendamento: validarRN04_janelaAgendamento,
        validarRN05_horarioLivre: validarRN05_horarioLivre,
        validarRN06_prazoCancelamento: validarRN06_prazoCancelamento,
        validarRN07_limiteConsultas: validarRN07_limiteConsultas,

        // Utilidades de data reaproveitadas pela interface.
        paraISO: paraISO,
        deISO: deISO,
        hojeISO: hojeISO
    };
})();
