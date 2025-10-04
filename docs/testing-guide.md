# Guia de Testes - Etapa 3: UX/Ícones, Estabilidade e Polimento

## Como Testar Localmente

### 1. Ativar Feature Flags

Edite o arquivo `.env`:

```env
# Habilitar seleção de tipo de serviço
VITE_ENABLE_SERVICE_TYPE_SELECTION=true

# Habilitar painel admin de preços
VITE_ENABLE_ADMIN_SERVICE_PRICING=true

# Habilitar tipo "Carro Passageiro"
VITE_ENABLE_PASSENGER_CAR=true

# Habilitar tipos de entrega
VITE_ENABLE_DELIVERY_SERVICES=true
```

### 2. Acessar o App

- **Passageiro:** Acesse `/map`
- **Admin:** Acesse o painel administrativo

---

## Checklist de QA - Service Type Selector

### Visibilidade e Feature Flags
- [ ] **Flags OFF:** Seletor não aparece, app usa `moto_taxi` por padrão
- [ ] **Flags ON:** Seletor aparece com tipos habilitados
- [ ] **Flag `VITE_ENABLE_PASSENGER_CAR=false`:** "Carro Passageiro" não aparece
- [ ] **Flag `VITE_ENABLE_DELIVERY_SERVICES=false`:** "Moto Flash" e "Car Flash" não aparecem

### Funcionalidade Básica
- [ ] Clicar em tipo de serviço: seleção muda visualmente
- [ ] Tipo selecionado tem borda destacada e background diferenciado
- [ ] Ícones corretos para cada tipo (Bike, Car, Package, Truck)
- [ ] Labels amigáveis exibidos ("Moto Táxi", "Carro Passageiro", etc.)

### Acessibilidade
- [ ] **Tab:** Navegar entre opções de serviço
- [ ] **Enter/Space:** Selecionar tipo de serviço com teclado
- [ ] **Aria-labels:** Cada opção tem descrição clara para screen readers
- [ ] **Focus-visible:** Estado de foco bem visível ao navegar por teclado
- [ ] **Role:** Elementos têm roles semânticos corretos

### Preços Estimados
- [ ] Preços exibidos quando origem e destino preenchidos
- [ ] Preços diferentes por tipo de serviço (se configurado no admin)
- [ ] Loading state visível enquanto calcula preços
- [ ] Formato de moeda correto (R$ XX,XX)

### Responsividade
- [ ] Mobile: Grid de 2 colunas
- [ ] Desktop: Grid de 4 colunas (se todos os tipos habilitados)
- [ ] Layout não quebra em telas pequenas

---

## Checklist de QA - Admin Pricing

### Visibilidade e Permissões
- [ ] **Flag OFF:** Menu "Preços por Serviço" não aparece
- [ ] **Flag ON:** Menu "Preços por Serviço" visível no admin
- [ ] **Usuário não-admin:** Não consegue acessar a tela (redirect ou erro)
- [ ] **Usuário admin:** Acessa normalmente

### Listagem de Preços
- [ ] Exibe os 4 tipos de serviço (se flags habilitados)
- [ ] Ícones e cores consistentes com o seletor do app
- [ ] Valores atuais exibidos corretamente
- [ ] Botão "Editar Preços" para cada tipo

### Edição de Preços - Validações
- [ ] **Preço por km (`price_per_km`):**
  - [ ] Valor < 0.50: erro exibido
  - [ ] Valor > 50.00: erro exibido
  - [ ] Valor válido: salva sem erro
- [ ] **Preço fixo (`fixed_price`):**
  - [ ] Valor < 3.00: erro exibido (quando ativo)
  - [ ] Valor > 500.00: erro exibido
  - [ ] Desabilitado quando `fixed_price_active=false`
- [ ] **Taxa de serviço (`service_fee_value`):**
  - [ ] Valor < 0: erro exibido
  - [ ] Valor > 100: erro exibido (se tipo for porcentagem)
  - [ ] Validação respeita tipo (fixo vs percentual)
- [ ] **Botão Salvar:**
  - [ ] Desabilitado quando há erros de validação
  - [ ] Habilitado quando todos os campos válidos
- [ ] **Mensagens de erro:**
  - [ ] Inline, próximas ao campo com erro
  - [ ] Claras e amigáveis

