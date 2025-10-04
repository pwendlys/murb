import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { ServiceType } from '@/types';
import { getServiceMetadata } from '@/lib/serviceMetadata';

interface AvailabilityRule {
  id: string;
  service_type: ServiceType;
  region: string;
  weekday_mask: number[];
  time_start: string;
  time_end: string;
  active: boolean;
  surge_multiplier: number;
  notes?: string;
}

const weekdayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const AvailabilityRulesManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingRule, setEditingRule] = useState<Partial<AvailabilityRule> | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const { data: rules, isLoading } = useQuery({
    queryKey: ['availability-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_availability_rules')
        .select('*')
        .order('service_type', { ascending: true });
      
      if (error) throw error;
      return data as AvailabilityRule[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (rule: Partial<AvailabilityRule>) => {
      const { id, ...ruleData } = rule as AvailabilityRule;
      const { error } = await supabase.from('service_availability_rules').insert([ruleData]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability-rules'] });
      toast({ title: 'Regra criada com sucesso' });
      setIsDialogOpen(false);
      setEditingRule(null);
    },
    onError: () => {
      toast({ title: 'Erro ao criar regra', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (rule: AvailabilityRule) => {
      const { id, ...updates } = rule;
      const { error } = await supabase
        .from('service_availability_rules')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability-rules'] });
      toast({ title: 'Regra atualizada com sucesso' });
      setIsDialogOpen(false);
      setEditingRule(null);
    },
    onError: () => {
      toast({ title: 'Erro ao atualizar regra', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('service_availability_rules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability-rules'] });
      toast({ title: 'Regra excluída com sucesso' });
    },
    onError: () => {
      toast({ title: 'Erro ao excluir regra', variant: 'destructive' });
    },
  });

  const validateRule = (rule: Partial<AvailabilityRule>): boolean => {
    const errors: Record<string, string> = {};

    if (!rule.service_type) errors.service_type = 'Tipo de serviço obrigatório';
    if (!rule.region) errors.region = 'Região obrigatória';
    if (!rule.weekday_mask || rule.weekday_mask.length === 0) {
      errors.weekday_mask = 'Selecione pelo menos um dia';
    }
    if (!rule.time_start) errors.time_start = 'Horário inicial obrigatório';
    if (!rule.time_end) errors.time_end = 'Horário final obrigatório';
    if (rule.time_start && rule.time_end && rule.time_start >= rule.time_end) {
      errors.time_end = 'Horário final deve ser maior que inicial';
    }
    if (rule.surge_multiplier !== undefined && rule.surge_multiplier < 1.0) {
      errors.surge_multiplier = 'Multiplicador deve ser >= 1.0';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = () => {
    if (!editingRule) return;
    if (!validateRule(editingRule)) return;

    if (editingRule.id) {
      updateMutation.mutate(editingRule as AvailabilityRule);
    } else {
      createMutation.mutate(editingRule);
    }
  };

  const handleNew = () => {
    setEditingRule({
      service_type: 'moto_taxi',
      region: 'juiz_de_fora',
      weekday_mask: [1, 2, 3, 4, 5],
      time_start: '08:00',
      time_end: '18:00',
      active: true,
      surge_multiplier: 1.0,
    });
    setValidationErrors({});
    setIsDialogOpen(true);
  };

  const handleEdit = (rule: AvailabilityRule) => {
    setEditingRule(rule);
    setValidationErrors({});
    setIsDialogOpen(true);
  };

  const toggleWeekday = (day: number) => {
    if (!editingRule) return;
    const current = editingRule.weekday_mask || [];
    const updated = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day].sort();
    setEditingRule({ ...editingRule, weekday_mask: updated });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Regras de Disponibilidade</h2>
          <p className="text-muted-foreground">Gerencie horários e regiões por tipo de serviço</p>
        </div>
        <Button onClick={handleNew}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Regra
        </Button>
      </div>

      <div className="grid gap-4">
        {rules?.map((rule) => {
          const metadata = getServiceMetadata(rule.service_type);
          return (
            <Card key={rule.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {metadata.label}
                      {rule.surge_multiplier > 1.0 && (
                        <Badge variant="secondary">
                          Surge {rule.surge_multiplier}x
                        </Badge>
                      )}
                      {!rule.active && <Badge variant="destructive">Inativo</Badge>}
                    </CardTitle>
                    <CardDescription>
                      {rule.region} • {rule.time_start}-{rule.time_end}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={() => handleEdit(rule)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        if (confirm('Excluir esta regra?')) {
                          deleteMutation.mutate(rule.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-1">
                  {weekdayLabels.map((label, idx) => (
                    <Badge
                      key={idx}
                      variant={rule.weekday_mask.includes(idx === 0 ? 7 : idx) ? 'default' : 'outline'}
                    >
                      {label}
                    </Badge>
                  ))}
                </div>
                {rule.notes && (
                  <p className="text-sm text-muted-foreground mt-2">{rule.notes}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRule?.id ? 'Editar Regra' : 'Nova Regra'}
            </DialogTitle>
            <DialogDescription>
              Configure horários e regiões de disponibilidade
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de Serviço</Label>
              <Select
                value={editingRule?.service_type || 'moto_taxi'}
                onValueChange={(value) =>
                  setEditingRule({ ...editingRule, service_type: value as ServiceType })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="moto_taxi">Moto Táxi</SelectItem>
                  <SelectItem value="passenger_car">Carro Passageiro</SelectItem>
                  <SelectItem value="delivery_bike">Moto Flash</SelectItem>
                  <SelectItem value="delivery_car">Car Flash</SelectItem>
                </SelectContent>
              </Select>
              {validationErrors.service_type && (
                <p className="text-sm text-destructive">{validationErrors.service_type}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Região</Label>
              <Input
                value={editingRule?.region || ''}
                onChange={(e) => setEditingRule({ ...editingRule, region: e.target.value })}
                placeholder="juiz_de_fora"
              />
              {validationErrors.region && (
                <p className="text-sm text-destructive">{validationErrors.region}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Dias da Semana</Label>
              <div className="flex gap-2 flex-wrap">
                {weekdayLabels.map((label, idx) => {
                  const dayValue = idx === 0 ? 7 : idx;
                  const isSelected = editingRule?.weekday_mask?.includes(dayValue);
                  return (
                    <div key={idx} className="flex items-center space-x-2">
                      <Checkbox
                        id={`day-${idx}`}
                        checked={isSelected}
                        onCheckedChange={() => toggleWeekday(dayValue)}
                      />
                      <Label htmlFor={`day-${idx}`}>{label}</Label>
                    </div>
                  );
                })}
              </div>
              {validationErrors.weekday_mask && (
                <p className="text-sm text-destructive">{validationErrors.weekday_mask}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Horário Inicial</Label>
                <Input
                  type="time"
                  value={editingRule?.time_start || ''}
                  onChange={(e) =>
                    setEditingRule({ ...editingRule, time_start: e.target.value })
                  }
                />
                {validationErrors.time_start && (
                  <p className="text-sm text-destructive">{validationErrors.time_start}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Horário Final</Label>
                <Input
                  type="time"
                  value={editingRule?.time_end || ''}
                  onChange={(e) => setEditingRule({ ...editingRule, time_end: e.target.value })}
                />
                {validationErrors.time_end && (
                  <p className="text-sm text-destructive">{validationErrors.time_end}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Multiplicador de Surge</Label>
              <Input
                type="number"
                step="0.1"
                min="1.0"
                value={editingRule?.surge_multiplier || 1.0}
                onChange={(e) =>
                  setEditingRule({
                    ...editingRule,
                    surge_multiplier: parseFloat(e.target.value) || 1.0,
                  })
                }
              />
              {validationErrors.surge_multiplier && (
                <p className="text-sm text-destructive">{validationErrors.surge_multiplier}</p>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="active"
                checked={editingRule?.active ?? true}
                onCheckedChange={(checked) => setEditingRule({ ...editingRule, active: checked })}
              />
              <Label htmlFor="active">Regra ativa</Label>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={editingRule?.notes || ''}
                onChange={(e) => setEditingRule({ ...editingRule, notes: e.target.value })}
                placeholder="Observações internas..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
