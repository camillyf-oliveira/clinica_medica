# Documento de Requisitos — Sistema de Agendamento da Clínica Médica

**Disciplina:** Engenharia de Requisitos
**Versão:** 1.0
**Data:** setembro de 2026

---

## 1. Visão geral

O sistema é um aplicativo web para pacientes de uma clínica médica. Permite que o paciente se cadastre, entre no sistema, agende consultas escolhendo especialidade, médico, data e horário, acompanhe suas consultas e consulte os resultados dos seus exames.

O protótipo foi construído em HTML, CSS e JavaScript puro. Os dados são persistidos no `localStorage` do navegador, simulando o banco de dados que existiria em uma implementação real.

### 1.1 Escopo

**Está no escopo:** cadastro de paciente, autenticação, agendamento de consultas, consulta e cancelamento de agendamentos, consulta de exames e seus resultados.

**Está fora do escopo:** perfil de médico e de recepcionista, prontuário eletrônico, pagamento, integração com convênio, emissão de nota fiscal e teleconsulta.

### 1.2 Atores

| Ator | Descrição |
|------|-----------|
| Visitante | Pessoa não autenticada. Pode apenas se cadastrar ou entrar. |
| Paciente | Usuário cadastrado e autenticado. Executa todas as funcionalidades do sistema. |

---

## 2. Requisitos Funcionais

Mínimo exigido: 8. Especificados: 10.

### RF01 — Cadastrar paciente

O sistema deve permitir que um visitante realize seu cadastro informando nome completo, CPF, e-mail, telefone, data de nascimento e senha.

- **Ator:** Visitante
- **Entradas:** nome, CPF, e-mail, telefone, data de nascimento, senha, confirmação de senha
- **Saída:** conta criada e sessão iniciada automaticamente
- **Regras associadas:** RN02, RN03
- **Implementado em:** tela Cadastro — `db.criarUsuario()` em `js/db.js`

### RF02 — Autenticar usuário

O sistema deve permitir que um usuário cadastrado entre no sistema informando CPF e senha, criando uma sessão ativa.

- **Ator:** Visitante
- **Entradas:** CPF, senha
- **Saída:** sessão iniciada e redirecionamento para a tela inicial
- **Exceção:** credenciais inválidas exibem mensagem de erro e mantêm o usuário na tela de login
- **Regras associadas:** RN01
- **Implementado em:** tela Login — `db.autenticar()` em `js/db.js`

### RF03 — Encerrar sessão

O sistema deve permitir que o usuário autenticado encerre sua sessão, retornando à tela de login.

- **Ator:** Paciente
- **Saída:** sessão descartada; telas internas deixam de ser acessíveis
- **Regras associadas:** RN01
- **Implementado em:** tela Perfil — `db.encerrarSessao()` em `js/db.js`

### RF04 — Agendar consulta

O sistema deve permitir que o paciente agende uma consulta percorrendo quatro etapas: escolha da especialidade, escolha do médico, escolha da data e escolha do horário, com confirmação final antes de gravar.

- **Ator:** Paciente
- **Entradas:** especialidade, médico, data, horário
- **Saída:** consulta gravada com status "Agendada" e protocolo gerado
- **Regras associadas:** RN04, RN05, RN07
- **Implementado em:** fluxo Agendar — `db.criarConsulta()` em `js/db.js`

### RF05 — Consultar agendamentos

O sistema deve listar todas as consultas do paciente autenticado, permitindo filtrar por status: Agendada, Realizada ou Cancelada.

- **Ator:** Paciente
- **Saída:** lista de consultas com médico, especialidade, data, horário e status
- **Implementado em:** tela Minhas Consultas — `db.listarConsultas()` em `js/db.js`

### RF06 — Visualizar detalhes da consulta

O sistema deve exibir os dados completos de uma consulta selecionada, incluindo protocolo, médico, CRM, especialidade, data, horário, local e status.

- **Ator:** Paciente
- **Implementado em:** tela Detalhes da Consulta — `db.buscarConsulta()` em `js/db.js`

### RF07 — Cancelar consulta

O sistema deve permitir que o paciente cancele uma consulta com status "Agendada", exigindo confirmação explícita antes de efetivar.

- **Ator:** Paciente
- **Saída:** status da consulta alterado para "Cancelada", com data e hora do cancelamento
- **Regras associadas:** RN06
- **Implementado em:** tela Detalhes da Consulta — `db.cancelarConsulta()` em `js/db.js`

### RF08 — Consultar exames

O sistema deve listar os exames do paciente autenticado com seu respectivo status, permitindo filtrar por Pronto ou Em Análise.

