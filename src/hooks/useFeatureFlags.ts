export const useFeatureFlags = () => {
  return {
    adminServicePricing: import.meta.env.VITE_ENABLE_ADMIN_SERVICE_PRICING === 'true',
    serviceTypeSelection: import.meta.env.VITE_ENABLE_SERVICE_TYPE_SELECTION === 'true',
    passengerCar: import.meta.env.VITE_ENABLE_PASSENGER_CAR === 'true',
    deliveryServices: import.meta.env.VITE_ENABLE_DELIVERY_SERVICES === 'true',
  };
};
