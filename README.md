# Welcome to your Lovable project

## Sistema de Corridas - Mototáxi e Entregas

Sistema completo de corridas com suporte a múltiplos tipos de serviço.

### Etapas de Implementação

#### ✅ Etapa 1 - Fundação de Tipos de Serviço
- Enum `service_type` criado: `moto_taxi`, `passenger_car`, `delivery_bike`, `delivery_car`
- Campos `service_type` adicionados em `rides` e `pricing_settings`
- Tipos TypeScript atualizados
- Hook `usePricingSettings` parametrizado por tipo de serviço

#### ✅ Etapa 2 - Admin de Preços por Serviço + UI de Seleção
- Painel administrativo para gerenciar preços por tipo de serviço
- UI de seleção de tipo de serviço no app do passageiro
- Feature flags para rollout controlado
- Integração completa com fluxo de criação de corridas

#### ✅ Etapa 3 - UX/Ícones, Estabilidade e Polimento
- Metadados centralizados de tipos de serviço (ícones, cores, labels)
- Acessibilidade completa (navegação por teclado, aria-labels)
- Preços estimados exibidos no seletor de tipos
- Validações robustas no painel admin
- Sistema de telemetria/observabilidade
- Guia de testes e QA detalhado

### Feature Flags

Configure no arquivo `.env`:

```env
# Habilitar painel admin de preços por serviço
VITE_ENABLE_ADMIN_SERVICE_PRICING=false

# Habilitar seleção de tipo de serviço no app
VITE_ENABLE_SERVICE_TYPE_SELECTION=false

# Habilitar tipo "Carro Passageiro"
VITE_ENABLE_PASSENGER_CAR=false

# Habilitar tipos de entrega (Moto Flash, Car Flash)
VITE_ENABLE_DELIVERY_SERVICES=false
```

### Rollout Recomendado

**Fase 1 - Admin Only (Staging):**
- `VITE_ENABLE_ADMIN_SERVICE_PRICING=true`
- Demais flags `false`

**Fase 2 - Beta com Carro Passageiro:**
- `VITE_ENABLE_SERVICE_TYPE_SELECTION=true`
- `VITE_ENABLE_PASSENGER_CAR=true`

**Fase 3 - Full com Entregas:**
- `VITE_ENABLE_DELIVERY_SERVICES=true`

### Tipos de Serviço

- 🏍️ **Moto Táxi** (`moto_taxi`) - Transporte de passageiros em motocicleta
- 🚗 **Carro Passageiro** (`passenger_car`) - Transporte de passageiros em carro
- 📦 **Moto Flash** (`delivery_bike`) - Entrega rápida em motocicleta
- 🚚 **Car Flash** (`delivery_car`) - Entrega em carro

### Telemetria e Observabilidade

O sistema registra eventos importantes para análise:

- **`service_type_selected`**: Quando o usuário seleciona um tipo de serviço
  - Data: `{ service_type, context }`
- **`pricing_viewed`**: Quando preços são visualizados no admin
  - Data: `{ service_type }`
- **`admin_pricing_updated`**: Quando preços são atualizados no admin
  - Data: `{ service_type, fields[] }`

Eventos são logados via `console.info` com prefixo `[Telemetry]`. Integração com providers externos (Posthog, Mixpanel) pode ser adicionada no futuro.

### Testes

Consulte o [Guia de Testes](./docs/testing-guide.md) para checklist completo de QA e instruções de teste.

---

## Project info

**URL**: https://lovable.dev/projects/cf358664-f018-49cd-a5c5-a1e16f3ffc32

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/cf358664-f018-49cd-a5c5-a1e16f3ffc32) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/cf358664-f018-49cd-a5c5-a1e16f3ffc32) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
