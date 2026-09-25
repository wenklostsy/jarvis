# Roadmap de continuidade do JARVIS

## Atualização vigente — Etapa 1C

Fundação de segurança local implementada: loopback, sessão efêmera, origins exatas, política central, infraestrutura de confirmação, arquivos confinados, redaction, readiness e UUID de instalação. **84 testes aprovados**, build/lint/diff-check aprovados; npm audit: 8 pacotes (5 altos, 3 moderados), sem alterar dependências. Veja [entrega, arquivos, resultados e limites](ETAPA_1C.md) e [política de segurança](SECURITY.md).

Próxima etapa: validar voz, pesquisas, mídia e Word no uso real; depois propor patches de dependências com regressão. Liberação de MCP externo exige adaptadores contextuais sujeitos à aprovação. Universal Tool Registry, Memory, Projects e novas integrações não foram iniciados.

As atualizações abaixo são históricas; afirmações antigas de que a Etapa 1C não foi iniciada se referem às respectivas datas.


## Atualização — Etapa 1B.2

HUD reorganizado com interação atual curta, histórico recolhível, resultados laterais e notificações temporárias. Fechar/minimizar pesquisa preserva seus dados e seu ID ativo. [Detalhes, arquivos, testes e limites](ETAPA_1B_2.md). Validação: **55 testes aprovados**, build/lint/diff-check aprovados (avisos antigos preservados); inspeção com fixtures nas três resoluções solicitadas. Próximo passo: validar a sequência por voz e o Word no uso real. **Etapa 1C não iniciada.**

## Atualização — Hotfix 1B.1

Validação: **50 testes aprovados**, build aprovado, lint sem erros (dois avisos anteriores) e diff-check aprovado. Hotfix localizado de contexto Ollama, seleção explícita pesquisa → Word, identidade/idempotência dos artefatos e diagnóstico. A lista de exemplos estava no prompt de produção. Veja [causas, correções, evidências e validação manual](ETAPA_1B_1.md) e [inventário das ocorrências](ORIGENS_1B_1.md). Etapa 1C permanece não iniciada; próximo passo é validar este hotfix no navegador com o modelo local.

Proposta de 23 de setembro de 2026 para revisão de Matheus Ribeiro.

Base: [estado real auditado](ESTADO_ATUAL.md), commit `7738d33`. O Jarvis web deste workspace é a base principal. O material Python permanece separado. Este documento propõe trabalho; não autoriza mudanças estruturais, instalações externas ou publicação.

## Atualização — Etapa 1B implementada

A Etapa 1B foi autorizada e implementada após a 1A. Foi reproduzida em teste uma falha de SpeechSynthesis iniciado sem evento de fim, deixando a apresentação pendente; execução e leitura agora são independentes, com cancelamento e liberação do TTS. Resultados estruturados incluem resumo falável, conteúdo completo, fontes e artefatos, com ações no blade existente. Foram acrescentados progresso real, filtros de relevância, tratamento de evidência insuficiente, metadados de vídeo e validação estrutural de citações. Consulte [implementação da Etapa 1B](ETAPA_1B.md) para causa, arquivos, limites e roteiro manual.

Validação: **43 testes aprovados**, build aprovado e lint com zero erros e os dois avisos anteriores. Ainda falta validação real de microfone, áudio, navegador, Ollama, relevância dos buscadores e layout no Word. A causa específica no computador do usuário não foi confirmada por captura de uma sessão real. Etapa 1C e integrações futuras não foram iniciadas. As seções anteriores abaixo preservam o histórico da auditoria e do planejamento.

## Situação após a Etapa 1A

Etapa 1A implementada por autorização posterior do usuário: fila e cancelamento por pedido, correlação de eventos, lançamentos sem confirmação inventada e diagnóstico ampliado. Validação automatizada: 28 testes aprovados, build aprovado e lint sem erros. Consulte [entrega e limites](ETAPA_1A.md). Validação manual no computador ainda pendente. Etapas 1B e 1C não foram iniciadas. O contrato geral de ferramentas e as extrações estruturais permanecem propostas futuras.

## Direção técnica

Manter React/Vite/Three.js no frontend e o bridge Node como runtime principal. Ollama será a inteligência prioritária. Os adaptadores existentes de serviços pagos continuam opcionais. Não criar outro dashboard ou servidor Python para repetir o que o aplicativo já faz.

O parser atual continuará útil como atalho determinístico. Uma interface comum de ferramentas deve envolver as funções existentes e servir a voz, dashboard, modelos e futuras integrações. Introduzir persistência e identidade de instalação antes de sincronizar dados entre dispositivos ou expor comandos remotos.

Todo incremento terá diagnóstico, critérios de aceite e documentação. Instalações de Node, Ollama, Python, VS Code e outros programas externos serão guiadas: detectar, explicar, fornecer instruções e aguardar a ação/autorização do responsável. O aplicativo não deve instalar programas silenciosamente em outra máquina. Iniciar um programa já instalado é uma operação diferente.

