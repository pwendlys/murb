import React, { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { PassengerReviews } from "@/components/passenger/PassengerReviews";
import { BottomNavigation } from "@/components/layout/BottomNavigation";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

export const PassengerReviewsPage: React.FC = () => {
  const { user, loading } = useAuth();

  useEffect(() => {
    // Set SEO meta tags
    document.title = "Minhas Avaliações - EcoRide";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute("content", "Veja as avaliações que você recebeu dos mototaxistas no EcoRide");
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Você precisa estar logado para ver suas avaliações.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b px-4 py-4">
        <h1 className="text-2xl font-bold">Minhas Avaliações</h1>
        <p className="text-muted-foreground">
          Veja as avaliações que você recebeu dos mototaxistas
        </p>
      </header>

      <main className="container mx-auto px-4 py-6 pb-20">
        <PassengerReviews />
      </main>

      <BottomNavigation />
    </div>
  );
};