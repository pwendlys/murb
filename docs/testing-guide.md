# Guia de Testes - Viaja+

Este documento descreve como executar e validar os testes do projeto Viaja+.

## Estrutura de Testes

O projeto possui dois tipos principais de testes:

### 1. Testes Unitários (Vitest)
Localizados em arquivos `.test.ts` e `.test.tsx` ao lado dos arquivos fonte.

**Cobertura:**
- Lógica de cálculo de preços (com surge)
- Validações no admin
- Hooks de disponibilidade e pricing
- Componentes React (ServiceTypeSelector, etc.)
- Utilitários de cache

### 2. Testes E2E (Playwright)
Localizados em `tests/e2e/`

**Cenários cobertos:**
- Seletor de tipo de serviço com disponibilidade
- Fluxo de admin (acesso, tabs, telemetria)
- Modo offline (banner, cache, ações bloqueadas)

## Comandos

```bash
# Instalar dependências
npm install

# Testes unitários
npm run test              # Executar todos os testes unitários
npm run test:watch        # Modo watch
npm run test:coverage     # Com cobertura de código

# Testes E2E (Playwright)
npx playwright install --with-deps  # Primeira vez apenas
npm run test:e2e          # Executar testes E2E
npx playwright test --ui  # Interface gráfica
npx playwright test --headed --debug  # Debug mode
npx playwright test --project=chromium  # Browser específico
npx playwright show-report  # Ver relatório do último teste
```

## Feature Flags para QA

Configure no arquivo `.env` para habilitar funcionalidades:

### Etapa 2-3 (Service Types & Admin Pricing)
```env
VITE_ENABLE_ADMIN_SERVICE_PRICING=true
VITE_ENABLE_SERVICE_TYPE_SELECTION=true
VITE_ENABLE_PASSENGER_CAR=true
VITE_ENABLE_DELIVERY_SERVICES=true
```

### Etapa 4 (Disponibilidade e Offline)
```env
VITE_ENABLE_E2E_FLOWS=true
VITE_ENABLE_AVAILABILITY_RULES=true
VITE_ENABLE_OFFLINE_CACHE=true
VITE_ENABLE_OFFLINE_QUEUE=false  # Ainda não implementado
```

### Etapa 5 (Filtros e Admin Consolidado)
```env
VITE_ENABLE_SERVICE_SELECTOR_AVAILABILITY=true
VITE_ENABLE_ADMIN_TAB=true
VITE_USE_QUERY_CLIENT=true
VITE_ENABLE_SERVICE_WORKER=true
VITE_FORCE_ADMIN=true  # Somente para QA local
```

## Cenários de Teste Manual

### 1. Seletor de Serviço com Disponibilidade

**Requisitos:**
- `VITE_ENABLE_SERVICE_TYPE_SELECTION=true`
- `VITE_ENABLE_SERVICE_SELECTOR_AVAILABILITY=true`
- `VITE_ENABLE_AVAILABILITY_RULES=true`

**Passos:**
1. Acesse a página inicial
2. Observe o seletor de tipo de serviço
3. Serviços indisponíveis devem aparecer desabilitados (opacity reduzida)
4. Ao passar o mouse/foco sobre item desabilitado, deve mostrar tooltip com motivo
5. Tentar clicar em serviço desabilitado não deve mudá-lo
6. Abra o console e verifique telemetria: `service_filtered_count`, `service_unavailable_click`

### 2. Admin Tab Consolidada

**Requisitos:**
- `VITE_ENABLE_ADMIN_TAB=true`
- `VITE_ENABLE_AVAILABILITY_RULES=true`
- `VITE_FORCE_ADMIN=true` (para QA)

**Passos:**
1. Acesse `/sistema-interno-2024/painel` (ou caminho configurado)
2. Veja abas: Configurações, Preços por Serviço, Regras de Disponibilidade, Usuários, etc.
3. Clique na aba "Regras de Disponibilidade"
4. Verifique telemetria: `admin_tab_opened`
5. Edite uma regra e salve
6. Verifique telemetria: `admin_availability_saved`

### 3. Modo Offline

**Requisitos:**
- `VITE_ENABLE_OFFLINE_CACHE=true`
- `VITE_ENABLE_SERVICE_WORKER=true`

**Passos:**
1. Visite a aplicação com internet conectada
2. Aguarde carregamento completo (Service Worker instala)
3. Abra DevTools → Application → Service Workers → verifique SW ativo
4. DevTools → Network → selecione "Offline"
5. Recarregue a página
6. Deve aparecer banner: "Você está offline"
7. Assets básicos e shell devem carregar
8. Tentar criar ride/entrega deve mostrar mensagem de bloqueio
9. Verifique telemetria no console: `sw_installed`, `sw_activated`, `offline_detected`, `response_cache_hit`

### 4. React Query Cache

