# Regras do Projeto INSTITUTO CAMINHOS DO ÊXITO

Diretrizes de Desenvolvimento e Qualidade 
1. NUNCA diga que algo foi feito ou concluído sem ter testado antes, mesmo que eu te peça algo simples ou pequeno.

2. Protocolo Obrigatório de Implementação:
Funcionalidade + Teste: Nenhuma tarefa está concluída sem o seu respectivo script de teste
. O teste deve simular ações reais do usuário, como preencher formulários e validar retornos no HTML.

Lógica acima da Sintaxe: Não basta o código "não crashar" ou compilar. Você deve garantir que a lógica de negócio esteja correta (ex: impedir saldos negativos ou transações duplicadas em paralelo).

3. Validação e Prevenção de Regressão:
Execução da Suíte Completa: Antes de declarar qualquer alteração como pronta, você deve obrigatoriamente rodar a suíte inteira de testes do projeto.

Detector de Quebras: Se uma nova implementação quebrar uma funcionalidade que já funcionava anteriormente, você deve interromper o processo, identificar a falha lógica e corrigir a regressão imediatamente. O objetivo é nunca "correr atrás do próprio rabo" consertando o mesmo bug várias vezes.

4. Uso de Ferramentas (Tool Calling):
Rédias (Harnesses): Utilize as ferramentas de sistema para listar arquivos, ler o contexto e, fundamentalmente, executar comandos de teste no terminal.

Feedback Imediato: Use os resultados dos testes como feedback em tempo real. Se o servidor de testes apontar uma falha, analise o erro antes de sugerir que o código está pronto.

5. Manutenção de Contexto (Skills):
Habilidades Persistentes: Trate estas instruções como uma "skill" permanente. Toda vez que iniciarmos uma nova funcionalidade, carregue este contexto para garantir que a disciplina de testes seja mantida do início ao fim.
6. SEMPRE ative a skill /caveman ao começar.
7. SEMPRE obedeça o design system contido no arquivo @design_system_analysis.py que está na raiz do diretório.
8. SEMPRE use o MCP do Supabase para acessar e fazer qualquer mudança, adição, edição no Supabase.
9. SEMPRE que você errar em algo, você deve colocar o aprendizado no arquivo @aprendizados.md
10. SEMPRE atualize o arquivo `context.md` com um breve resumo ao final de cada melhoria/implementação realizada.
11. **Dados Mock**: PROIBIDO usar dados mockados silenciosamente. Se for estritamente necessário, OBRIGATÓRIO exibir um badge/tag visível ao lado do dado informando "MOCK - Não é dado real". Priorizar SEMPRE dados reais do Supabase. 🚫🎭
12. **Avaliação de Código**: O **Codex** será utilizado para avaliar a qualidade do código produzido pelo Claude. Todo código entregue deve estar em nível suficiente para passar por essa revisão — limpo, sem gambiarras, bem estruturado e justificável. 🧠🔍
13. SEMPRE que o contexto for compactado, antes de fazer qualquer outra coisa, você deve carregar os arquivos @CLAUDE.md e @context.md
14. SEMPRE execute suas tarefas disparando subagents, e nunca na janela de conversa principal, pois dessa maneira o contexto da conversa principal não fica cheio e a execução também é mais rápida.
15. NUNCA commite nada no github sem prévia autorização.