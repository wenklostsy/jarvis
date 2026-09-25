# Inventário anterior à Etapa 1C.1

Verificação em 25/09/2026. Este documento registra o estado anterior às alterações; não declara a Etapa 1C.1 concluída.

## Origem do áudio

`src/App.tsx`, função `ignite`, dispara três fontes na mesma inicialização: `sfx.play('boot')`, `music.playBoot()` e `music.startAmbient()`. Portanto, ouvir fala e música juntas não demonstra que estejam editadas no mesmo arquivo.

| Fonte | Classificação | Gatilho e volume atual | Evidência e tratamento previsto |
|---|---|---|---|
| `src/lib/sfx.ts`, cue `boot` | SFX sintetizado | Clique para iniciar; master 0,5 | Web Audio, separado dos MP3. Preservar. |
| `public/audio/boot-music.mp3` | VOICE / possível mistura com SFX ou música | Mesmo clique; volume 0,85; reprodução única com fade final | Histórico identifica gravação de abertura com fala. Não recortar sem identificar limites do trecho. |
| `public/audio/ambient.mp3` | MUSIC segundo o histórico; conteúdo não confirmado por escuta | Mesmo clique; volume 0,1; reprodução única; duck para 35% durante fala | Arquivo substituído por gravação fornecida no histórico. Preservar original; artista/faixa ainda não confirmados. |
| `public/audio/work.mp3` | MUSIC | Durante ferramenta; volume 0,11; loop; duck para 35% | Metadados identificam Mechanolith / Kevin MacLeod. Preservar créditos existentes. |
| Cues `wake`, `listen`, `tool`, `done`, `error` em `src/lib/sfx.ts` | SFX sintetizados | Eventos de interação; master 0,5 | Independentes da gravação de abertura. Preservar. |

Não foram encontrados overrides `boot.mp3`, `wake.mp3`, `listen.mp3`, `tool.mp3`, `done.mp3` ou `error.mp3` em `public/audio`.

### Evidência no histórico

- Commit `9e3413b9a08ab991dbedc92951be5761c576a117`: restaura `boot-music.mp3` como som de abertura que fala o nome; coloca a gravação fornecida em `ambient.mp3` como música de fundo. Descreve os dois tocando no mesmo clique. Cita duração de 16,8 segundos para o boot restaurado; esse número vem do histórico, não de uma medição nesta auditoria.
- Commit `5fc8a86c45146b525516653f92e9e31c34788ef8`: havia substituído o boot pela gravação fornecida; o commit seguinte corrige essa atribuição.
- `src/lib/music.ts` também descreve a introdução como a faixa que contém palavras.
- `public/audio/CREDITS.md` atribui os três arquivos a Kevin MacLeod, mas não acompanha as substituições descritas acima. Não usar esse texto como comprovação da origem/licença dos dois arquivos substituídos. Nenhuma licença ou atribuição original foi removida nesta auditoria.

Matheus informou que pode haver uma edição entre uma frase em inglês e AC/DC. O histórico identifica qual arquivo é destinado à fala, mas **não comprova a frase exata, o idioma, a faixa de AC/DC ou se também existe mistura interna em um dos arquivos**. Não houve escuta ou transcrição verificável nesta sessão. Essa limitação deve permanecer explícita; não afirmar separação de voz/música ou remoção seletiva já realizada.

### Integridade dos originais

SHA-256 calculado antes de qualquer alteração de áudio:

```text
boot-music.mp3  8C2A016312EE516251B046CEADA73D37D2CFB29697AD41BA9EA77A54F6287E43
ambient.mp3     97DEEE9732CE9226843C84FAF014373906AE5B98CAC89AB7B4E231A8542B1FD7
work.mp3        56159A05EB0D1B9AB98A31D4892BDB52D7A9EE925BDE0F41CF314998275CE759
```

Os três arquivos já estavam versionados. Não foram baixados, copiados, recortados, substituídos ou removidos. Nenhuma publicação foi realizada.

## Boot visual e estado operacional atual

- `src/ui/Boot.tsx`: sequência por tempo, com anéis, silhueta humana SVG (`Suit`) e reator SVG (`Reactor`); rótulos `RT / ENERGIA` e `DEP / MK` pertencem à silhueta.
- Mensagens `OK` e `JARVIS PRONTO` são produzidas por relógio; não comprovam readiness.
- `src/App.tsx`: aguarda a sequência de 9,2 segundos e depois inicialização do microfone. A permissão pendente pode manter a tela em boot.

## Reprodução da versão final 1C antes de mudanças

Bridge novo em loopback na porta 18787 e Vite na 5178, com origins exatas dessas páginas, sem flexibilizar autenticação. No navegador real, após clicar em iniciar e abrir diagnóstico com D:

- WebSocket: conectado; backend: Ollama; código em execução correspondente ao código em disco.
- Nenhuma mensagem de sessão recusada apareceu nessa tentativa.
- Ollama: indisponível.
- Reconhecedor: parado; boot ainda ativo; nenhuma nova permissão de microfone concedida.
- Mesmo assim, a apresentação já mostrava `JARVIS PRONTO`, confirmando a necessidade de substituir os indicadores temporizados por verificações reais.

Isso não prova que o erro de sessão nunca ocorra. A implementação seguinte deve testar `SESSION_REJECTED` por simulação controlada, além de preservar os testes HTTP/WS existentes.
