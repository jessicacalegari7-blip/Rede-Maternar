# Integrações e acessos

## Integrações previstas

- Supabase: banco, autenticação, storage, realtime e funções.
- Vercel: hospedagem e ambientes.
- Asaas: cobranças, links, assinaturas, Pix, cartões, boletos, webhooks e reembolsos.
- WhatsApp Business Platform: mensagens e lembretes.
- Meta: Instagram Direct e Facebook Messenger conforme permissões.
- TikTok Business: somente recursos oficialmente disponíveis e aprovados.
- Videoconferência: provedor a selecionar.
- E-mail transacional: provedor com domínio autenticado.
- Notas fiscais: provedor fiscal ou integração municipal.
- Monitoramento: erros, disponibilidade e métricas.

## Forma segura de conceder acesso

1. Criar todas as contas em nome da Rede Maternar.
2. Convidar o desenvolvedor por usuário individual.
3. Conceder somente permissões necessárias.
4. Usar sandbox e homologação antes da produção.
5. Nunca enviar senha, chave privada ou token em documento ou mensagem.
6. Revogar acessos ao fim do contrato e rotacionar segredos.

## Variáveis esperadas

Manter um arquivo `.env.example` somente com nomes, sem valores reais. Exemplos: URL pública do Supabase, chave pública/anon, URLs de callback e identificadores públicos. Chaves administrativas, tokens de webhook e credenciais privadas devem existir apenas no ambiente seguro do servidor.

