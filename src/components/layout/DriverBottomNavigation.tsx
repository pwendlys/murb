import React from "react";
import { NavLink } from "react-router-dom";
import { Map, Bike, DollarSign, Star, User } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/driver/map", label: "Mapa", icon: Map },
  { to: "/driver/rides", label: "Corridas", icon: Bike },
  { to: "/driver/earnings", label: "Ganhos", icon: DollarSign },
  { to: "/driver/reviews", label: "Avaliações", icon: Star },
  { to: "/profile", label: "Perfil", icon: User },
];

export const DriverBottomNavigation: React.FC = () => {
  const getLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex flex-col items-center justify-center gap-1 py-2 text-xs",
      isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
    );

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      aria-label="Navegação inferior do mototaxista"
    >
      <ul className="grid grid-cols-5">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink to={to} end className={getLinkClass}>
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span aria-hidden="true">{label}</span>
              <span className="sr-only">Ir para {label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default DriverBottomNavigation;