import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { RideRequest } from "@/components/passenger/RideRequest";
import { ActiveRideTracking } from "@/components/passenger/ActiveRideTracking";
import { useActiveRide } from "@/hooks/useActiveRide";
import { LocationCoords } from "@/services/googleMaps";
interface TopPanelProps {
  currentLocation: LocationCoords | null;
  onDestinationUpdate?: (destination: LocationCoords | null) => void;
  onOriginUpdate?: (origin: LocationCoords | null) => void;
}
export const TopPanel: React.FC<TopPanelProps> = ({
  currentLocation,
  onDestinationUpdate,
  onOriginUpdate
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const {
    activeRide,
    cancelRide
  } = useActiveRide();
  return <div className="fixed top-0 inset-x-0 z-40 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/40">
      {/* Header with Logo and Toggle Button */}
      <div className="flex justify-between items-center pt-2 px-4">
        <img src="/lovable-uploads/55db4a40-fce5-4b15-87bc-1e15c6dc286d.png" alt="Viaja+" className="h-6 w-auto" />
        
        <Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)} className="h-7 w-12 p-0 rounded-full bg-background/90 backdrop-blur border border-border/50 hover:bg-background">
          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
      </div>

      {/* Content */}
      <div className={cn("transition-all duration-300 ease-in-out overflow-hidden", isExpanded ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0")}>
        <div className="p-4 max-w-md mx-auto">
          {activeRide ? <ActiveRideTracking ride={activeRide} onCancel={cancelRide} /> : <RideRequest variant="overlay" currentLocation={currentLocation} onDestinationUpdate={onDestinationUpdate} onOriginUpdate={onOriginUpdate} />}
        </div>
      </div>
    </div>;
};
export default TopPanel;