### Edição de Preços - Funcionalidade
- [ ] Salvar: atualiza valores no banco de dados
- [ ] Toast de sucesso exibido após salvar
- [ ] Toast de erro exibido se falhar
- [ ] Valores atualizados refletem imediatamente na listagem
- [ ] Valores atualizados refletem no app (testar calculando nova corrida)

### Loading States
- [ ] Loading skeleton enquanto carrega listagem
- [ ] Loading no botão "Salvar" enquanto persiste
- [ ] Empty state se não houver dados (edge case)

---

## Checklist de QA - Integração End-to-End

### Fluxo Completo: Passageiro
1. [ ] Acessar `/map`
2. [ ] Preencher origem e destino
3. [ ] **Seletor aparece** com tipos habilitados
4. [ ] Selecionar "Carro Passageiro"
5. [ ] **Preço estimado atualiza** para o tipo selecionado
6. [ ] Clicar "Solicitar Corrida"
7. [ ] Verificar no banco: campo `service_type` = `passenger_car`

### Fluxo Completo: Admin → App
1. [ ] Admin: acessar "Preços por Serviço"
2. [ ] Editar "Moto Flash": alterar `price_per_km` para 3.00
3. [ ] Salvar
4. [ ] App: criar nova corrida de "Moto Flash"
5. [ ] **Preço estimado reflete o novo valor** (3.00 * distância)

### Fluxo Completo: Feature Flags OFF
1. [ ] Desabilitar todas as flags no `.env`
2. [ ] Reiniciar dev server
3. [ ] Acessar `/map`: **seletor não aparece**
4. [ ] App usa `moto_taxi` por padrão (comportamento antigo)
5. [ ] Admin: menu "Preços por Serviço" **não aparece**
6. [ ] Zero regressão: app funciona como antes da Etapa 2

---

## Checklist de QA - Telemetria

### Eventos Logados
- [ ] **`service_type_selected`:** Ao trocar tipo no seletor
  - [ ] Data: `{ service_type, context: 'ride_request' }`
- [ ] **`pricing_viewed`:** Ao abrir listagem de preços no admin
  - [ ] Data: `{ service_type }` (para cada tipo exibido)
- [ ] **`admin_pricing_updated`:** Ao salvar preços no admin
  - [ ] Data: `{ service_type, fields: ['price_per_km', ...] }`

### Console Logs
- [ ] Abrir DevTools → Console
- [ ] Eventos aparecem com prefixo `[Telemetry]`
- [ ] Dados não contêm informações sensíveis (user IDs, tokens)

---

## Checklist de QA - Segurança

- [ ] **RLS Policies:** Apenas admin pode UPDATE `pricing_settings`
- [ ] **Client-side:** Hook `useAuth` verifica permissões
- [ ] **Inputs sanitizados:** Valores numéricos validados (min/max)
- [ ] **Sem logs sensíveis:** Console não expõe dados críticos

---

## Testes Automatizados (Futuro)

### Unit Tests (Vitest/Jest)
- [ ] `serviceMetadata.ts`: validar estrutura de dados
- [ ] `telemetry.ts`: validar formato de eventos
- [ ] `usePricingSettings`: validar cálculo de preços por tipo
- [ ] `useServicePricing`: validar fetch/update

### Integration Tests
- [ ] `ServiceTypeSelector`: renderização, navegação, estados
- [ ] `ServicePricingEditModal`: validações, submit, erros
- [ ] `RideRequest`: integração com seletor, cálculo de preços

### E2E Tests (Playwright/Cypress)
- [ ] Fluxo completo: selecionar tipo → criar corrida
- [ ] Fluxo admin: editar preço → refletir no app

---

## Como Reportar Bugs

### Informações Necessárias
1. **Feature flags ativas** (copiar `.env`)
2. **Passos para reproduzir** (ex: "Ao clicar em 'Moto Flash'...")
3. **Comportamento esperado** vs **comportamento observado**
4. **Screenshots/vídeo** (se aplicável)
5. **Console logs** (se houver erros)

### Onde Reportar
- Issues no repositório Git
- Canal de QA no Slack/Discord
- Ticket no sistema de gestão de projetos

---

## Notas Finais

- **Cobertura mínima:** 80% nos módulos tocados (meta)
- **Prioridade:** Bugs críticos que bloqueiam fluxo principal
- **Regressão:** Zero tolerância para quebra de funcionalidades existentes

---

**Última atualização:** Etapa 3 - UX/Ícones, Estabilidade e Polimento