- **Ator:** Paciente
- **Saída:** lista de exames com nome, data de realização e status
- **Implementado em:** tela Meus Exames — `db.listarExames()` em `js/db.js`

### RF09 — Visualizar detalhes do exame

O sistema deve exibir os dados de um exame selecionado. Quando o status for "Pronto", deve apresentar a tabela de resultados com os valores medidos, a unidade e o valor de referência de cada item.

- **Ator:** Paciente
- **Exceção:** exame com status "Em Análise" exibe aviso de que o resultado ainda não está disponível
- **Implementado em:** tela Detalhes do Exame — `db.buscarExame()` em `js/db.js`

### RF10 — Exibir próxima consulta

A tela inicial deve destacar a próxima consulta agendada do paciente, informando médico, especialidade, data e horário. Caso não exista consulta futura, deve apresentar convite para agendar.

- **Ator:** Paciente
- **Implementado em:** tela Início — `db.proximaConsulta()` em `js/db.js`

---

## 3. Requisitos Não Funcionais

Mínimo exigido: 4. Especificados: 6.

### RNF01 — Desempenho

Toda operação do sistema deve ser concluída em até 3 segundos, e o sistema deve apresentar um indicador visual de carregamento em até 300 milissegundos após a ação do usuário, para que nenhuma ação pareça ignorada.

- **Como verificar:** cronometrar login, agendamento e cancelamento; observar o indicador de carregamento em toda troca de tela
- **Implementado em:** `comCarregamento()` e `botaoCarregando()` em `js/app.js`

### RNF02 — Usabilidade

A interface deve ser projetada para telas de 360 a 414 pixels de largura (mobile-first), sem rolagem horizontal. Todo ícone deve vir acompanhado de rótulo textual, e toda mensagem de erro deve ser exibida junto ao campo que a originou.

- **Como verificar:** abrir o sistema com a janela em 390 px de largura e percorrer todas as telas
- **Implementado em:** `css/style.css`

### RNF03 — Persistência

Os dados cadastrados devem permanecer disponíveis após o recarregamento ou o fechamento do navegador, armazenados no `localStorage` sob o prefixo `clinica:`.

- **Como verificar:** agendar uma consulta, pressionar F5 e confirmar que a consulta continua na lista
- **Implementado em:** `js/db.js`

### RNF04 — Portabilidade

O sistema deve executar nos navegadores Chrome, Edge e Firefox em suas versões atuais, abrindo o arquivo local diretamente, sem necessidade de instalação, servidor web ou conexão com banco de dados.

- **Como verificar:** abrir `index.html` com duplo clique em cada navegador
- **Implementado em:** HTML5, CSS3 e JavaScript ES6, sem dependência de build

### RNF05 — Segurança

A senha deve ser mascarada durante a digitação. As telas internas devem ser inacessíveis sem sessão ativa, mesmo por manipulação direta do endereço. A sessão deve expirar automaticamente após 30 minutos de inatividade.

- **Como verificar:** tentar acessar uma tela interna sem estar autenticado; o sistema retorna ao login
- **Implementado em:** `db.sessaoAtiva()` e `exigirSessao()` em `js/db.js` e `js/app.js`

> **Observação acadêmica:** em um sistema real, a senha nunca seria armazenada em texto legível — seria aplicada uma função de hash com sal no servidor. Como este é um protótipo sem back-end, a senha fica no `localStorage` apenas para viabilizar a demonstração. Essa limitação está registrada na seção 5.

### RNF06 — Manutenibilidade

O código deve ser organizado em camadas com responsabilidades separadas: persistência e regras de negócio em `js/db.js`, catálogos em `js/data.js`, interface e navegação em `js/app.js`, apresentação em `css/style.css`. Nenhuma regra de negócio deve estar escrita dentro do HTML.

- **Como verificar:** inspecionar `index.html` e confirmar a ausência de atributos `onclick` e de lógica embutida
- **Implementado em:** estrutura de arquivos do projeto

---

## 4. Regras de Negócio

Mínimo exigido: 4. Especificadas: 7.

Cada regra corresponde a uma função de validação nomeada em `js/db.js` com o identificador da própria regra — `validarRN05_horarioLivre`, `validarRN07_limiteConsultas` e assim por diante. É esse nome que liga este documento ao código. A mensagem apresentada ao paciente é escrita em linguagem comum, sem citar o identificador, porque o usuário final do sistema não conhece a numeração dos requisitos.

### RN01 — Acesso restrito

Apenas usuários cadastrados e autenticados podem acessar as funcionalidades internas do sistema. Visitantes têm acesso somente às telas de login e cadastro.

- **Função:** `validarRN01_sessaoAtiva()`
- **Efeito na interface:** qualquer tentativa de acesso sem sessão redireciona para o login

