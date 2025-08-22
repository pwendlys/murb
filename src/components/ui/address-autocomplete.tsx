
import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { MapPin, Clock } from 'lucide-react';
import { getPlacePredictions, PlacePrediction } from '@/services/googleMaps';

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string, placeId?: string) => void;
  placeholder?: string;
  className?: string;
}

export const AddressAutocomplete = ({
  value,
  onChange,
  placeholder = "Digite o endereço...",
  className
}: AddressAutocompleteProps) => {
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [showPredictions, setShowPredictions] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (value.length >= 3) {
      timeoutRef.current = setTimeout(async () => {
        setLoading(true);
        try {
          const results = await getPlacePredictions(value);
          setPredictions(results);
          setShowPredictions(true);
        } catch (error) {
          console.error('Error getting place predictions:', error);
          setPredictions([]);
        } finally {
          setLoading(false);
        }
      }, 300);
    } else {
      setPredictions([]);
      setShowPredictions(false);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value]);

  const handlePredictionClick = (prediction: PlacePrediction) => {
    onChange(prediction.description, prediction.place_id);
    setShowPredictions(false);
    setPredictions([]);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const handleInputBlur = () => {
    // Delay hiding predictions to allow clicks
    setTimeout(() => setShowPredictions(false), 150);
  };

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        value={value}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        onFocus={() => predictions.length > 0 && setShowPredictions(true)}
        placeholder={placeholder}
        className={className}
      />
      
      {showPredictions && predictions.length > 0 && (
        <Card className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto">
          <div className="p-2">
            {loading ? (
              <div className="flex items-center justify-center py-2">
                <Clock className="w-4 h-4 animate-spin" />
                <span className="ml-2 text-sm text-muted-foreground">Buscando...</span>
              </div>
            ) : (
              predictions.map((prediction) => (
                <div
                  key={prediction.place_id}
                  className="flex items-start p-2 hover:bg-muted rounded cursor-pointer"
                  onClick={() => handlePredictionClick(prediction)}
                >
                  <MapPin className="w-4 h-4 mt-1 text-muted-foreground flex-shrink-0" />
                  <div className="ml-2 flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {prediction.main_text}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {prediction.secondary_text}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      )}
    </div>
  );
};
