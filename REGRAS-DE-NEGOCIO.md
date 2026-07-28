# Regras de negócio oficiais

## Acesso

- A paciente chega por convite, link, QR Code ou indicação; não pesquisa profissionais.
- O login redireciona pelo papel: paciente, profissional ou administração.
- Profissional só opera aprovada e ativa.
- Comunidade pode buscar e indicar, acompanhar conversões e receber comissão; não recebe indicação nem usa recursos clínicos/financeiros operacionais.
- Plano Anual custa R$ 179,90/ano em até 12x no cartão ou R$ 149,00 à vista via Pix/boleto e libera recursos clínicos e financeiros.

## Financeiro

O cálculo usa centavos inteiros e arredondamento de metade para cima em cada percentual:

1. taxa do meio: Pix 1%; cartão à vista 5%; cartão parcelado até 6x 10%;
2. líquido do gateway = bruto − taxa do meio;
3. indicação = 15% do líquido do gateway, se válida;
4. plataforma = 8% do líquido do gateway;
5. profissional = bruto − todas as parcelas anteriores.

## Prontuário

- Um prontuário longitudinal estruturado por paciente.
- Evoluções pertencem ao autor; correções usam adendo/nova versão.
- Consentimento é individual por profissional, possui escopo e prazo.
- Expiração é automática; revogação não apaga histórico.
- Todo acesso e ação relevante gera registro de auditoria.

## Limites desta versão

Persistência, sessão, pagamentos, anexos e jobs de expiração são locais/simulados. As regras estão modeladas, mas garantias de concorrência, segurança, trilha inviolável e processamento automático dependem de backend.
