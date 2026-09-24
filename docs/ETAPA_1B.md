# Etapa 1B — pesquisa e leitura interativa

Implementação incremental de 23/09/2026. Mantidos o controle da Etapa 1A, React/Vite/Three.js/Zustand, bridge Node e Ollama principal. Não foram implementados Google Docs, Memory, Projects, Supabase ou novas integrações.

## Bloqueio: evidência e causa corrigida

Antes de mudar o comportamento, foram acrescentados contadores/estados ao TTS e executado um teste que simula `SpeechSynthesis.onstart` sem `onend` nem `onerror`. O teste falhou: `speaker.end()` continuava pendente mesmo após avançar o relógio simulado em dois minutos.

O código anterior limpava seu watchdog assim que a fala começava, sem outro caminho para terminar uma fala iniciada que parasse silenciosamente. Em `App.tsx`, o retorno à escuta acontecia somente depois de `await spk.end()`. Logo, o bridge podia já ter concluído a pesquisa enquanto a apresentação permanecia em `speaking`. Isso reproduz uma causa compatível com o relato, mas não comprova qual evento ocorreu no navegador do usuário: não foi capturada uma sessão real com microfone.

Outros caminhos revisados: geração de áudio aguardada sem limite próprio; mídia sem eventos terminais; dependência de eventos do navegador para liberar recursos após cancelamento; nova resposta substituindo a referência ao speaker sem cancelar explicitamente o anterior.

## Antes e depois

| Antes | Depois |
| --- | --- |
| A conclusão do fluxo visual aguardava a drenagem da fala | Execução e apresentação têm finais separados; `respond()` libera a execução quando chega o resultado |
| Fala iniciada sem evento final podia aguardar indefinidamente | Segmentos têm prazo de recuperação e liberam a fila/recursos mesmo sem evento final |
| Novo comando dependia do barge-in ter cancelado o speaker antigo | Toda nova resposta cancela explicitamente a apresentação anterior |
| Resultado completo e texto falado eram quase o mesmo conteúdo | Conteúdo, resumo falável, fontes e artefatos são campos distintos |
| Relatório usava somente a última pesquisa da conexão | Botão identifica a pesquisa selecionada; voz continua usando a pesquisa atual da sessão |

O limite de execução do bridge e o timeout WebSocket da Etapa 1A não foram aumentados.

## TTS e liberação de recursos

- Texto falado é dividido em segmentos de até 240 caracteres, sem reduzir o conteúdo visual.
- A ausência de início termina a tentativa após 2,2 segundos, sem repetir automaticamente a mesma fala e arriscar leitura duplicada.
- Um segmento tem prazo calculado pela quantidade de palavras, com margem de inicialização, piso de 12 segundos e teto de 60 segundos. O prazo é uma recuperação de evento ausente e pode interromper uma voz excepcionalmente lenta; não é estimativa percentual de progresso.
- Fim, erro, interrupção ou timeout liberam os aguardantes de `end()`, timers e animação. Áudio gerado utiliza `AbortSignal`; elementos de mídia são pausados, URLs temporárias revogadas e nós de áudio desconectados.
- Uma geração que ignore cancelamento, como trabalho interno do motor neural, pode continuar computando; o resultado tardio é descartado e sua URL revogada. Não se afirma interrupção física de todo motor externo.
- A instância antiga não controla o estado da nova resposta. Barge-in continua disponível, sujeito ao reconhecimento e aos filtros de eco existentes.
- Falha de áudio não falha a pesquisa já concluída. O resultado permanece disponível e o usuário pode pedir outra ação ou ouvir novamente.

Não foi exposto botão de pausa/continuação: o caminho nativo usa pause/resume como keepalive, e o caminho de mídia trata pausa como término para garantir liberação. A interface oferece parar e ouvir novamente, sem anunciar uma pausa confiável que os motores atuais não garantem.

## Modelo de resultado

O evento `blade` continua compatível com a Etapa 1A, incluindo `ask` e HTML de fallback. Acrescenta `research` estruturado:

- `id`, `query`, `date`, `provider`;
- `content`: síntese visual completa recebida, sem corte para caber na fala;
- `spokenSummary`: trecho inicial de até 65 palavras, número de fontes selecionadas e indicação do painel;
- `sources`: títulos, URLs, estado de leitura, publicação quando encontrada e natureza da fonte;
- `artifacts`: documentos produzidos pelo gerador DOCX existente;
- `limitations` e `actions`: limites explícitos e catálogo de ações conhecido pela interface.

