import { Card } from '@/components/ui/card';
import { Bike, Car, Package, Truck } from 'lucide-react';
import type { ServiceType } from '@/types';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';

interface ServiceTypeSelectorProps {
  value: ServiceType;
  onChange: (type: ServiceType) => void;
}

const SERVICE_OPTIONS = [
  { type: 'moto_taxi' as ServiceType, label: 'Moto Táxi', icon: Bike, color: 'bg-blue-50 border-blue-200 hover:border-blue-400', colorActive: 'bg-blue-100 border-blue-500' },
  { type: 'passenger_car' as ServiceType, label: 'Carro Passageiro', icon: Car, color: 'bg-green-50 border-green-200 hover:border-green-400', colorActive: 'bg-green-100 border-green-500', featureFlag: 'passengerCar' },
  { type: 'delivery_bike' as ServiceType, label: 'Moto Flash', icon: Package, color: 'bg-orange-50 border-orange-200 hover:border-orange-400', colorActive: 'bg-orange-100 border-orange-500', featureFlag: 'deliveryServices' },
  { type: 'delivery_car' as ServiceType, label: 'Car Flash', icon: Truck, color: 'bg-purple-50 border-purple-200 hover:border-purple-400', colorActive: 'bg-purple-100 border-purple-500', featureFlag: 'deliveryServices' },
];

export const ServiceTypeSelector = ({ value, onChange }: ServiceTypeSelectorProps) => {
  const flags = useFeatureFlags();

  const visibleOptions = SERVICE_OPTIONS.filter((option) => {
    if (!option.featureFlag) return true;
    return flags[option.featureFlag as keyof typeof flags];
  });

  if (visibleOptions.length <= 1) return null;

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Tipo de Serviço</label>
      <div className="grid grid-cols-2 gap-2">
        {visibleOptions.map((option) => {
          const Icon = option.icon;
          const isActive = value === option.type;

          return (
            <Card
              key={option.type}
              className={`p-3 cursor-pointer transition-all ${
                isActive ? option.colorActive : option.color
              }`}
              onClick={() => onChange(option.type)}
            >
              <div className="flex flex-col items-center gap-2 text-center">
                <Icon className="h-6 w-6" />
                <span className="text-xs font-medium">{option.label}</span>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
