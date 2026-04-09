# Guia de Integração: Assinafy API em um Web App

## 1. Conceitos Básicos
A API da Assinafy é uma arquitetura RESTful que permite acessar e manipular documentos, usuários, *workspaces* e signatários [1]. O formato padrão de requisição e resposta para os dados é o JSON [2].

## 2. Obtendo Credenciais
Para iniciar a integração, você precisa de uma conta e credenciais de acesso:
* **Ambientes**: Recomendamos criar uma conta no ambiente *Sandbox* (`https://app-staging.assinafy.com.br`) durante o desenvolvimento. Quando a sua aplicação web estiver concluída, utilize sua conta do ambiente de Produção (`https://app.assinafy.com.br`) [3].
* **API Key**: Para autenticar sua aplicação web, vá na página "My Account", selecione a aba "API" e gere uma chave única [4]. Essa é a forma recomendada de autenticação através do cabeçalho HTTP `X-Api-Key` [5].
* **Workspace Account ID**: A maioria dos *endpoints* requer o ID do seu workspace, que pode ser encontrado na aba "Workspaces" da página "My Account" [6].

> **⚠️ AVISO CRÍTICO DE SEGURANÇA:** Sua *API Key* deve ser utilizada **exclusivamente** no lado do servidor (*back-end*) do seu sistema. Evite completamente armazená-la no código fonte exposto no *front-end* [6, 7].

## 3. Fluxo Principal de Integração no Back-end

### Passo 3.1: Fazer o Upload do Documento
O primeiro passo para o envio é subir o documento em formato PDF a partir de um arquivo local [8]. Isso deve ser feito através de uma requisição `POST` com conteúdo `multipart/form-data` [9].

**Exemplo de Requisição:**
```bash
curl -X POST "https://api.assinafy.com.br/v1/accounts/SEU_WORKSPACE_ACCOUNT_ID/documents" \
     -H 'X-Api-Key: SUA_API_KEY' \
     -F 'file=@/caminho/para/documento.pdf'
Importante: Guarde o ID do documento (id) retornado na resposta JSON para utilizá-lo nos próximos passos
.
Passo 3.2: Criar os Signatários (Signers)
Em seguida, você precisa registrar as pessoas que deverão assinar o documento
.
Exemplo de Requisição:
curl -X POST "https://api.assinafy.com.br/v1/accounts/SEU_WORKSPACE_ACCOUNT_ID/signers" \
     -H 'X-Api-Key: SUA_API_KEY' \
     -H 'Content-Type: application/json' \
     -d '{
           "full_name": "Nome do Signatário",
           "email": "email@exemplo.com"
         }'
Salve os IDs gerados de cada signatário retornado nesta etapa
.
Passo 3.3: Solicitar a Assinatura (Assignment)
Com o documento transferido e os signatários criados, convide-os para assinar. Você pode usar o método virtual (sem requerer inputs manuais no documento) ou collect (se possuir campos de preenchimento)
.
Exemplo de Convite (Método Virtual):
curl -X POST https://api.assinafy.com.br/v1/documents/SEU_DOCUMENT_ID/assignments \
     -H 'X-Api-Key: SUA_API_KEY' \
     -H 'Content-Type: application/json' \
     -d '{
           "method": "virtual",
           "signers": [
             { "id": "ID_DO_SIGNATARIO_GERADO_NO_PASSO_ANTERIOR" }
           ]
         }'
Esta requisição efetivará o envio do convite de assinatura para o signatário
.
4. Atualizações em Tempo Real com Webhooks (Essencial para Web Apps)
Em um web app, em vez de fazer varreduras constantes (polling) na API para saber se um documento foi assinado, sua aplicação deve inscrever-se para usar Webhooks
.
O sistema da Assinafy fará requisições POST diretamente para a URL (endpoint) configurada no seu back-end sempre que um evento de interesse acontecer
.
O evento mais comumente utilizado é o document_ready, que é disparado quando o último signatário assina o documento e o status passa a ser considerado pronto
.
Sempre que o seu servidor receber a notificação (payload em JSON), ele deverá responder com o código HTTP 200 OK para confirmar o recebimento
.
Exemplo de como inscrever o seu servidor para receber Webhooks:
curl -X PUT "https://api.assinafy.com.br/v1/accounts/SEU_WORKSPACE_ACCOUNT_ID/webhooks/subscriptions" \
     -H "X-Api-Key: SUA_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
           "events": [
             "document_ready",
             "signer_signed_document"
           ],
           "is_active": true,
           "url": "https://seu-webapp.com/api/webhooks/assinafy",
           "email": "admin@seu-webapp.com"
         }'