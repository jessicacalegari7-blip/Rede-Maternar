# Robô do diretório em produção

## Fontes e regra de contato

O robô usa OpenStreetMap/Overpass e, quando configurado, Google Places para
descobrir o site oficial da clínica ou profissional. O WhatsApp só é salvo
quando aparece publicamente no próprio site oficial (link `wa.me`, WhatsApp ou
telefone identificado como WhatsApp). O telefone retornado diretamente pelo
Google não é persistido, respeitando as restrições de armazenamento do Google
Maps Platform.

Doctoralia não é raspado automaticamente. A página pode servir como pista para
revisão humana, mas a coleta automatizada deve respeitar os termos da fonte e a
confirmação deve ocorrer no site oficial do profissional.

## Variáveis da Vercel

- `GOOGLE_MAPS_API_KEY`: chave de um projeto Google Cloud com Places API (New)
  habilitada. Restrinja a chave à API e ao backend de produção.
- `RESEARCH_TARGETS_PER_RUN`: quantidade de combinações cidade/especialidade
  processadas por execução (padrão 3, máximo 10).
- `CRON_SECRET`: segredo usado pela Vercel para autenticar o agendamento.

O mesmo `CRON_SECRET` deve ser cadastrado como **Actions secret** no GitHub.
O workflow `.github/workflows/professional-directory-research.yml` executa três
combinações a cada 30 minutos e possui proteção contra execuções simultâneas.
O cron diário da Vercel permanece como redundância. Em contas gratuitas, o
GitHub pode atrasar execuções agendadas e o consumo fica sujeito à franquia de
minutos da conta.
- `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`: conexão privada do backend.

O Google Places exige faturamento habilitado e cobra conforme os campos
solicitados. A chave jamais deve ser exposta em variável `VITE_*`.

## Escala

A fila nacional contém até 8.000 combinações (200 cidades x 40 especialidades).
Cada execução processa um lote, priorizando os alvos nunca executados. Para
cobertura rápida, use uma infraestrutura de jobs/filas dedicada; o cron diário
gratuito da Vercel não consegue percorrer toda a base em prazo curto.

## Privacidade e prospecção

O WhatsApp fica somente em `clinic_prospects`, protegido por RLS e visível à
administração. A view pública `published_clinic_directory` não expõe telefone,
e-mail ou endereço completo. Toda mensagem de prospecção deve identificar a
MaterPlace, explicar a origem pública do contato e oferecer oposição imediata.
