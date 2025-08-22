import React from "react";
import { NavLink } from "react-router-dom";
import { Bike, Map as MapIcon, User, Star } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/map", label: "Mapa", icon: MapIcon },
  { to: "/rides", label: "Corridas", icon: Bike },
  { to: "/reviews", label: "Avaliações", icon: Star },
  { to: "/profile", label: "Perfil", icon: User },
];

export const BottomNavigation: React.FC = () => {
  const getLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex flex-col items-center justify-center gap-1 py-2 text-xs",
      isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
    );

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      aria-label="Navegação inferior"
    >
      <ul className="grid grid-cols-4">
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

export default BottomNavigation;