## Etapa 0 concluída nesta entrega

- Inventário da base, dependências e origens.
- Comparação com os sete módulos planejados.
- Execução segura dos testes disponíveis e registro de limitações.
- Documentação da preparação Supabase/Alexa separada.
- Proposta de prioridades, sem migração ou substituição da arquitetura.

## Etapa 1 — incrementos e critérios

Objetivo: tornar confiáveis as funções já disponíveis antes de ampliá-las.

### Incremento 1A execução e diagnóstico — implementado e testado com simulações

Reproduzir em testes os casos reais “Abra o WhatsApp”, “pesquise no YouTube e Jarvis pesquise no YouTube”, pedido sem assunto, interrupção e desconexão com fila pendente. Validar cancelamento por ID, erro recuperável e pedido seguinte funcionando. Diferenciar ação solicitada de efeito confirmado.

Mostrar no diagnóstico o backend/modelo ativo, disponibilidade de voz, estado da conexão e versão do servidor. Assim será possível distinguir código atualizado de processo antigo sem atribuir todo erro ao reconhecimento de voz.

Aceite: comandos cancelados não executam posteriormente; falha não bloqueia toda a fila; cada resposta/evento fica vinculado ao pedido correto; os testes existentes continuam passando.

### Incremento 1B pesquisa e relatórios — implementado com validação simulada

Separar abrir uma busca, obter resultados, ler uma página e resumir evidências. Avaliar consultas reais em português, incluindo vídeos. Não usar a simples presença de cinco URLs como critério de sucesso. Verificar relevância, anúncios, fonte original, bloqueio de leitura e índices de citações. Apresentar progresso em operações longas.

Aceite: consultas de referência retornam conteúdo relacionado; resultados insuficientes são identificados; relatório inclui data, fontes verificáveis, método e limitações; download funciona; cancelamento impede apresentação tardia; documento é inspecionado visualmente.

### Incremento 1C base de distribuição

Rever bind local do servidor, entradas de rede, limites, autenticação futura e alertas de dependências sem aplicar atualizações em lote. Atualizar documentação de instalação e requisitos por backend/Windows. Tornar testes executáveis por um comando padronizado e preparar CI somente após revisão da configuração.

Aceite: nenhum segredo no bundle/repositório, interface local por padrão, avisos de dependências classificados por exposição real e regressões verificadas. Instalação guiada não instala programas externos por conta própria.

### Entrega de desenho antes da primeira extração estrutural

Propor um contrato enxuto, sem mover módulos ainda:

| Contrato | Campos propostos |
| --- | --- |
| Ferramenta | ID estável, descrição, esquema de argumentos, escopos necessários, função executora |
| Contexto | ID do pedido, instalação, usuário, origem, projeto opcional, sinal de cancelamento |
| Resultado | Sucesso, estado da execução, texto falável, dados estruturados, fontes/artefatos, erro identificável |
| Permissão | Ler, abrir programa/site, escrever em pasta autorizada, ação externa e ação destrutiva, com política explícita |

Explicar quais duplicações serão extraídas de `ollama.mjs`, `gemini.mjs`, `openai.mjs` e `local-commands.mjs`, mantendo compatibilidade com o protocolo. A implementação dessa extração depende de aprovação específica.

## Etapas posteriores

| Etapa | Incrementos pequenos | Reaproveitamento | Critério de aceite |
| --- | --- | --- | --- |
| 2 Core e ferramentas | Implementar contrato aprovado; adaptar hora, abertura, pesquisa e relatório; depois expor catálogo ao Ollama | Funções locais, pesquisa e transporte existentes | Uma ferramenta funciona igual por voz e painel; permissões e cancelamento são consistentes |
| 3 Personalization | Perfil local; nome/idioma/personalidade; modelo e voz; aparência e diagnóstico; onboarding | `config.ts`, store, seleção de voz, UI existente | Duas instalações não compartilham nome, arquivos ou credenciais por padrão; perfil de Matheus preservado |
| 4 Memory local | Modelo de dados; conversas, preferências, projetos e tarefas; retenção/exportação; só depois busca semântica | Histórico das conexões e metadados dos relatórios | Reiniciar preserva o que foi autorizado; apagar/exportar funciona; memória não executa instruções como comando |
| 5 Projects | Cadastro de pastas autorizadas; metadados e tarefas; Git somente leitura; abrir VS Code; ações de escrita aprovadas depois | Abertura do editor e contrato de ferramentas | Nenhuma alteração Git/publicação implícita; projetos fora do escopo são recusados; ações têm registro |
| 6 Integrações públicas | Um conector por vez: ViaCEP/BrasilAPI, Open-Meteo, IBGE, Frankfurter; depois NASA, TMDB e OpenStreetMap | Cliente de rede, resultados/painéis e catálogo | Schema, timeout, cache, data da fonte e falha testados; limites reais verificados antes de ativar |
| 7 Serviços pessoais e nuvem | OAuth para Calendar/Gmail/Drive; memória Supabase opcional; Home Assistant; entrada Alexa | Catálogo, identidade e padrões do worker separado | Credenciais individuais, escopos mínimos, revogação, owner/device e testes de isolamento |
| 8 Automações e dashboard | Agendamentos persistentes; histórico de execuções; controles de integrações/projetos; canais de notificação | Timers e componentes React existentes | Reinício não duplica ações; tarefas podem ser pausadas/canceladas; painel mostra falhas reais |
| 9 Legacy privado | Projeto de segurança e governança; acervo local; acesso supervisionado; backups e restauração | Identidade, armazenamento e tarefas já estabilizados | Requisitos específicos abaixo; não compõe a instalação pública por padrão |

