# PRD — Rede Maternar

**Produto:** Marketplace de profissionais materno-infantis + CRM + ERP  
**Versão:** Especificação de transferência técnica  
**Status:** Protótipo validável; backend de produção pendente

## 1. Visão do produto

A Rede Maternar será uma plataforma brasileira focada exclusivamente no ecossistema materno-infantil. O produto combina um Marketplace para descoberta de profissionais com ferramentas de gestão para as profissionais: CRM, agenda, comunicação omnichannel, financeiro ERP, teleconsultas, pagamentos e backoffice administrativo.

Proposta de posicionamento: **A única plataforma de profissionais materno-infantil.**

## 2. Objetivos

- Facilitar a descoberta de profissionais por especialidade, cidade, bairro, modalidade e convênio.
- Ajudar profissionais a organizar leads, pacientes, agenda, mensagens, recebimentos e operação financeira.
- Oferecer planos gratuitos e pagos com regras claras.
- Centralizar operação e governança em um backoffice.
- Operar com segurança, rastreabilidade e aderência à LGPD.

## 3. Perfis de usuário

### Visitante

Pesquisa profissionais, visualiza perfis públicos, avaliações, disponibilidade aproximada e inicia contato.

### Paciente

Mantém conta própria, agenda consultas, acompanha pagamentos, conversa com profissionais autorizadas, recebe notificações e administra privacidade.

### Profissional

Possui perfil público e, conforme o plano, utiliza Marketplace, CRM, agenda, comunicação, ERP, pagamentos, teleconsultas e relatórios.

### Equipe administrativa

Administra cadastros, planos, assinaturas, suporte, financeiro, permissões, integrações, auditoria e configurações.

## 4. Planos

### Marketplace Gratuito

- Até 30 visitas mensais no perfil.
- Até 3 serviços publicados.
- Sem selo de perfil verificado.
- Relatório básico.
- Aviso de aproximação e alcance do limite.
- Regra de ocultação ou renovação mensal parametrizável.

### Marketplace Ilimitado — R$ 29,90/mês

- Visitas e serviços ilimitados.
- Selo de perfil verificado, condicionado também à validação documental.
- Destaque nas buscas.
- Relatório completo do perfil.

### Profissional Independente — R$ 99,99/mês

- Marketplace Ilimitado, CRM, agenda, mensagens, integrações, teleconsultas, ERP e relatórios.
- Conta exclusiva para uma profissional; não permite cadastrar outros profissionais.
- Até 3 especialidades vinculadas ao perfil público.
- No editor do Marketplace, exibe somente os dados da titular.

### Plano para Clínicas — R$ 179,99/mês

- Marketplace, CRM, ERP e todos os recursos de gestão.
- Profissionais e especialidades ilimitados.
- Cada profissional possui acesso, agenda, atendimentos, produção e permissões próprios.
- A clínica pode definir perfis de administradora, profissional, recepção e financeiro.
- No Marketplace, cada card destaca primeiro o nome da profissional e exibe o nome da clínica logo abaixo.
- No editor de perfis do Marketplace, a clínica visualiza e administra todos os profissionais cadastrados.

O backoffice deve permitir alterar preços, benefícios, período de teste, status, inadimplência, upgrade, downgrade e cancelamento.

## 5. Marketplace

### Busca principal

Filtro encadeado por especialidade, cidade e bairro. Cidades e bairros devem ser derivados dos perfis ativos. Filtros adicionais: modalidade, disponibilidade, faixa de preço, convênio e somente perfis verificados.

### Perfil profissional

- Nome da profissional, nunca somente o nome da clínica.
- Foto, especialidade, registro, biografia e experiência.
- Cidade e bairro; endereço completo protegido.
- Serviços, preços, modalidades e disponibilidade.
- Convênios informados, com aviso de confirmação de cobertura.
- Avaliação média e comentários verificados.
- WhatsApp com registro de origem e clique.
- Selo verificado apenas para plano elegível e documentação aprovada.

### Especialidades

Usar catálogo administrável, incluindo consultoria de amamentação, pediatria, neonatologia, nutrição infantil, neuropsicologia infantil, psicologia perinatal, fonoaudiologia, terapia ocupacional, fisioterapia, odontopediatria e demais áreas materno-infantis.

## 6. Cadastro e autenticação

### Profissional

Nome, e-mail, telefone, senha, especialidade, registro, cidade, bairro, plano, modalidades, convênios, documentos e consentimentos. Cadastro deve entrar em análise administrativa.

### Paciente

Nome, e-mail, telefone, senha, data de nascimento, consentimentos e vínculos profissionais. Permitir convite e cadastro administrativo.

### Requisitos

- Supabase Auth ou solução equivalente.
- Confirmação de e-mail, recuperação de senha e revogação de sessões.
- MFA obrigatório para administração e recomendado para profissionais.
- Perfis e permissões separados.

## 7. CRM

- Funil configurável.
- Etapas iniciais: Novo contato, 1ª tentativa, 2ª tentativa, Contato futuro e Agendado.
- Cadastro manual de paciente ou lead.
- Origem: Marketplace, WhatsApp, Instagram, Facebook, TikTok, telefone, recepção, indicação orgânica e outros.
- Histórico de atividades, responsáveis, tarefas e observações administrativas.
- Agenda do dia na visão geral.
- Indicador privado e objetivo de comparecimento.
- Alertas de novas mensagens com sino, contador, não lidas e destaque visual.
- Todo lead deve registrar e exibir no card a profissional solicitada pela paciente, inclusive a opção “sem preferência”.
- A recepção deve conseguir filtrar o funil por profissional e agendar diretamente na agenda correspondente.

