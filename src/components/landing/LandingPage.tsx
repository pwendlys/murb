import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, Clock, Shield, Star, ArrowRight, Users, Zap } from 'lucide-react';

export const LandingPage = () => {
  const benefits = [
    {
      icon: MapPin,
      title: "Localização Precisa",
      description: "GPS integrado para encontrar você onde estiver"
    },
    {
      icon: Clock,
      title: "Rapidez",
      description: "Chegue ao seu destino no menor tempo possível"
    },
    {
      icon: Shield,
      title: "Segurança",
      description: "Mototaxistas verificados e viagens monitoradas"
    },
    {
      icon: Star,
      title: "Qualidade",
      description: "Avalie e seja avaliado para manter a excelência"
    }
  ];

  const passengerSteps = [
    { step: "1", text: "Cadastre-se como passageiro" },
    { step: "2", text: "Solicite uma corrida" },
    { step: "3", text: "Acompanhe em tempo real" },
    { step: "4", text: "Chegue ao destino" }
  ];

  const driverSteps = [
    { step: "1", text: "Cadastre-se como mototaxista" },
    { step: "2", text: "Receba solicitações" },
    { step: "3", text: "Atenda passageiros" },
    { step: "4", text: "Ganhe dinheiro" }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <span className="text-xl font-bold text-primary">Viaja+</span>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-secondary/10">
        <div className="container mx-auto px-4 py-20">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6 animate-fade-in">
              Sua Moto a um{' '}
              <span className="text-primary">Toque</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto animate-fade-in">
              Conectamos você ao transporte rápido e seguro que precisa. 
              Seja passageiro ou mototaxista, faça parte da nossa comunidade.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-slide-up">
              <Link to="/auth?type=passenger">
                <Button 
                  size="lg" 
                  className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-6 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <Users className="mr-2 h-5 w-5" />
                  Sou Passageiro
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              
              <Link to="/auth?type=driver">
                <Button 
                  size="lg" 
                  variant="outline"
                  className="w-full sm:w-auto border-primary text-primary hover:bg-primary hover:text-primary-foreground px-8 py-6 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <Zap className="mr-2 h-5 w-5" />
                  Sou Mototaxista
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Por que escolher o Viaja+?
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Oferecemos a melhor experiência em transporte urbano com tecnologia e segurança
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((benefit, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow duration-300 border-border bg-card">
                <CardContent className="p-6 text-center">
                  <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <benefit.icon className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{benefit.title}</h3>
                  <p className="text-muted-foreground text-sm">{benefit.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Como Funciona
            </h2>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Passageiros */}
            <div>
              <h3 className="text-2xl font-bold text-foreground mb-8 text-center">
                Para Passageiros
              </h3>
              <div className="space-y-6">
                {passengerSteps.map((step, index) => (
                  <div key={index} className="flex items-center space-x-4">
                    <div className="bg-primary text-primary-foreground w-10 h-10 rounded-full flex items-center justify-center font-bold">
                      {step.step}
                    </div>
                    <p className="text-lg text-foreground">{step.text}</p>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Motoristas */}
            <div>
              <h3 className="text-2xl font-bold text-foreground mb-8 text-center">
                Para Mototaxistas
              </h3>
              <div className="space-y-6">
                {driverSteps.map((step, index) => (
                  <div key={index} className="flex items-center space-x-4">
                    <div className="bg-secondary text-secondary-foreground w-10 h-10 rounded-full flex items-center justify-center font-bold">
                      {step.step}
                    </div>
                    <p className="text-lg text-foreground">{step.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Pronto para começar?
          </h2>
          <p className="text-lg mb-8 opacity-90">
            Junte-se a milhares de usuários que já confiam no Viaja+
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/auth?type=passenger">
              <Button 
                size="lg" 
                variant="secondary"
                className="w-full sm:w-auto px-8 py-6 text-lg font-semibold"
              >
                Começar como Passageiro
              </Button>
            </Link>
            <Link to="/auth?type=driver">
              <Button 
                size="lg" 
                variant="outline"
                className="w-full sm:w-auto px-8 py-6 text-lg font-semibold border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary"
              >
                Começar como Mototaxista
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t bg-background">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center gap-6 mb-4 md:mb-0">
              <span className="text-lg font-bold text-primary">Viaja+</span>
              <Link 
                to="/admin-login-direto" 
                className="text-xs text-muted-foreground hover:text-primary transition-colors opacity-50 hover:opacity-100"
              >
                Admin
              </Link>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 Viaja+. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};