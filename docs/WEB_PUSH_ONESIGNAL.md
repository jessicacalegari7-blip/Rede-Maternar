# Web Push da MaterPlace com OneSignal

O portal já contém o *soft prompt* próprio e o service worker. O pedido nativo do navegador só é exibido depois de um clique explícito em **Ativar**.

## 1. Criar e conectar o aplicativo

1. No OneSignal, crie um aplicativo do tipo **Web Push**.
2. Informe a origem `https://materplace.com.br`.
3. Configure o service worker como `/OneSignalSDKWorker.js` e escopo `/`.
4. Na Vercel, abra **Settings > Environment Variables** e crie `VITE_ONESIGNAL_APP_ID` com o App ID do OneSignal para **Production** e **Preview**.
5. Faça um novo deploy. Não coloque REST API Key ou credenciais secretas no front-end.

## 2. Comportamento implementado

- o aviso aparece após 15 segundos ou 40% de rolagem da matéria;
- se recusado, reaparece somente após sete dias;
- possui botões visíveis **Agora não**, fechar e **Ativar**;
- o navegador pede permissão somente após **Ativar**;
- a categoria da matéria é gravada na tag `categoria_interesse`;
- Chrome, Edge e Firefox desktop/Android são atendidos; no iOS 16.4 ou superior, o usuário precisa adicionar o site à tela inicial para usar Web Push.

## 3. Mensagem de boas-vindas

No painel do OneSignal, crie uma Journey com entrada **New Subscription**, espera de 10 minutos e envio de uma mensagem de boas-vindas. A URL deve seguir este padrão:

`https://materplace.com.br/?utm_source=webpush&utm_medium=push_notification&utm_campaign=boas_vindas`

Repita o padrão de UTM em todas as campanhas. Essa Journey é configurada no OneSignal e não deve usar uma chave secreta no navegador.

## 4. Teste

Abra uma matéria em janela anônima, permaneça 15 segundos ou role 40%, clique em **Ativar** e confirme a permissão. Confira no OneSignal se a inscrição e a tag `categoria_interesse` foram registradas.