## 8. Comunicação omnichannel

Centralizar mensagens permitidas pelas APIs oficiais de WhatsApp Business, Instagram, Facebook Messenger e outros canais disponíveis. TikTok e demais redes dependem de disponibilidade, aprovação e escopo da API.

Cada conversa deve registrar canal, conta, campanha, origem, horário, responsável, status de leitura e consentimento. Implementar webhooks idempotentes, filas, tentativas, logs e tratamento de desconexões.

Notificações para pacientes: dia anterior e 2 horas antes, com preferências, consentimento e registro de entrega.

Notificações para profissionais: resumo diário via WhatsApp com os pacientes agendados no dia e novo aviso 1 hora antes de cada consulta. Registrar envio, entrega, falha e nova tentativa.

## 9. Agenda e atendimento

- Visões diária, semanal e lista.
- Disponibilidade recorrente, bloqueios, férias e horários noturnos.
- Consulta presencial, domiciliar ou por vídeo.
- Confirmação, cancelamento, ausência e conclusão.
- Retorno gratuito ou pago.
- Forma de pagamento e status “Atendimento pago”.
- Prevenção de conflito de horário.
- Fuso horário configurável.
- A profissional vinculada à clínica possui login individual e visualiza somente sua agenda, seus atendimentos e seus dados autorizados.

## 10. Teleconsulta

Sala segura, link temporário, controle de acesso, estado de espera, registro de início/fim e consentimento. Não gravar por padrão. O provedor deve ser escolhido após avaliação de segurança, custo e requisitos jurídicos.

## 11. ERP e financeiro

- Abertura e fechamento de caixa.
- Saldo inicial, entradas, saídas, sangrias e conferência.
- Contas a pagar e receber.
- Custos fixos e variáveis.
- Impostos e provisões.
- Folha salarial.
- Serviços e preços.
- Geração de link de pagamento.
- Registro de Pix, dinheiro, débito, crédito, boleto, transferência e link.
- Integração automática: ao marcar atendimento pago, computar faturamento diário, mensal e anual, caixa, contas a receber e DRE.
- Notas fiscais por integração com provedor ou prefeitura.
- DRE diário, mensal e anual, com regime definido.
- Exportações e conciliação.
- Extrato individual da profissional com quantidade de atendimentos, valor bruto das consultas, taxa do meio de pagamento, taxa da clínica, retenções e repasse líquido.

## 12. Pagamentos e assinaturas

Integração prevista com Asaas em sandbox antes da produção. O backend deve criar cobranças, receber webhooks, validar autenticidade, tratar duplicidade, conciliar pagamentos, processar reembolsos e controlar assinaturas.

Segredos e chaves privadas nunca devem ficar no navegador. Definir juridicamente qualquer regra de repasse antes da implementação.

## 13. Avaliações

Somente paciente autenticada com atendimento concluído pode avaliar. Uma avaliação por atendimento, com nota, comentário, moderação, denúncia, direito de resposta e trilha de auditoria.

## 14. Backoffice

- Dashboard operacional.
- Cadastros de profissionais e pacientes.
- Análise documental, aprovação, rejeição e suspensão.
- Planos e assinaturas.
- Agendamentos.
- Financeiro, reembolsos e conciliação.
- Suporte e chamados.
- Equipe e permissões.
- Catálogos de especialidades, convênios, cidades e configurações.
- Integrações e saúde dos webhooks.
- Logs e trilha de auditoria.
- Exportações e relatórios.
- Gestão de conteúdos, avaliações e denúncias.

## 15. Requisitos não funcionais

- Layout responsivo e acessível.
- Ambientes de desenvolvimento, homologação e produção.
- Banco PostgreSQL com migrações versionadas.
- RLS em todas as tabelas expostas.
- Monitoramento de erros, disponibilidade e filas.
- Logs estruturados sem dados sensíveis desnecessários.
- Backups e restauração testada.
- Testes unitários, integração e ponta a ponta.
- Desempenho e paginação para grandes volumes.
- Compatibilidade com navegadores modernos.

## 16. Arquitetura sugerida

- Front-end React/TypeScript, com decisão documentada entre manter Vite ou migrar para framework full-stack.
- GitHub como fonte oficial do código.
- Supabase para Postgres, Auth, Storage, Realtime e funções quando apropriado.
- Vercel para hospedagem.
- Funções de servidor para integrações e operações privilegiadas.
- Filas ou mecanismo confiável para webhooks e notificações.

## 17. Entregáveis obrigatórios

- Código-fonte em repositório da Rede Maternar.
- Migrações e diagrama do banco.
- Políticas RLS e matriz de permissões.
- Ambientes configurados.
- Documentação de variáveis sem valores secretos.
- Testes e evidências de homologação.
- Manual administrativo.
- Plano de backup, recuperação e incidentes.
- Inventário de fornecedores e integrações.
- Treinamento e período de garantia.

## 18. Fora do escopo automático

O protótipo não autoriza uso com dados reais. Questões clínicas, fiscais, trabalhistas, pagamentos, publicidade profissional e LGPD devem ser revisadas por especialistas jurídicos, contábeis e de segurança.
