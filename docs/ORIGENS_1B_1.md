# Ocorrências antes do Hotfix 1B.1

Inventário de 24/09/2026, anterior às alterações. Busca por energia solar, aulas de violão/violao e example.com (incluindo subdomínios). A: produção; B: prompt/descrição enviado ao modelo; C: teste; D: documentação; E: fixture/mock; F: artefato gerado. Dependências node_modules e metadados .git excluídos; DOCX examinado separadamente. Sem conteúdo privado de arquivos de configuração.

| Arquivo | Linha | Classe | Termos |
| --- | --- | --- | --- |
| src/ui/Suggestions.tsx | 25 | A | aulas de violão |
| src/ui/Suggestions.tsx | 30 | A | energia solar |
| src/ui/Suggestions.tsx | 31 | A | energia solar |
| COMANDOS.md | 29 | D | aulas de violão |
| COMANDOS.md | 55 | D | aulas de violão |
| COMANDOS.md | 64 | D | energia solar |
| COMANDOS.md | 65 | D | energia solar |
| COMANDOS.md | 66 | D | energia solar |
| COMANDOS.md | 67 | D | example.com |
| COMANDOS.md | 68 | D | example.com |
| COMANDOS.md | 69 | D | energia solar |
| COMANDOS.md | 70 | D | energia solar |
| docs/ETAPA_1B.md | 124 | D | aulas de violão |
| bridge/research-quality.test.mjs | 7 | C/E | example.com |
| bridge/research-quality.test.mjs | 12 | C/E | Aulas de violão |
| bridge/research-quality.test.mjs | 14 | C/E | Aulas de violão |
| bridge/research-quality.test.mjs | 17 | C/E | aulas de violão |
| bridge/research-quality.test.mjs | 27 | C/E | Aulas de violão |
| bridge/research-quality.test.mjs | 35 | C/E | aulas de violão |
| bridge/research-quality.test.mjs | 43 | C/E | Energia solar |
| bridge/research-quality.test.mjs | 45 | C/E | Energia solar |
| bridge/research-quality.test.mjs | 46 | C/E | energia solar |
| bridge/research-quality.test.mjs | 59 | C/E | energia solar |
| bridge/research-quality.test.mjs | 62 | C/E | Energia solar |
| bridge/research-quality.test.mjs | 63 | C/E | energia solar |
| bridge/research-quality.test.mjs | 66 | C/E | example.com |
| bridge/research-quality.test.mjs | 68 | C/E | Energia solar |
| bridge/research-quality.test.mjs | 69 | C/E | energia solar |
| bridge/research-quality.test.mjs | 75 | C/E | Energia solar |
| bridge/research-quality.test.mjs | 78 | C/E | energia solar |
| bridge/research-quality.test.mjs | 85 | C/E | energia solar |
| bridge/panels.mjs | 114 | A/B | images.example.com |
| bridge/panels.mjs | 117 | A/B | images.example.com |
| bridge/panels.mjs | 124 | A/B | cdn.example.com |
| bridge/panels.mjs | 135 | A/B | cdn.example.com |
| bridge/ollama.mjs | 6 | A/B | energia solar, aulas de violão, example.com |
| bridge/local-commands.test.mjs | 57 | C/E | aulas de violão |
| bridge/local-commands.test.mjs | 115 | C/E | aulas de violão |
| bridge/local-commands.test.mjs | 116 | C/E | aulas de violão |
| bridge/local-commands.test.mjs | 117 | C/E | aulas de violão |
| bridge/local-commands.test.mjs | 118 | C/E | aulas de violão |
| bridge/local-commands.test.mjs | 119 | C/E | aulas de violão |
| bridge/local-commands.test.mjs | 155 | C/E | aulas de violão |
| bridge/local-commands.test.mjs | 157 | C/E | aulas de violao |
| bridge/local-commands.test.mjs | 161 | C/E | energia solar |
| bridge/local-commands.test.mjs | 162 | C/E | energia solar |
| bridge/local-commands.test.mjs | 164 | C/E | energia solar |
| bridge/local-commands.test.mjs | 165 | C/E | example.com |
| bridge/local-commands.test.mjs | 166 | C/E | example.com |
| bridge/local-commands.test.mjs | 168 | C/E | example.com |
| bridge/local-commands.mjs | 240 | A | energia solar |
| bridge/research.test.mjs | 25 | C/E | example.com |
| bridge/research.test.mjs | 31 | C/E | example.com |
| bridge/research.test.mjs | 42 | C/E | example.com |
| bridge/research.test.mjs | 43 | C/E | example.com |
| bridge/research.test.mjs | 44 | C/E | example.com |
| bridge/research.test.mjs | 48 | C/E | example.com |
| bridge/research.test.mjs | 64 | C/E | example.com |
| bridge/research.test.mjs | 82 | C/E | Energia solar, example.com |
| bridge/research.test.mjs | 88 | C/E | example.com |
| bridge/tts.test.mjs | 93 | C/E | energia solar |
| bridge/research-ui.test.mjs | 26 | C/E | Energia solar |
| bridge/research-ui.test.mjs | 27 | C/E | example.com |
| bridge/research-ui.test.mjs | 42 | C/E | example.com |

## Caminhos e funções (antes da correção)

- B: bridge/ollama.mjs, constante SYSTEM usada por ollamaConnection.answer: contém a lista inteira e a instrução para sugeri-la. Origem comprovada do conteúdo no contexto de produção.
- A/B: bridge/local-commands.mjs, createLocalCommands.tryHandle, ramo help: exemplo de energia solar apresentado quando a ajuda é solicitada; a resposta também entrava no histórico assistant do Ollama. Agora continua na ajuda, sem promoção ao histórico.
- A: src/ui/Suggestions.tsx, constante EXAMPLES e componente Suggestions: exemplos visuais da tela inicial, sem envio automático ao modelo.
- B: bridge/panels.mjs, DESIGN_SYSTEM usado nas descrições de ferramentas de painel Claude: subdomínios images.example.com/cdn.example.com em exemplos HTML. Não faz parte do SYSTEM Ollama nem da síntese de pesquisa.
- C/E: funções test e fixtures locais nos arquivos .test.mjs listados; usadas pelo executor de testes, não importadas pelos módulos de produção. Foram preservadas.
- D: COMANDOS.md e docs/ETAPA_1B.md: instruções para uso/validação, não carregadas no contexto de pesquisa.
- F: DOCX em reports examinados separadamente: dois documentos com Rick e Renner e dois contendo termos de exemplo; nenhum documento de esportes identificado nessa amostra. Não há prova de que documentos com exemplos pertençam à ocorrência relatada. O conteúdo desses arquivos não é carregado como prompt.
- F/A: o bundle gerado em dist/assets/index-*.js também contém as sugestões visuais compiladas. Dependências de terceiros e metadados Git ficaram fora do inventário do código do projeto. A busca não leu conteúdo de credenciais.

O inventário é um snapshot anterior ao patch: linhas podem mudar. Novas ocorrências neste relatório e em hotfix-1b1.test.mjs são documentação (D) e fixtures/assertions de regressão (C/E), respectivamente, sem entrada em produção.
