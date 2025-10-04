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
  };
};
