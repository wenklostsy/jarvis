# Preparação Python e Supabase separada

Registro de 23 de setembro de 2026. Por decisão de Matheus Ribeiro, o Jarvis web deste workspace é a base principal. Este documento descreve somente o material encontrado na pasta irmã `.jarvis-cloud-stage`; não representa auditoria integral da outra instalação Python.

## O que foi encontrado

| Arquivo/pasta | Conteúdo e papel |
| --- | --- |
| `core/cloud_commands.py` | Worker opcional para fila `public.jarvis_commands` no Supabase |
| `core/resultado.py` | `ResultadoComando`, compatível com texto e com indicador explícito de sucesso |
| `tests/test_cloud_commands.py` | 27 testes para worker, configuração, SDK e integração com runtime Python |
| `.env.example` | Nomes vazios `SUPABASE_URL` e `SUPABASE_KEY` |
| `docs/SUPABASE.md` | Instruções e registro de validação anterior |
| `apply_changes.py` | Copia arquivos e altera vários módulos em outra árvore de projeto |
| `run_tests.py` | Runner que muda de diretório e importa a outra aplicação |
| `test-deps/` | Dependências preparadas para uma validação anterior; acesso restrito observado nesta sessão |
| `test-output.log` | Saída histórica, não evidência suficiente de sucesso atual |

Os scripts apontam para `C:\Users\Matheus Ribeiro\Documents\Projeto-JARVIS`. Essa pasta não é a base principal selecionada. `apply_changes.py` e `run_tests.py` não foram executados nesta auditoria: o primeiro modifica código fora da base escolhida; o segundo importa o outro runtime e sobrescreve um log histórico.

## Fluxo implementado no worker

1. Carrega configuração opcional, com prioridade para as variáveis de ambiente já existentes.
2. Se URL ou chave estiver ausente, mantém o funcionamento local e não inicia a integração.
3. Consulta uma linha por vez, filtrando `status=pending` e `source=alexa`, ordenada por `created_at` e `id`.
4. Reserva por atualização condicional para `processing`; executa somente quando a reserva é confirmada.
5. Encaminha o texto ao executor fornecido pelo runtime, sem interpretar o comando como shell no próprio worker.
6. Registra `completed` ou `failed`, data UTC e resultado limitado a 500 caracteres, omitindo os segredos configurados.
7. Se a gravação final falha, guarda o resultado em memória e tenta apenas gravá-lo novamente; não repete automaticamente a ação.

Há uma thread daemon, intervalo padrão de dois segundos, parada e tolerância a indisponibilidade. Não há garantia de execução exatamente uma vez após queda do processo: uma linha pode permanecer `processing`, e o resultado pendente de finalização é apenas memória local.

## O que não está demonstrado

- Não existe conexão desse worker com o bridge Node do Jarvis web.
- O marcador `source=alexa` não comprova uma skill Alexa, validação de assinatura, Lambda ou endpoint de entrada instalado.
- Não há esquema/migration, políticas RLS ou configuração real de banco incluídos no material examinado.
- Não há filtros por usuário e dispositivo, nem modelo de isolamento para várias instalações.
- O worker não implementa memória semântica, persistência geral de conversas, projetos ou preferências.
- Os módulos `core.runtime`, `core.cerebro`, `core.estado` e `actions` referenciados pelos testes não estão nessa preparação.

Esses pontos não afirmam ausência na outra instalação; apenas impedem declarar que a base web já oferece tais recursos.

## Validação segura nesta auditoria

A suíte foi carregada diretamente da preparação com Python 3.12.14, sem importar a outra instalação, sem carregar seu `.env` e com conexões de rede bloqueadas no processo de teste. Não foram consumidos comandos reais nem acessado o banco.

Resultado: **27 casos executados; 21 passaram, uma falha e cinco erros**.

| Caso afetado | Resultado | Motivo observado |
| --- | --- | --- |
| Configuração por arquivo `.env` | Falha de asserção: worker retornou `None` | `python-dotenv` não está disponível no runtime utilizado; a função preserva o modo local ao falhar |
| Cliente oficial com transporte simulado | Erro de importação | `httpx` indisponível; `supabase` também não está instalado nesse runtime |
| Exceção do runtime | Erro de importação | `core.runtime` ausente na preparação |
| Resultado de ferramenta no runtime | Erro de importação | `core.runtime` ausente na preparação |
| Validação de chamada de ferramenta | Erro de importação | `core.cerebro` ausente na preparação |
| Wrapper de ferramentas | Erro de importação | Pacote `actions` ausente na preparação |

Os resultados distinguem incompletude do ambiente/preparação de um defeito comprovado do worker. A documentação histórica menciona 277 testes em outra árvore/ambiente, mas essa quantidade não foi reproduzida aqui e não deve ser atribuída ao Jarvis web.

## Reaproveitamento proposto

Preservar os arquivos e usar seu desenho como referência: resultado de sucesso explícito, reserva condicional, cuidado com duplicação de efeitos e proteção de segredos em logs. Se Supabase/Alexa for aprovado para o Jarvis web, integrar pelo contrato de ferramentas e permissões do Core, com identidade de instalação, autenticação e política de recuperação definidas.

Não executar o script de aplicação sobre outra base, mover arquivos ou criar dois executores simultâneos como atalho. Qualquer portabilidade deverá ter plano próprio, testes de concorrência e aprovação antes de modificar o código ou banco existentes.
