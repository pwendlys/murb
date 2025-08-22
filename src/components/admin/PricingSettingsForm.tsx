import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { usePricingSettings } from '@/hooks/usePricingSettings';

const PricingSettingsForm = () => {
  const { settings, loading, saveSettings, compute } = usePricingSettings();
  const [local, setLocal] = useState({
    price_per_km_active: settings?.price_per_km_active ?? true,
    price_per_km: settings?.price_per_km ?? 2.5,
    fixed_price_active: settings?.fixed_price_active ?? false,
    fixed_price: settings?.fixed_price ?? null,
    service_fee_type: settings?.service_fee_type ?? 'fixed',
    service_fee_value: settings?.service_fee_value ?? 0,
  });

  const previewPrice10km = useMemo(() => compute(10), [compute, local]);

  // Keep local state in sync when settings load/change
  useMemo(() => {
    if (settings) {
      setLocal({
        price_per_km_active: settings.price_per_km_active,
        price_per_km: settings.price_per_km,
        fixed_price_active: settings.fixed_price_active,
        fixed_price: settings.fixed_price,
        service_fee_type: settings.service_fee_type,
        service_fee_value: settings.service_fee_value,
      });
    }
  }, [settings]);

  const handleSave = async () => {
    await saveSettings({
      price_per_km_active: local.price_per_km_active,
      price_per_km: Number(local.price_per_km) || 0,
      fixed_price_active: local.fixed_price_active,
      fixed_price: local.fixed_price !== null ? Number(local.fixed_price) : null,
      service_fee_type: local.service_fee_type as 'fixed' | 'percent',
      service_fee_value: Number(local.service_fee_value) || 0,
    });
    toast.success('Configurações de preço salvas!');
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Carregando configurações...
      </div>
    );
  }

  return (
    <Card className="border-0">
      <CardHeader>
        <CardTitle>Configurações de Preço</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Preço por KM ativo</Label>
              <Switch
                checked={local.price_per_km_active}
                onCheckedChange={(v) => setLocal((s) => ({ ...s, price_per_km_active: v }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ppk">Preço por KM (R$)</Label>
              <Input
                id="ppk"
                type="number"
                step="0.01"
                value={local.price_per_km}
                onChange={(e) => setLocal((s) => ({ ...s, price_per_km: Number(e.target.value) }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Preço fixo ativo</Label>
              <Switch
                checked={local.fixed_price_active}
                onCheckedChange={(v) => setLocal((s) => ({ ...s, fixed_price_active: v }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fp">Preço fixo (R$)</Label>
              <Input
                id="fp"
                type="number"
                step="0.01"
                value={local.fixed_price ?? ''}
                onChange={(e) => {
                  const val = e.target.value === '' ? null : Number(e.target.value);
                  setLocal((s) => ({ ...s, fixed_price: val }));
                }}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de taxa de serviço</Label>
              <Select
                value={local.service_fee_type}
                onValueChange={(v) => setLocal((s) => ({ ...s, service_fee_type: v as 'fixed' | 'percent' }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixa</SelectItem>
                  <SelectItem value="percent">Percentual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sfv">
                Valor da taxa de serviço {local.service_fee_type === 'percent' ? '(%)' : '(R$)'}
              </Label>
              <Input
                id="sfv"
                type="number"
                step="0.01"
                value={local.service_fee_value}
                onChange={(e) => setLocal((s) => ({ ...s, service_fee_value: Number(e.target.value) }))}
              />
            </div>

            <div className="p-4 rounded-lg bg-muted/50">
              <div className="text-sm text-muted-foreground">Prévia (10 km):</div>
              <div className="text-2xl font-bold text-primary">R$ {previewPrice10km.toFixed(2)}</div>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} className="bg-primary">
            Salvar Configurações
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default PricingSettingsForm;
