import { Bike, Car, Package, Truck, type LucideIcon } from 'lucide-react';
import type { ServiceType } from '@/types';

export interface ServiceMetadata {
  type: ServiceType;
  label: string;
  description: string;
  icon: LucideIcon;
  color: string;
  colorActive: string;
  accentColor: string;
  bgClass: string;
  borderClass: string;
  hoverClass: string;
  activeClass: string;
}

export const SERVICE_METADATA: Record<ServiceType, ServiceMetadata> = {
  moto_taxi: {
    type: 'moto_taxi',
    label: 'Moto Táxi',
    description: 'Transporte rápido em motocicleta',
    icon: Bike,
    color: 'text-blue-600',
    colorActive: 'text-blue-700',
    accentColor: '#2563eb',
    bgClass: 'bg-blue-50',
    borderClass: 'border-blue-200',
    hoverClass: 'hover:border-blue-400',
    activeClass: 'bg-blue-100 border-blue-500',
  },
  passenger_car: {
    type: 'passenger_car',
    label: 'Carro Passageiro',
    description: 'Conforto e segurança em carro',
    icon: Car,
    color: 'text-green-600',
    colorActive: 'text-green-700',
    accentColor: '#16a34a',
    bgClass: 'bg-green-50',
    borderClass: 'border-green-200',
    hoverClass: 'hover:border-green-400',
    activeClass: 'bg-green-100 border-green-500',
  },
  delivery_bike: {
    type: 'delivery_bike',
    label: 'Moto Flash',
    description: 'Entrega rápida em motocicleta',
    icon: Package,
    color: 'text-orange-600',
    colorActive: 'text-orange-700',
    accentColor: '#ea580c',
    bgClass: 'bg-orange-50',
    borderClass: 'border-orange-200',
    hoverClass: 'hover:border-orange-400',
    activeClass: 'bg-orange-100 border-orange-500',
  },
  delivery_car: {
    type: 'delivery_car',
    label: 'Car Flash',
    description: 'Entrega com maior capacidade',
    icon: Truck,
    color: 'text-purple-600',
    colorActive: 'text-purple-700',
    accentColor: '#9333ea',
    bgClass: 'bg-purple-50',
    borderClass: 'border-purple-200',
    hoverClass: 'hover:border-purple-400',
    activeClass: 'bg-purple-100 border-purple-500',
  },
};

export const getServiceMetadata = (type: ServiceType): ServiceMetadata => {
  return SERVICE_METADATA[type];
};
