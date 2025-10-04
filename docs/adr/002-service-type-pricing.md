# ADR 002: Preços por Tipo de Serviço

## Status
Implementado

## Contexto
O sistema inicialmente suportava apenas "moto_taxi". Para expandir para outros tipos de serviço (carro passageiro, entregas), precisamos de:
- Preços independentes por tipo de serviço
- UI administrativa para gerenciar cada tipo
- Seletor de serviço no app do passageiro
- Rollout gradual via feature flags

## Decisão

### Schema
- Enum `service_type`: moto_taxi, passenger_car, delivery_bike, delivery_car
- Campo `service_type` em `rides` e `pricing_settings`
- Constraint `UNIQUE(service_type)` em `pricing_settings` (sem singleton)
- 4 registros default em `pricing_settings`

### Código
- Hook `usePricingSettings(serviceType)` para buscar preços por tipo
- Hook `useServicePricing()` para admin gerenciar todos os tipos
- Componente `ServiceTypeSelector` para escolher serviço
- Feature flags: `VITE_ENABLE_ADMIN_SERVICE_PRICING`, `VITE_ENABLE_SERVICE_TYPE_SELECTION`, `VITE_ENABLE_PASSENGER_CAR`, `VITE_ENABLE_DELIVERY_SERVICES`

### Segurança
- RLS policies em `pricing_settings`: admin-only UPDATE, público SELECT
- Validação client-side e server-side de valores
- Audit via campo `updated_by`

## Consequências

### Positivo
- Suporte a múltiplos serviços sem quebrar fluxo atual
- Rollout controlado por feature flags
- Rollback fácil (desligar flags)
- Admin gerencia preços independentemente

### Negativo
- 4 feature flags adicionais
- Complexidade moderada na UI de seleção
- Necessidade de seed de dados inicial

## Alternativas Consideradas
1. **Singleton com JSON por tipo:** Descartado (dificuldade de query e validação)
2. **Tabela de preços por corrida:** Descartado (complexidade desnecessária)
3. **Preço fixo único:** Descartado (inflexível para diferentes tipos)

## Rollout
1. Fase 1: Habilitar admin-only (staging)
2. Fase 2: Beta com passenger_car (testers internos)
3. Fase 3: Full com delivery services

## Rollback
- Desligar feature flags no `.env`
- Git revert do PR se necessário
- Schema permanece (backward compatible)
