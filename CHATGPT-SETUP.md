# JARVIS com Ollama, Gemini ou OpenAI no Windows

A configuração atual usa Ollama com `qwen3.5:4b` no próprio computador. Não precisa de chave de API nem consome a cota do Gemini. O `npm start` inicia o Ollama automaticamente quando necessário.

1. Execute `npm start` nesta pasta.
2. Abra a URL localhost exibida no Chrome ou Edge, clique em INITIALISE e permita o microfone.
3. Diga “Hey Jarvis” ou use a barra de espaço para falar em português.

Para trocar o modelo local, altere `JARVIS_LOCAL_MODEL` no `.env` para outro modelo já instalado no Ollama (por exemplo, `gemma3:4b`). Modelos locais menores podem responder mais devagar e ter menos capacidade que modelos grandes na nuvem.

Gemini continua opcional: use `JARVIS_BRAIN=gemini`, `JARVIS_MODEL=gemini-3.5-flash` e `GEMINI_API_KEY`. A cota gratuita é limitada. Para a API paga da OpenAI, use `JARVIS_BRAIN=openai`, `JARVIS_MODEL=gpt-5.1` e `OPENAI_API_KEY`. A assinatura do ChatGPT não inclui uso da API. O backend original usa `JARVIS_BRAIN=claude` e Claude Code. Esses backends alternativos não oferecem as ferramentas MCP originais do Claude.
