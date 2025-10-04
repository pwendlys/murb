import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import type { PricingSettings } from '@/hooks/usePricingSettings';
import type { ServiceType } from '@/types';
import { SERVICE_METADATA } from '@/lib/serviceMetadata';
import { logTelemetry } from '@/lib/telemetry';

interface ServicePricingEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: PricingSettings;
  onSave: (serviceType: ServiceType, patch: Partial<PricingSettings>) => Promise<void>;
}

interface ValidationErrors {
  price_per_km?: string;
  fixed_price?: string;
  service_fee_value?: string;
}

export const ServicePricingEditModal = ({ open, onOpenChange, settings, onSave }: ServicePricingEditModalProps) => {
  const [localSettings, setLocalSettings] = useState<PricingSettings>(settings);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
    setErrors({});
  }, [settings]);

  const validateField = (field: keyof ValidationErrors, value: number | null): string | undefined => {
    if (field === 'price_per_km') {
      if (value === null || value < 0.5) return 'Preço mínimo: R$ 0,50';
      if (value > 50) return 'Preço máximo: R$ 50,00';
    }
    if (field === 'fixed_price' && localSettings.fixed_price_active) {
      if (value === null || value < 3) return 'Preço mínimo: R$ 3,00';
      if (value > 500) return 'Preço máximo: R$ 500,00';
    }
    if (field === 'service_fee_value') {
      if (value === null || value < 0) return 'Valor mínimo: 0';
      if (localSettings.service_fee_type === 'percent' && value > 100) return 'Porcentagem máxima: 100%';
      if (localSettings.service_fee_type === 'fixed' && value > 100) return 'Taxa máxima: R$ 100,00';
    }
    return undefined;
  };

  const handleFieldChange = (field: keyof PricingSettings, value: any) => {
    const newSettings = { ...localSettings, [field]: value };
    setLocalSettings(newSettings);

    // Validate numeric fields
    if (field === 'price_per_km' || field === 'fixed_price' || field === 'service_fee_value') {
      const error = validateField(field as keyof ValidationErrors, value);
      setErrors((prev) => ({
        ...prev,
        [field]: error,
      }));
    }

    // Clear fixed_price error when toggling off
    if (field === 'fixed_price_active' && !value) {
      setErrors((prev) => ({ ...prev, fixed_price: undefined }));
    }
  };

  const hasErrors = Object.values(errors).some((error) => error !== undefined);

  const handleSave = async () => {
    // Final validation
    const newErrors: ValidationErrors = {
      price_per_km: validateField('price_per_km', localSettings.price_per_km),
      fixed_price: validateField('fixed_price', localSettings.fixed_price),
      service_fee_value: validateField('service_fee_value', localSettings.service_fee_value),
    };

    // Remove undefined errors
    Object.keys(newErrors).forEach((key) => {
      if (newErrors[key as keyof ValidationErrors] === undefined) {
        delete newErrors[key as keyof ValidationErrors];
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error('Corrija os erros antes de salvar');
      return;
    }

    setIsSaving(true);
    try {
      const changedFields = Object.keys(localSettings).filter(
        (key) => localSettings[key as keyof PricingSettings] !== settings[key as keyof PricingSettings]
      );

      await onSave(settings.service_type, localSettings);
      
      logTelemetry({
        event: 'admin_pricing_updated',
        data: { service_type: settings.service_type, fields: changedFields },
      });

      toast.success('Preços atualizados com sucesso!');
      onOpenChange(false);
    } catch (error) {
      toast.error('Erro ao atualizar preços');
      console.error('Error updating pricing:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const metadata = SERVICE_METADATA[settings.service_type];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Editar Preços - {metadata.label}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Price per km */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="price_per_km_active">Preço por Km</Label>
              <Switch
                id="price_per_km_active"
                checked={localSettings.price_per_km_active}
                onCheckedChange={(checked) => handleFieldChange('price_per_km_active', checked)}
              />
            </div>
            {localSettings.price_per_km_active && (
              <div className="space-y-1">
                <Input
                  type="number"
                  step="0.01"
                  min="0.50"
                  max="50"
                  value={localSettings.price_per_km}
                  onChange={(e) => handleFieldChange('price_per_km', parseFloat(e.target.value) || 0)}
                  placeholder="Ex: 2.50"
                  className={errors.price_per_km ? 'border-red-500' : ''}
                />
                {errors.price_per_km && (
                  <p className="text-xs text-red-500">{errors.price_per_km}</p>
                )}
              </div>
            )}
          </div>

          {/* Fixed price */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="fixed_price_active">Preço Fixo</Label>
              <Switch
                id="fixed_price_active"
                checked={localSettings.fixed_price_active}
                onCheckedChange={(checked) => handleFieldChange('fixed_price_active', checked)}
              />
            </div>
            {localSettings.fixed_price_active && (
              <div className="space-y-1">
                <Input
                  type="number"
                  step="0.01"
                  min="3"
                  max="500"
                  value={localSettings.fixed_price ?? ''}
                  onChange={(e) =>
                    handleFieldChange('fixed_price', e.target.value ? parseFloat(e.target.value) : null)
                  }
                  placeholder="Ex: 15.00"
                  className={errors.fixed_price ? 'border-red-500' : ''}
                />
                {errors.fixed_price && (
                  <p className="text-xs text-red-500">{errors.fixed_price}</p>
                )}
              </div>
            )}
          </div>

          {/* Service fee */}
          <div className="space-y-2">
            <Label>Taxa de Serviço</Label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Select
                  value={localSettings.service_fee_type}
                  onValueChange={(value: 'fixed' | 'percent') => handleFieldChange('service_fee_type', value)}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Valor Fixo</SelectItem>
                    <SelectItem value="percent">Porcentagem</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max={localSettings.service_fee_type === 'percent' ? 100 : undefined}
                  value={localSettings.service_fee_value}
                  onChange={(e) => handleFieldChange('service_fee_value', parseFloat(e.target.value) || 0)}
                  placeholder={localSettings.service_fee_type === 'fixed' ? 'Ex: 2.00' : 'Ex: 10'}
                  className={errors.service_fee_value ? 'border-red-500' : ''}
                />
              </div>
              {errors.service_fee_value && (
                <p className="text-xs text-red-500">{errors.service_fee_value}</p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={hasErrors || isSaving}>
            {isSaving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