**Requisitos:**
- `VITE_USE_QUERY_CLIENT=true`

**Passos:**
1. Abra a aplicação em modo dev
2. Veja painel React Query Devtools (canto inferior)
3. Navegue entre telas
4. Observe queries sendo cacheadas e reutilizadas
5. Console deve logar cache hits/misses

## Checklist de QA - Etapa 3

### Service Type Selector

#### Visibilidade e Feature Flags
- [ ] **Flags OFF:** Seletor não aparece, app usa `moto_taxi` por padrão
- [ ] **Flags ON:** Seletor aparece com tipos habilitados
- [ ] **Flag `VITE_ENABLE_PASSENGER_CAR=false`:** "Carro Passageiro" não aparece
- [ ] **Flag `VITE_ENABLE_DELIVERY_SERVICES=false`:** "Moto Flash" e "Car Flash" não aparecem

#### Funcionalidade Básica
- [ ] Clicar em tipo de serviço: seleção muda visualmente
- [ ] Tipo selecionado tem borda destacada e background diferenciado
- [ ] Ícones corretos para cada tipo (Bike, Car, Package, Truck)
- [ ] Labels amigáveis exibidos ("Moto Táxi", "Carro Passageiro", etc.)

#### Acessibilidade
- [ ] **Tab:** Navegar entre opções de serviço
- [ ] **Enter/Space:** Selecionar tipo de serviço com teclado
- [ ] **Aria-labels:** Cada opção tem descrição clara para screen readers
- [ ] **Focus-visible:** Estado de foco bem visível ao navegar por teclado
- [ ] **Role:** Elementos têm roles semânticos corretos

### Admin Pricing

#### Visibilidade e Permissões
- [ ] **Flag OFF:** Menu "Preços por Serviço" não aparece
- [ ] **Flag ON:** Menu "Preços por Serviço" visível no admin
- [ ] **Usuário não-admin:** Não consegue acessar a tela (redirect ou erro)
- [ ] **Usuário admin:** Acessa normalmente

#### Validações
- [ ] Preço por km: valores < 0.50 ou > 50.00 exibem erro
- [ ] Preço fixo: valores < 3.00 ou > 500.00 exibem erro
- [ ] Taxa de serviço: validação de acordo com tipo (fixo/percentual)
- [ ] Botão Salvar desabilitado quando há erros
- [ ] Mensagens de erro inline e claras

## Testes de Acessibilidade

Todos os componentes devem ser navegáveis por teclado:

- **Tab/Shift+Tab**: Navegar entre elementos
- **Enter/Espaço**: Ativar botões/cards
- **Esc**: Fechar modais
- **Setas**: Navegar em RadioGroup

Validar `aria-*` attributes:
- `aria-label` em cards de serviço
- `aria-disabled` em itens indisponíveis
- `aria-live` para anúncios dinâmicos (offline, erros)

## Cobertura Mínima

- **Unit tests**: 80% dos módulos críticos (pricing, availability, validations)
- **E2E tests**: Fluxos principais (selector, admin, offline)

## Troubleshooting

### Playwright

**Erro: Browsers not installed**
```bash
npx playwright install --with-deps
```

**Trace/vídeo dos testes:**
```bash
npx playwright test --trace on
npx playwright show-trace trace.zip
```

### Testes unitários

**Erro: Cannot find module**
Verifique `tsconfig.json` e aliases em `vite.config.ts`.

**Timeout:**
Aumente timeout nos testes:
```typescript
import { test } from 'vitest';
test('my test', async () => { /* ... */ }, 10000); // 10s
```

## CI/CD

Os testes devem rodar no pipeline de CI:

```yaml
# .github/workflows/test.yml (exemplo)
- run: npm run test
- run: npx playwright test
- uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

## Telemetria Implementada (Etapa 5)

- `service_filtered_count`: Quantos serviços foram filtrados no selector
- `service_unavailable_click`: Usuário clicou em serviço indisponível
- `admin_tab_opened`: Admin abriu uma aba específica
- `admin_access_blocked`: Tentativa de acesso não autorizado
- `admin_pricing_saved`: Admin salvou configuração de preço
- `admin_availability_saved`: Admin salvou regra de disponibilidade
- `sw_installed`: Service Worker instalado
- `sw_activated`: Service Worker ativado
- `response_cache_hit`: Resposta servida do cache do SW
- `query_cache_hit`: Query hit no cache do React Query
- `query_cache_miss`: Query miss no cache do React Query

Todos os eventos são logados no console com prefixo `[Telemetry]`.

## Próximos Passos

- Adicionar testes de integração com backend (Supabase)
- Expandir cobertura E2E para fluxos de delivery
- Adicionar testes de performance (Lighthouse CI)
- Implementar visual regression tests (Percy/Chromatic)

---

**Última atualização:** Etapa 5 - Filtros, Admin Consolidado, QueryClient, Service Worker