As telas de cada etapa devem ser acrescentadas quando o respectivo serviço existir; a etapa 8 consolida o dashboard, não exige adiar todas as telas até o fim. Não há cronograma fechado antes de concluir a etapa 1 e medir a complexidade do ambiente.

## Memory híbrida e Supabase

Propor armazenamento local como fonte funcional mesmo sem internet; SQLite é um candidato a avaliar, não uma dependência já instalada. Definir primeiro IDs de instalação/usuário, esquema, migrations, retenção e exportação. A busca semântica virá depois de histórico e recuperação básicos estarem corretos.

Supabase deverá ser opcional e sincronizar entidades autorizadas. Requer tabelas e políticas por proprietário, controle de conflitos, exclusão coerente e nenhuma chave privilegiada no navegador. Uma tabela de comandos não substitui o modelo de memória.

A fila Python existente pode orientar reserva/idempotência, mas não oferece isolamento multiusuário: atualmente filtra `source` e `status`. A conexão web futura deve considerar dispositivo de destino, validade do comando, autenticação da origem e recuperação após queda. Aprovação para analisar um projeto não autoriza modificar o banco existente.

## Projects e integrações de engenharia

Começar por leitura de repositório, estado Git, abertura de pasta/editor e tarefas ligadas a um projeto. Evoluir para comandos de build/teste declarados pelo projeto, em diretórios autorizados e com resultados estruturados. Git commit, push, publicação e comandos destrutivos exigem autorização apropriada; não devem resultar de texto arbitrário recebido de um site.

Laravel e Python serão tipos de projeto detectáveis, sem instalar runtimes ou pacotes externos automaticamente em outra máquina. Onshape exige estudo de autenticação, documentos e operações disponíveis antes de qualquer conector. Reutilizar a integração oficial ou API adequada em vez de inventar controle por cliques quando não for necessário.

## Legacy exclusivo da instalação de Matheus

Legacy será um módulo privado, desativado e ausente da experiência pública por padrão. Não reutilizar a pasta pública `reports/` como cofre de acervo.

O desenho deve ser aprovado antes da coleta:

- Perfis individuais, herdeiros autorizados e responsáveis de confiança, com revogação e trilha de auditoria.
- Separação explícita entre gravação/documento autêntico, transcrição, edição e interpretação gerada por IA.
- Originais imutáveis e integridade verificável; metadados de origem, data e responsáveis pela inclusão.
- Criptografia antes do envio a provedores; definição de armazenamento, recuperação e custódia de chaves.
- Cópias locais e redundantes em Google Drive e MEGA, com testes periódicos de restauração. Sincronização sozinha não é prova de backup recuperável.
- Processo de liberação supervisionado por pessoas designadas. O modelo não determina sozinho elegibilidade, falecimento ou entrega do acervo.
- Instalação e configuração guiadas, consentimento dos responsáveis e minimização de dados enviados ao modelo.

Aceite inicial do módulo: um acervo pequeno de teste pode ser restaurado em ambiente isolado; usuário não autorizado não consegue ler; original e conteúdo de IA estão visualmente diferenciados; toda liberação depende do fluxo humano aprovado.

## Regras para cada entrega

1. Registrar problema, comportamento esperado e evidência antes de modificar.
2. Escolher o menor incremento que reutilize a implementação existente.
3. Explicar mudanças estruturais e obter aprovação antes de realizá-las.
4. Testar sucesso, falha, cancelamento e limites relevantes; evitar testes que apenas repitam detalhes do código.
5. Atualizar documentação, configuração de exemplo e atribuições quando aplicável.
6. Distinguir código pronto, testes locais, ativação no computador e publicação; nunca tratar esses passos como equivalentes.

## Decisão solicitada

Validar manualmente as **Etapas 1A e 1B** entregues antes de ampliar o escopo. A Etapa 1C e as integrações posteriores requerem nova aprovação. A proposta preserva o Jarvis existente e resolve as falhas que hoje atrapalham seu uso. Extração de módulos, memória, novas integrações e Legacy permanecem aguardando suas aprovações nas etapas correspondentes.
