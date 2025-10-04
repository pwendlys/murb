export const useFeatureFlags = () => {
  return {
    // Etapa 2-3
    adminServicePricing: import.meta.env.VITE_ENABLE_ADMIN_SERVICE_PRICING === 'true',
    serviceTypeSelection: import.meta.env.VITE_ENABLE_SERVICE_TYPE_SELECTION === 'true',
    passengerCar: import.meta.env.VITE_ENABLE_PASSENGER_CAR === 'true',
    deliveryServices: import.meta.env.VITE_ENABLE_DELIVERY_SERVICES === 'true',
    
    // Etapa 4
    e2eFlows: import.meta.env.VITE_ENABLE_E2E_FLOWS === 'true',
    availabilityRules: import.meta.env.VITE_ENABLE_AVAILABILITY_RULES === 'true',
    offlineCache: import.meta.env.VITE_ENABLE_OFFLINE_CACHE === 'true',
    offlineQueue: import.meta.env.VITE_ENABLE_OFFLINE_QUEUE === 'true',
    
    // Etapa 5
    serviceSelectorAvailability: import.meta.env.VITE_ENABLE_SERVICE_SELECTOR_AVAILABILITY === 'true',
    adminTab: import.meta.env.VITE_ENABLE_ADMIN_TAB === 'true',
    useQueryClient: import.meta.env.VITE_USE_QUERY_CLIENT === 'true',
    enableServiceWorker: import.meta.env.VITE_ENABLE_SERVICE_WORKER === 'true',
    forceAdmin: import.meta.env.VITE_FORCE_ADMIN === 'true',
  };
};