O resumo falável é extrativo, não uma segunda chamada de geração. A aplicação mantém até dez resultados por conexão para ações contextuais; o painel conserva seu limite anterior de seis blades. Isso é estado de sessão, não Memory. Reconectar ou reiniciar perde os resultados acionáveis no servidor; a ação sobre um ID expirado informa indisponibilidade e não utiliza silenciosamente outra pesquisa.

Continuam existindo limites de coleta/contexto independentes da voz: até cinco fontes, leitura de até 2 MB por página, extração textual parcial e orçamento do modelo. Conteúdo completo significa a síntese produzida e apresentada, não cópia integral de todas as páginas. Estes limites são diferentes de cortar a síntese visual para adaptar o TTS.

## Ações e interface

O componente `ResearchResult` é renderizado dentro do blade existente, com a mesma estética, sem segundo dashboard.

| Ação | Comportamento |
| --- | --- |
| Ouvir resumo | Usa `createSpeaker`, cancela a fala anterior e reproduz o resumo daquele resultado |
| Parar leitura | Usa o mesmo cancelamento de áudio do fluxo de voz; não apaga o resultado |
| Ver conteúdo completo | Mostra a síntese inteira daquele resultado |
| Ver fontes | Mostra links, estado da leitura e data de publicação disponível |
| Abrir fonte | Link HTTP(S) em nova aba, sem opener; não afirma que a página foi lida integralmente |
| Pesquisar novamente | Reexecuta o comando original no serviço de pesquisa, com novo ID de resultado |
| Gerar relatório Word | Reutiliza a pesquisa identificada e chama o gerador existente; não refaz a coleta nem a síntese |

Cliques repetidos na mesma ação pendente são deduplicados. IDs de pesquisas são procurados somente na conexão atual. Botões não enviam texto da página como código ou comandos arbitrários.

“Ouvir resumo”, “Pare a leitura” e “Pesquise novamente” são encaminhados ao mesmo despachante dos botões, usando a pesquisa focada ou a mais recente no painel. “Gere um relatório dessa pesquisa” continua usando o comando de voz existente e a mesma operação interna de exportação. Para exportar uma pesquisa específica antiga, use seu botão.

Os estados reais `searching`, `found`, `reading`, `synthesizing`, `reporting`, `completed` e `failed` viajam em `progress`. A interface mostra busca, quantidade encontrada, leituras concluídas, síntese e Word no indicador de atividade existente. Leituras são paralelas: “2 de 5” conta respostas de leitura terminadas, sem afirmar sucesso em todas. Não há percentuais inventados.

## Qualidade e YouTube

Resultados são filtrados por termos normalizados do assunto, domínio solicitado e, no YouTube, URLs de vídeo reconhecidas. Domínios institucionais recebem preferência pequena entre resultados lexicalmente relevantes; isso não certifica autoria ou transforma toda fonte institucional em fonte primária.

Anúncios identificáveis e URLs de redirecionamento publicitário são descartados. Se um buscador só trouxer itens irrelevantes, a busca tenta o próximo. Se nenhum trouxer evidência pertinente/legível, informa a insuficiência, sem tratar a mera presença de URLs como sucesso.

Páginas bloqueadas, CAPTCHA identificável, formato não suportado e texto insuficiente ficam marcados como não lidos. Datas de publicação são extraídas de metadados explícitos quando presentes; a data da pesquisa não é apresentada como data da fonte. Falta de data não vira uma data inventada.

Síntese sem citações ou com índices fora do conjunto de fontes é substituída por trechos coletados identificados como tal. Se só há trechos de busca, não se apresenta uma conclusão factual gerada como se as páginas tivessem sido lidas. A validação de índices é estrutural: não garante que cada frase seja implicada pela fonte. Essa revisão e a avaliação de relevância real continuam necessárias.

No YouTube, o sistema pesquisa títulos/trechos e lê descrição pública em metadados quando disponível. Não envia o corpo de recomendações da página como conteúdo do vídeo. Os resultados registram `transcriptAvailable: false` e `videoAnalyzed: false`, com limitação visível. Encontrar ou abrir um vídeo não significa assistir, transcrever ou analisar seu conteúdo.

## Diagnóstico sem conteúdo privado

