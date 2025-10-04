import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ServiceTypeSelector } from './ServiceTypeSelector';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock hooks
vi.mock('@/hooks/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    passengerCar: true,
    deliveryServices: true,
    serviceSelectorAvailability: false,
  }),
}));

vi.mock('@/hooks/useAvailability', () => ({
  useAvailability: () => ({
    data: [
      { serviceType: 'moto_taxi', surgeMultiplier: 1.0 },
      { serviceType: 'passenger_car', surgeMultiplier: 1.2 },
    ],
    isLoading: false,
  }),
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('ServiceTypeSelector', () => {
  it('renders service options', () => {
    const { getByText } = render(
      <ServiceTypeSelector 
        value="moto_taxi" 
        onChange={() => {}} 
      />,
      { wrapper }
    );
    
    expect(getByText('Moto')).toBeDefined();
  });

  it('shows estimated prices when provided', () => {
    const prices = {
      moto_taxi: 15.50,
      passenger_car: 25.00,
      delivery_bike: null,
      delivery_car: null,
    };
    
    const { getByText } = render(
      <ServiceTypeSelector 
        value="moto_taxi" 
        onChange={() => {}} 
        estimatedPrices={prices}
      />,
      { wrapper }
    );
    
    expect(getByText('R$ 15,50')).toBeDefined();
  });

  it('shows loading spinner when loading', () => {
    const { container } = render(
      <ServiceTypeSelector 
        value="moto_taxi" 
        onChange={() => {}} 
        loading={true}
      />,
      { wrapper }
    );
    
    // LoadingSpinner should be present
    const spinners = container.querySelectorAll('[role="status"]');
    expect(spinners.length).toBeGreaterThan(0);
  });
});
