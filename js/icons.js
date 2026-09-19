/*
 * icons.js - Renderizacao dos icones.
 *
 * O projeto nao usa emoji em nenhum lugar (requisito de padronizacao
 * visual). Todo simbolo da interface e um icone da biblioteca Lucide,
 * declarado no HTML como <i data-lucide="nome">.
 *
 * Como parte da tela e montada por JavaScript, e preciso pedir a
 * biblioteca que converta os novos <i> em SVG a cada renderizacao -
 * e o que faz Icones.aplicar().
 */

const Icones = (function () {

    let disponivel = false;

    function iniciar() {
        disponivel = typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function';

        if (!disponivel) {
            // Sem internet o CDN nao carrega. O sistema continua utilizavel,
            // porque todo icone vem acompanhado de rotulo textual (RNF02).
            console.warn('Biblioteca de icones indisponivel. A interface segue funcionando sem os simbolos.');
            document.documentElement.classList.add('sem-icones');
            return;
        }

        aplicar();
    }

    /* Converte em SVG os <i data-lucide> presentes na pagina. */
    function aplicar() {
        if (!disponivel) { return; }

        try {
            lucide.createIcons();
        } catch (erro) {
            console.warn('Falha ao renderizar icones', erro);
        }
    }

    /* Monta a marcacao de um icone, para uso em templates de string. */
    function marcar(nome, classe) {
        return '<i data-lucide="' + nome + '" class="' + (classe || 'icon') + '"></i>';
    }

    return {
        iniciar: iniciar,
        aplicar: aplicar,
        marcar: marcar
    };
})();