Tecla **D**: ID, estado da pesquisa/modelo, estado do bridge e frontend, fila, controller ativo, caracteres de resultado/fala, quantidade/posição de segmentos, início/fim de reprodução, motivo de interrupção e instante de conclusão da execução.

Foram removidas cópias de transcrições dos diagnósticos de reconhecimento (`heard`, `holding` e mensagens de descarte) e do campo de texto do TTS. O histórico visual da conversa continua funcionando. Os diagnósticos não guardam prompts, transcrições completas nem chaves. Esses dados são contadores e estados em memória, não um novo serviço de logs.

## Arquivos principais

| Área | Arquivos |
| --- | --- |
| Ciclo da apresentação | `src/App.tsx`, `src/lib/tts.ts`, `src/lib/voice.ts` |
| Transporte/estado | `src/lib/bridge.ts`, `src/lib/brain.ts`, `src/store.ts`, `bridge/requests.mjs` |
| Pesquisa e qualidade | `bridge/research.mjs`, `bridge/research-quality.mjs` |
| Ações nos adaptadores | `bridge/ollama.mjs`, `bridge/gemini.mjs`, `bridge/openai.mjs` |
| Painel e ações | `src/lib/research-actions.ts`, `src/ui/ResearchResult.tsx`, `src/ui/Blades.tsx`, `src/ui/Diagnostics.tsx`, `src/index.css` |
| Word | `bridge/reports.mjs`: limitações específicas e publicação das fontes no gerador existente |
| Testes novos | `bridge/tts.test.mjs`, `bridge/research-quality.test.mjs`, `bridge/research-ui.test.mjs` |

## Validação automatizada

```powershell
node --test bridge/local-commands.test.mjs bridge/research.test.mjs bridge/requests.test.mjs bridge/frontend.test.mjs bridge/claude-lifecycle.test.mjs bridge/tts.test.mjs bridge/research-quality.test.mjs bridge/research-ui.test.mjs
npm run build
npm run lint
```

Cobertura: suíte da Etapa 1A; resposta curta/longa; evidência insuficiente; fonte inacessível; irrelevância; vídeos em português; metadados separados de recomendações; IDs de citações; relatório de pesquisa selecionada; botões e links; clique duplo; TTS normal/com erro/sem evento final; cancelamento de geração/reprodução; novo comando durante ou depois da leitura.

Os testes usam o código real de TTS e o fluxo `respond` de App transpilados, com APIs de navegador/modelos simuladas. O componente de resultado é exercitado com hooks/elementos simulados para conferir ações e links; isso não substitui uma inspeção visual no navegador. O teste preexistente do DOCX inspeciona o arquivo temporário e seus links, não o layout final no Word. Nenhuma conta externa, microfone ou aplicativo Windows é acionado pelos novos testes.

Resultado final e pendências de validação são registrados também em `ESTADO_ATUAL.md`.

## Validação manual necessária

1. Encerrar normalmente a instância antiga, executar `npm start` na pasta do projeto e atualizar a página.
2. Abrir D e conferir instância/código, backend e disponibilidade local do Ollama.
3. Pesquisar um assunto curto e outro longo. Conferir que execução fica concluída enquanto a apresentação pode continuar falando.
4. Durante a fala, dizer “Jarvis, que horas são?”; repetir após parar a leitura e após uma falha de voz. Conferir uma resposta única e ausência de texto antigo.
5. Testar ouvir/parar, conteúdo completo, fontes, fonte em nova aba, nova busca e Word.
6. Abrir duas pesquisas e gerar Word da primeira: conferir assunto/fontes corretos e documento legível no Word.
7. Testar “aulas de violão para iniciantes” e “receitas de bolo de cenoura” no YouTube, verificando relevância real e ausência de alegação de análise do vídeo.

Limites remanescentes: APIs do navegador e barge-in variam por dispositivo; motores externos podem continuar computando após cancelamento; buscadores públicos mudam/bloqueiam acesso; filtro lexical tem falsos positivos/negativos; citações precisam de revisão factual; pausa/retomada não foi anunciada; ausência de teste manual não equivale a funcionamento confirmado no computador do usuário.

Próxima etapa recomendada: validar este roteiro no computador e ajustar com os diagnósticos observados. Etapa 1C e integrações posteriores continuam dependendo de aprovação. Não houve alteração de credenciais, instalação externa, commit, push, publicação ou reinício da instância do usuário.
