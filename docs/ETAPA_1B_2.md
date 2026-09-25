# Etapa 1B.2 — HUD, histórico e interação contextual

Implementação incremental em 24/09/2026. React/Vite/Three.js/Zustand, bridge, modelos e integrações foram preservados. Etapa 1C **não iniciada**.

## Antes e depois

O HUD renderizava quatro mensagens completas em uma faixa sobre o reator. Os blades ficavam centralizados, e fechar um resultado removia seu registro visual. A escolha da pesquisa por voz dependia da lista visível, podendo mudar após fechar um painel.

Agora cada região tem uma responsabilidade:

| Região | Responsabilidade |
| --- | --- |
| Centro | Reator original, animações, estado; faixa inferior com último comando e última resposta conversacional daquele comando |
| Lateral direita | Um blade em primeiro plano; conteúdo completo, fontes e ações de pesquisa |
| Controle superior esquerdo | Abrir histórico e identificar/reabrir a pesquisa ativa, inclusive minimizada ou fechada |
| Histórico lateral esquerdo | Mensagens da sessão, avisos e acesso aos resultados anteriores; só renderizado quando aberto |
| Notificação superior | Aviso operacional breve, dispensável; não substitui o registro da sessão |

As mensagens centrais têm prévia de até 160 caracteres, com poucas linhas e acesso ao histórico para leitura integral. O histórico aberto substitui a faixa de interação atual, evitando repetir a mesma conversa nas duas regiões. Resultados estruturados aparecem no `ResearchResult`; o histórico aponta para o resultado, em vez de repetir a pesquisa inteira. O efeito original de decodificação foi extraído para `DecodeText.tsx` e aplicado somente à resposta atual curta. Cena, partículas, reator, cores por fase, fontes e efeitos Three.js não foram alterados.

## Histórico e notificações

O botão **Histórico** abre/recolhe o painel. Há controles explícitos de recolher e fechar, foco por teclado, `aria-expanded` e retorno do foco ao botão ao fechar. O painel tem rolagem interna. Nenhuma lista de mensagens históricas fica montada quando recolhido.

O limite anterior de mensagens foi mantido: até 41 registros recentes em memória. Sem persistência: recarregar apaga o estado; reconectar preserva o que já está visualmente na página, mas não recria a memória do backend. Pesquisas continuam sujeitas à validade da conexão.

Operações sinalizadas como ferramenta, respostas de pesquisa, lembretes e controles de leitura usam notificações. Comandos diretos comuns de abertura/fechamento recebem também apresentação operacional; essa classificação visual não executa ações nem altera o parser. Uma formulação não classificada pode continuar como resposta curta no centro.

`completeTurn` publica a notificação ao terminar a execução, sem aguardar TTS. Ela some após 5,5 segundos ou ao clicar em dispensar. Só há uma notificação atual. O timer é limpo ao trocar o aviso/desmontar o componente; um timer antigo não remove outro aviso. Avisos importantes recebidos por `setError` são também registrados no histórico, mesmo após limpar o erro atual. Notificações não confirmam ações adicionais: usam a resposta recebida; pesquisa informa apenas que há resultado no painel.

## Pesquisa ativa, aberta, minimizada e fechada

`activeResearchId` é uma identidade explícita, separada de `focusedBlade` e de `visibility`.

- **Ativa:** alvo de “dessa pesquisa”, mostrado no controle superior esquerdo. Uma nova pesquisa se torna ativa. Selecionar/reabrir um resultado pelo histórico ou interagir com ele por ponteiro/foco de teclado o torna ativo.
- **Aberta:** pode aparecer na lateral direita; somente o blade em primeiro plano é montado. Os outros registros permanecem disponíveis no histórico ou pelos atalhos de alternância.
- **Minimizada:** sai da renderização, conserva dados e identidade ativa; pode ser reaberta.
- **Fechada visualmente:** para pesquisas, o X esconde o painel sem remover o objeto, cancelar requisição ou trocar silenciosamente `activeResearchId`. O histórico permite reabertura. Outros tipos de blade mantêm o comportamento anterior de remoção ao fechar.

Depois de minimizar/fechar A, outro painel B aberto pode ficar visível, mas A permanece identificada como ativa até uma seleção explícita ou nova pesquisa. Clicar/focar B seleciona B. O botão Word de qualquer resultado sempre usa o ID daquele resultado. Voz usa o `activeResearchId`; nunca há fallback silencioso para outra pesquisa se esse ID não estiver disponível. O backend mantém a recusa de resultados expirados do Hotfix 1B.1.

Atualizações de um resultado existente preservam sua visibilidade: um Word que termina de gerar não reabre um painel que o usuário acabou de fechar. O frontend conserva até dez pesquisas, alinhado à janela do backend, e até seis outros blades. Limpar explicitamente a tela continua com seu comportamento anterior; fechar visualmente é uma operação distinta.

O conteúdo de `ResearchResult` e todas as operações existentes foram preservados. Botões e voz continuam passando por `runResultAction` e pelo mesmo `researchId`, sem um segundo caminho de geração.

## Controles e acessibilidade