### RN02 — CPF único

O CPF é o identificador do paciente e não pode se repetir. Deve conter exatamente 11 dígitos numéricos, e não pode existir outro cadastro com o mesmo CPF.

- **Função:** `validarRN02_cpfUnico()`
- **Mensagem ao usuário:** "Já existe um cadastro com este CPF."

### RN03 — Força e confirmação de senha

A senha deve ter no mínimo 6 caracteres e ser idêntica ao campo de confirmação.

- **Função:** `validarRN03_senha()`
- **Mensagem ao usuário:** "A senha deve ter ao menos 6 caracteres." / "A confirmação não corresponde à senha."

### RN04 — Antecedência mínima e janela de agendamento

Consultas só podem ser marcadas a partir do dia seguinte ao atual e em até 90 dias à frente. O dia corrente e datas passadas não podem ser selecionados.

- **Função:** `validarRN04_janelaAgendamento()`
- **Efeito na interface:** o seletor de datas apresenta apenas os dias válidos

### RN05 — Horário exclusivo por médico

Um médico não pode ter duas consultas marcadas para o mesmo dia e o mesmo horário. Horários já ocupados devem ser apresentados desabilitados na seleção.

- **Função:** `validarRN05_horarioLivre()`
- **Efeito na interface:** o horário ocupado aparece esmaecido e não é clicável

### RN06 — Prazo para cancelamento

O cancelamento de uma consulta só é permitido com 24 horas ou mais de antecedência em relação ao horário marcado. Dentro desse prazo, o paciente deve entrar em contato com a recepção.

- **Função:** `validarRN06_prazoCancelamento()`
- **Mensagem ao usuário:** "O cancelamento exige 24 h de antecedência. Entre em contato com a recepção."

### RN07 — Limite de consultas ativas

Cada paciente pode manter no máximo 3 consultas com status "Agendada" simultaneamente. Consultas realizadas ou canceladas não contam para esse limite.

- **Função:** `validarRN07_limiteConsultas()`
- **Mensagem ao usuário:** "Você já possui 3 consultas agendadas. Cancele uma para marcar outra."

---

## 5. Restrições e premissas do protótipo

| Item | Situação no protótipo | Situação em produção |
|------|----------------------|----------------------|
| Armazenamento | `localStorage` do navegador | Banco de dados relacional no servidor |
| Senha | Texto legível no `localStorage` | Hash com sal, calculado no servidor |
| Latência de rede | Simulada por atraso artificial de 350 a 900 ms | Latência real da API |
| Catálogo de médicos e horários | Fixo em `js/data.js` | Cadastrado pela administração da clínica |
| Exames | Semeados no primeiro acesso | Importados do laboratório |
| Multiusuário | Dados isolados por navegador | Base compartilhada com controle de acesso |

---

## 6. Matriz de rastreabilidade

| Requisito | Tela | Regras aplicadas |
|-----------|------|------------------|
| RF01 | Cadastro | RN02, RN03 |
| RF02 | Login | RN01 |
| RF03 | Perfil | RN01 |
| RF04 | Agendar (4 passos) | RN04, RN05, RN07 |
| RF05 | Minhas Consultas | RN01 |
| RF06 | Detalhes da Consulta | RN01 |
| RF07 | Detalhes da Consulta | RN06 |
| RF08 | Meus Exames | RN01 |
| RF09 | Detalhes do Exame | RN01 |
| RF10 | Início | RN01 |

| Requisito não funcional | Onde se manifesta |
|------------------------|-------------------|
| RNF01 | Indicador de carregamento em todas as telas e botões |
| RNF02 | Layout mobile-first, ícones rotulados, erros por campo |
| RNF03 | `localStorage` sob o prefixo `clinica:` |
| RNF04 | Execução local, sem servidor |
| RNF05 | Máscara de senha, proteção de telas, expiração de sessão |
| RNF06 | Separação em `db.js`, `data.js`, `app.js` e `style.css` |

---

## 7. Fluxo principal — agendamento de consulta

```
Visitante
   |
   +-- Cadastro (RF01) ----+
   |                       |
   +-- Login (RF02) -------+
                           |
                           v
                    Tela Inicial (RF10)
                           |
                           v
          Passo 1: Especialidade
                           |
                           v
          Passo 2: Medico
                           |
                           v
          Passo 3: Data (RN04)
                           |
                           v
          Passo 4: Horario (RN05)
                           |
                           v
          Confirmacao (RN07) --> Consulta criada (RF04)
                           |
                           v
                 Minhas Consultas (RF05)
                           |
                           v
              Detalhes da Consulta (RF06)
                           |
                           v
                 Cancelar (RF07 / RN06)
```
