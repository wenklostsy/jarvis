# Origem e licenças dos componentes

Inventário técnico de 23 de setembro de 2026, baseado no histórico Git local e nos manifests instalados. As declarações abaixo registram o que foi encontrado; termos de serviços, modelos e distribuição devem ser conferidos quando cada componente for ativado ou distribuído.

## Base incorporada do GitHub

O clone principal aponta para `origin=https://github.com/wenklostsy/jarvis.git` e `upstream=https://github.com/adewaskar/jarvis.git`. A referência upstream local é `1c4016a`. O arquivo `LICENSE` declara MIT, com copyright de 2026 de Aditya Dewaskar.

O histórico confirma a incorporação da aplicação inteira como base: React/Three.js, bridge Claude, áudio, câmera, gestos, proxy de páginas e ferramentas visuais já existiam antes das adaptações locais. A preservação desse trabalho deve incluir a licença e as atribuições, mesmo com personalização de nome, aparência ou backend.

As adaptações posteriores constam dos commits locais `e2f3acf` e `7738d33`: português, Windows/Ollama e alternativas de modelo, comandos locais, pesquisas e relatórios Word. Esses commits identificam a evolução posterior ao upstream; não permitem atribuir autoria humana específica a cada linha sem análise adicional.

Não foram localizados submódulos Git ou outro repositório de interface incorporado dentro dos arquivos versionados. As bibliotecas npm são dependências, não evidência de que seus repositórios tenham sido copiados manualmente. A pasta `.jarvis-cloud-stage` não apresenta histórico Git próprio no escopo examinado.

## Dependências de execução

Versões abaixo são as instaladas durante a auditoria; faixas do `package.json` podem ser diferentes das versões resolvidas no lockfile.

| Pacote | Versão instalada | Licença declarada no pacote | Uso |
| --- | --- | --- | --- |
| `react` | 19.2.8 | MIT | Componentes da interface |
| `react-dom` | 19.2.8 | MIT | Renderização no navegador |
| `three` | 0.185.1 | MIT | Gráficos 3D |
| `@react-three/fiber` | 9.7.0 | MIT | Integração React/Three |
| `@react-three/drei` | 10.7.7 | MIT | Recursos auxiliares da cena |
| `@react-three/postprocessing` | 3.0.4 | MIT | Efeitos visuais |
| `framer-motion` | 12.43.0 | MIT | Animações da interface |
| `zustand` | 5.0.14 | MIT | Estado da aplicação |
| `@mediapipe/tasks-vision` | 1.0.1 | Apache-2.0 | Detecção de mãos |
| `@picovoice/porcupine-web` | 4.0.1 | Apache-2.0 | Dependência de wake word; integração operacional não confirmada |
| `@picovoice/web-voice-processor` | 4.0.10 | Apache-2.0 | Dependência auxiliar de áudio |
| `kokoro-js` | 1.2.1 | Apache-2.0 | Voz neural opcional no navegador |
| `@anthropic-ai/sdk` | 0.115.0 | MIT | Modo Anthropic direto |
| `@anthropic-ai/claude-agent-sdk` | 0.3.220 | `SEE LICENSE IN README.md` | Caminho Claude/MCP |
| `ws` | 8.21.1 | MIT | Transporte WebSocket |
| `zod` | 4.4.3 | MIT | Esquemas e validações |
| `dompurify` | 3.4.12 | MPL-2.0 ou Apache-2.0 | Sanitização da interface |
| `linkedom` | 0.18.13 | ISC | Leitura e extração de HTML/XML |
| `docx` | 9.7.1 | MIT | Geração de Word |

Não classificar automaticamente o Claude Agent SDK como MIT por estar dentro de um projeto MIT: o manifest remete ao README próprio, que contém referências aos termos comerciais e políticas da Anthropic.

## Ferramentas de desenvolvimento

| Pacote | Versão instalada | Licença declarada |
| --- | --- | --- |
| `vite` | 8.2.0 | MIT |
| `@vitejs/plugin-react` | 6.0.5 | MIT |
| `typescript` | 6.0.3 | Apache-2.0 |
| `oxlint` | 1.76.0 | MIT |
| `tsx` | 4.23.1 | MIT |
| `@types/dompurify` | 3.0.5 | MIT |
| `@types/node` | 24.13.3 | MIT |
| `@types/react` | 19.2.18 | MIT |
| `@types/react-dom` | 19.2.4 | MIT |
| `@types/three` | 0.185.3 | MIT |
| `@types/ws` | 8.18.1 | MIT |

Este é um inventário de dependências diretas. As transitivas são registradas em `package-lock.json`; uma distribuição futura deve gerar inventário completo e avisos de terceiros a partir dele, incluindo binários/modelos, sem presumir que a licença direta cubra todos os artefatos.

## Áudio e modelos externos

`public/audio/CREDITS.md` atribui as três faixas a Kevin MacLeod, sob Creative Commons Attribution 4.0:

| Arquivo | Faixa |
| --- | --- |
| `boot-music.mp3` | Impact Prelude |
| `ambient.mp3` | Ossuary 6 – Air |
| `work.mp3` | Mechanolith |

Preservar a atribuição existente nas distribuições e usos relevantes. Os pequenos efeitos sonoros padrão são sintetizados por Web Audio, conforme o código/documentação da base.

Os modelos também merecem inventário separado das bibliotecas:

- `hands.ts` referencia o modelo MediaPipe Hand Landmarker hospedado no Google Storage.
- `kokoro.ts` referencia `onnx-community/Kokoro-82M-v1.0-ONNX`.
- O modelo local configurado no Ollama é `qwen3.5:4b`; o repositório web não contém seus pesos nem prova sua licença de distribuição.
- A voz Python `pm_alex` instalada experimentalmente foi removida anteriormente; não deve ser confundida com o Kokoro opcional que já existia na base web.

Nenhum arquivo de licença, crédito musical ou componente de terceiro foi removido nesta auditoria. O corpo original do README foi mantido e recebeu uma nota com o estado atual desta instalação.