- Novos botões: Histórico, Recolher/Fechar histórico, Pesquisa ativa/reabrir e Minimizar painel.
- Atalhos preservados: D diagnóstico, Espaço falar, G gestos, V voz, T teste de voz, Escape espera, E expandir/recolher blade, X fechar e [ / ] alternar blades abertos.
- Nenhum novo atalho global. Espaço/Enter sobre botão, link ou `summary` respeita a ativação nativa, sem disparar o comando global de falar; campos editáveis também não disparam esse comando.
- Botões possuem labels, indicação ativa e foco visível. Referências a pesquisas já removidas da janela da sessão ficam desabilitadas.
- Expansão em tela cheia continua explícita. A lateral usa scroll, ações quebram linha, arrasto fica limitado ao viewport e redimensionamento é limitado pela área lateral; E permite uma leitura maior.

## Inspeção visual e responsividade

Teste real no navegador integrado, em uma página de fixtures com os componentes de produção (`tests/hud-preview.html`), sem ligar microfone, Ollama ou executar pesquisas. Foram inspecionadas screenshots e limites DOM nas três resoluções:

| Viewport | Histórico (largura × altura) | Blade lateral (largura × altura) | Resultado observado |
| --- | --- | --- | --- |
| 1920×1080 | 350×826 | 450×818 | Controles e painéis dentro do viewport; centro com prévia curta |
| 1600×900 | 350×646 | 450×638 | Histórico e pesquisa em laterais separadas; reator visível |
| 1366×768 | 310×520 | 360×518 | Ações quebram linha; rolagem interna mantém acesso ao conteúdo |

Também foram exercitados abrir/fechar histórico, selecionar a pesquisa antiga, minimizar e reabrir sem trocar a pesquisa ativa. A notificação apareceu e desapareceu durante a inspeção. Isso valida os cenários com fixtures; não equivale a aprovação de todas as combinações de conteúdo, zoom, navegador, gestos ou estado de voz.

## Arquivos desta etapa

- `src/ui/Hud.tsx`: entrega da conversa ao componente de sessão, preservando o restante do HUD.
- `src/ui/SessionHud.tsx`: interação curta, histórico, referências de pesquisa e aviso temporário.
- `src/ui/DecodeText.tsx`: efeito existente extraído e reutilizado.
- `src/lib/hud-session.ts`: seleção da interação atual, prévia e limpeza do timer.
- `src/store.ts`: identidade ativa, visibilidade, notificações e registro de erros.
- `src/ui/Blades.tsx`: minimizar, renderização do primeiro plano, foco e arrasto limitado.
- `src/App.tsx`: seleção explícita para voz, classificação visual e conclusão da notificação independente do TTS; respeito ao teclado dos controles.
- `src/index.css`: posicionamento lateral, responsividade, contraste e foco.
- `bridge/hud-session.test.mjs`: cinco testes novos; `tests/hud-preview.html`: cenário manual isolado de desenvolvimento, fora da entrada do build de produção.
- Documentação: este arquivo, `ESTADO_ATUAL.md` e `ROADMAP.md`.

As alterações do Hotfix 1B.1 já presentes no working tree foram preservadas. Não houve alterações adicionais no backend nesta etapa, instalação de dependências, credenciais, commit ou push.

## Testes automatizados

Cinco testes novos cobrem: abertura/fechamento; migração de mensagens e limite no centro; sequência A → B → foco A → Word → minimizar → histórico → novo comando, por voz e botão; fechamento sem destruição; atualização sem reabertura involuntária; expiração/cleanup de notificações; persistência do erro no histórico; conteúdo histórico desmontado quando fechado; aviso publicado antes do fim da fala e lembrete não confundido com pesquisa.

Suíte completa: **55 testes aprovados**, incluindo todos os 50 das etapas anteriores. Build aprovado; lint sem erros, com os dois avisos anteriores (`err`, `probeUrl`); diff-check aprovado. Avisos anteriores do build sobre módulos Node externalizados e tamanho de chunks foram preservados.

```powershell
node --test bridge/local-commands.test.mjs bridge/research.test.mjs bridge/requests.test.mjs bridge/frontend.test.mjs bridge/claude-lifecycle.test.mjs bridge/tts.test.mjs bridge/research-quality.test.mjs bridge/research-ui.test.mjs bridge/hotfix-1b1.test.mjs bridge/hud-session.test.mjs
npm run build
npm run lint
git diff --check
```

## Roteiro curto no uso real

1. Atualizar a página e iniciar o JARVIS; pesquisar A e depois B.
2. Abrir Histórico, selecionar A e dizer “gere um relatório dessa pesquisa”; conferir que o Word corresponde a A.
3. Minimizar A, dar um novo comando, reabrir Histórico e reabrir A. Fechar A pelo X e verificar que continua marcada como ativa, sem selecionar B automaticamente.
4. Exercitar Ouvir resumo, Parar leitura, Ver fontes, Abrir fonte, Pesquisar novamente e Word por botão.
5. Conferir notificações, acesso integral às mensagens longas e avisos no histórico. Testar teclado D/E/X/[ / ] e Espaço em um botão.

Ainda precisam de validação no uso real: voz/microfone, interrupção com gestos, áudio, download de Word após a sequência visual, zoom e contraste no monitor do usuário. Não houve medição de FPS; o histórico fechado e blades fora do primeiro plano ficam desmontados, sem novos listeners globais ou loops React por frame. O loop de decodificação já existente ficou restrito a uma prévia curta. Não há Memory, novas integrações ou implementação da Etapa 1C.
