import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { PricingSettings } from '@/hooks/usePricingSettings';
import type { ServiceType } from '@/types';

interface ServicePricingEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: PricingSettings;
  onSave: (serviceType: ServiceType, patch: Partial<PricingSettings>) => Promise<void>;
}

const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  moto_taxi: 'Moto Táxi',
  passenger_car: 'Carro Passageiro',
  delivery_bike: 'Moto Flash',
  delivery_car: 'Car Flash',
};

export const ServicePricingEditModal = ({ open, onOpenChange, settings, onSave }: ServicePricingEditModalProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [local, setLocal] = useState(settings);

  useEffect(() => {
    setLocal(settings);
  }, [settings]);

  const handleSave = async () => {
    setLoading(true);
    try {
      await onSave(settings.service_type, {
        price_per_km_active: local.price_per_km_active,
        price_per_km: local.price_per_km,
        fixed_price_active: local.fixed_price_active,
        fixed_price: local.fixed_price,
        service_fee_type: local.service_fee_type,
        service_fee_value: local.service_fee_value,
      });
      toast({ title: 'Preços atualizados com sucesso!' });
      onOpenChange(false);
    } catch (error) {
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Preços - {SERVICE_TYPE_LABELS[settings.service_type]}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="price_per_km_active">Preço por km ativo</Label>
              <Switch
                id="price_per_km_active"
                checked={local.price_per_km_active}
                onCheckedChange={(checked) => setLocal({ ...local, price_per_km_active: checked })}
              />
            </div>
            {local.price_per_km_active && (
              <div>
                <Label htmlFor="price_per_km">Preço por km (R$)</Label>
                <Input
                  id="price_per_km"
                  type="number"
                  step="0.01"
                  min="0"
                  value={local.price_per_km}
                  onChange={(e) => setLocal({ ...local, price_per_km: parseFloat(e.target.value) || 0 })}
                />
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="fixed_price_active">Preço fixo ativo</Label>
              <Switch
                id="fixed_price_active"
                checked={local.fixed_price_active}
                onCheckedChange={(checked) => setLocal({ ...local, fixed_price_active: checked })}
              />
            </div>
            {local.fixed_price_active && (
              <div>
                <Label htmlFor="fixed_price">Preço fixo (R$)</Label>
                <Input
                  id="fixed_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={local.fixed_price ?? ''}
                  onChange={(e) => setLocal({ ...local, fixed_price: parseFloat(e.target.value) || null })}
                />
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="service_fee_type">Tipo de taxa de serviço</Label>
              <Select
                value={local.service_fee_type}
                onValueChange={(value: 'fixed' | 'percent') => setLocal({ ...local, service_fee_type: value })}
              >
                <SelectTrigger id="service_fee_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixo (R$)</SelectItem>
                  <SelectItem value="percent">Percentual (%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="service_fee_value">
                Valor da taxa {local.service_fee_type === 'fixed' ? '(R$)' : '(%)'}
              </Label>
              <Input
                id="service_fee_value"
                type="number"
                step="0.01"
                min="0"
                value={local.service_fee_value}
                onChange={(e) => setLocal({ ...local, service_fee_value: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
