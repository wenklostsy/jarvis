# Comandos locais do JARVIS

Com `JARVIS_BRAIN=ollama`, `gemini` ou `openai`, estes comandos são tratados por ferramentas reais do aplicativo. Pesquisas consultam páginas públicas e usam o modelo configurado para sintetizar os resultados. Diga “Jarvis” para acordá-lo e depois use uma das frases abaixo. Enquanto ele ainda responde, diga “Jarvis” antes de um novo pedido.

| Exemplo | Resultado |
| --- | --- |
| “Jarvis, que horas são?” | Lê a hora do computador. |
| “Jarvis, abra o YouTube” | Abre YouTube no navegador padrão. Também aceita Google, GitHub, Gmail e Spotify. |
| “Jarvis, pesquise por receitas de bolo” | Pesquisa na web e apresenta uma resposta com fontes no painel. |
| “Jarvis, coloque um timer de dez minutos” | Inicia um timer e avisa por voz ao terminar. Aceita segundos, minutos e horas, até 24 horas. |
| “Jarvis, cancele os timers” | Cancela todos os timers ativos. |
| “Jarvis, abra o VS Code” | Inicia o VS Code instalado neste computador. |
| “Jarvis, abra a calculadora” | Inicia a Calculadora. |
| “Jarvis, abra o Bloco de Notas” | Inicia o Bloco de Notas. |
| “Jarvis, abra o Explorador de Arquivos” | Abre o Explorador. |

Timers duram enquanto a página e o bridge permanecem conectados. Atualizar a página ou encerrar `npm start` cancela os timers ativos. Os sites e aplicativos são uma lista permitida; frases para abrir programas arbitrários continuam sendo tratadas como conversa.

## Mais comandos em português

| Diga | Resultado |
| --- | --- |
| “O que você pode fazer?” | Explica os comandos disponíveis. |
| “Que dia da semana é hoje?” | Informa o dia e a data do computador. |
| “Abra o WhatsApp” | Abre o WhatsApp Web; não envia mensagens. |
| “Abra o ChatGPT” | Abre o site do ChatGPT. |
| “Abra a agenda” | Abre o Google Agenda; não cria eventos. |
| “Abra o Google Drive” | Abre o site do Google Drive. |
| “Pesquise no YouTube por aulas de violão” | Pesquisa páginas públicas do YouTube e apresenta fontes clicáveis; não assiste nem inicia um vídeo automaticamente. |
| “Procure farmácias no Maps” | Abre a busca no Google Maps. |
| “Previsão do tempo em São Paulo” | Pesquisa a previsão e resume apenas o conteúdo disponível, com fontes para conferir a data e o local. |
| “Abra a pasta downloads” | Abre a pasta de downloads do Windows. |
| “Abra documentos” | Abre a pasta de documentos do Windows. Também aceita imagens, fotos, vídeos, músicas, área de trabalho e lixeira. |
| “Abra o Paint” | Inicia o Paint, se disponível. |
| “Abra o Gerenciador de Tarefas” | Inicia o Gerenciador de Tarefas. |
| “Abra as configurações de som” | Abre a página de som nas configurações do Windows. |
| “Abra o Bluetooth” | Abre a página de Bluetooth; não muda o estado da conexão. Também aceita Wi-Fi, configurações de tela e configurações do Windows. |
| “Me lembre de beber água em dez minutos” | Cria um lembrete por voz para esta sessão. |
| “Me lembra daqui a meia hora de fazer uma pausa” | Cria um lembrete para trinta minutos. |
| “Quanto tempo falta?” | Lista os timers e lembretes com o tempo restante. |
| “Liste os lembretes” | Lista os timers e lembretes ativos. |
| “Cancele todos os timers” | Cancela todos os timers e lembretes da conexão atual. |

Aceita variações como “Jarvis, você pode abrir a calculadora por favor?”, “abre a calculadora pra mim” e “poderia abrir o YouTube?”. Diga um pedido por vez. Se a transcrição ouvir “Chaves” em vez de “Jarvis”, o comando também será reconhecido.

Os lembretes usam a conexão atual, não são salvos em disco e não despertam o computador suspenso. Há um limite de vinte timers/lembretes simultâneos, cada um com duração entre um segundo e vinte e quatro horas.

Após atualizar o código, encerre o servidor com Ctrl+C, execute `npm start` novamente e atualize a página. A voz atual permanece configurada.

Validação dos comandos: `node --test bridge/local-commands.test.mjs`.

## WhatsApp e busca de conteúdo no YouTube

- “Abra o WhatsApp”, “abra o WhatsApp Web”, “abre pra mim o WhatsApp” e “abra o whats app” abrem o WhatsApp Web no navegador padrão.
- “Pesquise por aulas de violão no YouTube” e “pesquise no YouTube por aulas de violão” consultam o mesmo assunto e mostram fontes no painel.
- “Abra o YouTube e pesquise por receitas de bolo” busca diretamente o conteúdo e mostra os links, em uma única ação.
- “Pesquise no YouTube” faz o Jarvis perguntar o assunto. Responda em até um minuto; diga “cancela” para desistir. Se ele não estiver ouvindo, comece a resposta com “Jarvis”.
- A busca usa páginas e trechos públicos, não o áudio completo dos vídeos. Os links permitem abrir os vídeos para validação.

## Pesquisa e relatórios em Word

| Pedido | Resultado |
| --- | --- |
| “Pesquise no Google sobre energia solar no Brasil” | Resposta baseada em fontes públicas, com links no painel. |
| “Faça uma pesquisa sobre energia solar no Brasil” | Executa a mesma pesquisa. |
| “Pesquise no site gov.br sobre energia solar” | Restringe os resultados ao domínio informado. |
| “Leia https://example.com/noticia” | Tenta ler e resumir a página pública indicada. |
| “Abra https://example.com” | Abre o endereço no navegador padrão. Também aceita “abra example.com”. |
| “Crie um relatório em Word sobre energia solar” | Pesquisa, sintetiza e gera um arquivo `.docx` editável com fontes e limitações. |
| “Pesquise energia solar e me elabore um relatório em Word” | Executa a pesquisa e entrega o Word. |
| “Gere um relatório dessa pesquisa” | Usa as fontes da última pesquisa desta conexão. |

O painel mostra o botão **Baixar relatório em Word**. Os arquivos também ficam na pasta `reports` do projeto, com nomes únicos para não sobrescrever relatórios anteriores. São preparados para validação de Matheus Ribeiro, com a data da consulta e links das fontes. Não são enviados a terceiros.

O Google é tentado primeiro. Se ele não disponibilizar resultados legíveis, o Jarvis tenta DuckDuckGo e Bing e identifica o provedor realmente utilizado. Não é necessário configurar uma chave de busca. Páginas com login, CAPTCHA, bloqueio automático, PDFs ou conteúdo dependente de JavaScript podem não ser legíveis. Nesses casos, o painel identifica se apenas o trecho do buscador foi consultado. Se a síntese pelo modelo falhar, o Jarvis entrega os trechos coletados e informa a limitação.

A leitura de páginas não dá a esses sites permissão para executar comandos. Instruções contidas nas fontes são tratadas como conteúdo, e a pesquisa não envia mensagens, faz compras ou apaga arquivos.

Testes: `node --test bridge/local-commands.test.mjs bridge/research.test.mjs`.
