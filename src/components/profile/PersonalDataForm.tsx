
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Profile } from '@/types';
import AvatarUpload from './AvatarUpload';

interface PersonalDataFormProps {
  profile: Profile;
  onProfileUpdated: () => void;
}

export default function PersonalDataForm({ profile, onProfileUpdated }: PersonalDataFormProps) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    full_name: profile.full_name,
    phone: profile.phone || '',
  });
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.full_name.trim()) {
      toast.error('Nome completo é obrigatório');
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name.trim(),
          phone: formData.phone.trim() || null,
        })
        .eq('id', profile.id);

      if (error) throw error;

      toast.success('Dados atualizados com sucesso!');
      onProfileUpdated();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Erro ao atualizar dados');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpdated = (newUrl: string) => {
    setAvatarUrl(newUrl);
    onProfileUpdated(); // Refresh the profile to update header
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Seus Dados</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <AvatarUpload
            userId={profile.id}
            currentAvatarUrl={avatarUrl}
            userName={profile.full_name}
            onAvatarUpdated={handleAvatarUpdated}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Nome Completo *</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => handleInputChange('full_name', e.target.value)}
                placeholder="Seu nome completo"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                placeholder="(11) 99999-9999"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar Dados'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
