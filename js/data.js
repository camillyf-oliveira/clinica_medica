/*
 * data.js - Catalogos estaticos do sistema.
 *
 * Especialidades, medicos e grade de horarios sao dados de catalogo:
 * em um sistema real viriam da administracao da clinica, nao do paciente.
 * Por isso ficam fixos aqui e nao no localStorage.
 */

const CATALOGO = {

    especialidades: [
        { id: 'cardiologia',  nome: 'Cardiologia',  icone: 'heart-pulse', descricao: 'Coração e sistema circulatório' },
        { id: 'pediatria',    nome: 'Pediatria',    icone: 'baby',        descricao: 'Saúde de crianças e adolescentes' },
        { id: 'dermatologia', nome: 'Dermatologia', icone: 'scan-face',   descricao: 'Pele, cabelos e unhas' },
        { id: 'ginecologia',  nome: 'Ginecologia',  icone: 'stethoscope', descricao: 'Saúde da mulher' }
    ],

    medicos: [
        { id: 'm1', nome: 'Dra. Ana Silva',        crm: 'CRM/PE 41.238', especialidadeId: 'cardiologia'  },
        { id: 'm2', nome: 'Dr. Ricardo Nunes',     crm: 'CRM/PE 38.907', especialidadeId: 'cardiologia'  },
        { id: 'm3', nome: 'Dra. Helena Cardoso',   crm: 'CRM/PE 52.114', especialidadeId: 'pediatria'    },
        { id: 'm4', nome: 'Dr. Paulo Menezes',     crm: 'CRM/PE 29.660', especialidadeId: 'pediatria'    },
        { id: 'm5', nome: 'Dra. Beatriz Rocha',    crm: 'CRM/PE 47.503', especialidadeId: 'dermatologia' },
        { id: 'm6', nome: 'Dr. Tiago Albuquerque', crm: 'CRM/PE 35.771', especialidadeId: 'dermatologia' },
        { id: 'm7', nome: 'Dra. Marina Duarte',    crm: 'CRM/PE 44.019', especialidadeId: 'ginecologia'  },
        { id: 'm8', nome: 'Dra. Cláudia Ferraz',   crm: 'CRM/PE 31.845', especialidadeId: 'ginecologia'  }
    ],

    // Grade de horarios de atendimento da clinica.
    horarios: [
        '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
        '11:00', '11:30', '14:00', '14:30', '15:00', '15:30',
        '16:00', '16:30', '17:00'
    ],

    unidade: {
        nome: 'Clínica Médica - Unidade Centro',
        endereco: 'Av. Conde da Boa Vista, 1200 - Recife/PE',
        telefone: '(81) 3333-4400'
    },

    // Parametros usados pelas regras de negocio (ver docs/REQUISITOS.md).
    regras: {
        antecedenciaMinimaDias: 1,      // RN04
        janelaMaximaDias: 90,           // RN04
        horasParaCancelar: 24,          // RN06
        maximoConsultasAgendadas: 3,    // RN07
        tamanhoMinimoSenha: 6,          // RN03
        minutosDeSessao: 30             // RNF05
    }
};

/* Buscas auxiliares no catalogo. */

function especialidadePorId(id) {
    return CATALOGO.especialidades.find(function (e) { return e.id === id; }) || null;
}

function medicoPorId(id) {
    return CATALOGO.medicos.find(function (m) { return m.id === id; }) || null;
}

function medicosPorEspecialidade(especialidadeId) {
    return CATALOGO.medicos.filter(function (m) { return m.especialidadeId === especialidadeId; });
}
