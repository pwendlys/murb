import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bike, User, AlertCircle, ArrowLeft } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { UserType } from '@/types';
interface AuthFormProps {
  onBack?: () => void;
  defaultUserType?: 'passenger' | 'driver';
}
export const AuthForm = ({
  onBack,
  defaultUserType
}: AuthFormProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [userType, setUserType] = useState<UserType>(defaultUserType || 'passenger');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const {
        error
      } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) throw error;
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    if (!fullName.trim()) {
      setError('Nome completo é obrigatório');
      setLoading(false);
      return;
    }
    try {
      const {
        error
      } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: fullName,
            phone: phone,
            user_type: userType
          }
        }
      });
      if (error) throw error;
      setSuccess('Conta criada com sucesso! Verifique seu email.');
      setEmail('');
      setPassword('');
      setFullName('');
      setPhone('');
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };
  return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <div className="w-full max-w-md animate-fade-in">
        {onBack && <Button variant="ghost" onClick={onBack} className="mb-4 flex items-center space-x-2">
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar</span>
          </Button>}

        <div className="text-center mb-8">
          
          <h1 className="text-3xl font-bold text-primary mb-2">Viaja+</h1>
          <p className="text-muted-foreground">Conectando passageiros e mototaxistas</p>
        </div>

        <Card className="shadow-ride-card border-0">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">Bem-vindo</CardTitle>
            <CardDescription className="text-center">
              Entre ou crie sua conta para começar
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>}
            
            {success && <Alert className="mb-4 border-green-200 bg-green-50">
                <AlertCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-700">{success}</AlertDescription>
              </Alert>}

            <Tabs defaultValue="signin" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Registrar</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required className="h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required className="h-11" />
                  </div>
                  <Button type="submit" className="w-full h-11 bg-ride-gradient hover:opacity-90 transition-opacity" disabled={loading}>
                    {loading ? <LoadingSpinner size="sm" /> : 'Entrar'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Nome Completo</Label>
                    <Input id="fullName" type="text" value={fullName} onChange={e => setFullName(e.target.value)} required className="h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signupEmail">Email</Label>
                    <Input id="signupEmail" type="email" value={email} onChange={e => setEmail(e.target.value)} required className="h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signupPassword">Senha</Label>
                    <Input id="signupPassword" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} className="h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone (Opcional)</Label>
                    <Input id="phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="userType">Tipo de Conta</Label>
                    <Select value={userType} onValueChange={value => setUserType(value as UserType)}>
                      <SelectTrigger className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="passenger">
                          <div className="flex items-center space-x-2">
                            <User className="w-4 h-4" />
                            <span>Passageiro</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="driver">
                          <div className="flex items-center space-x-2">
                            <Bike className="w-4 h-4" />
                            <span>Mototaxista</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full h-11 bg-ride-gradient hover:opacity-90 transition-opacity" disabled={loading}>
                    {loading ? <LoadingSpinner size="sm" /> : 'Criar Conta'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>;
};