import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Minus, Plus } from 'lucide-react';
import { 
  formatBRL, 
  parseBRLToCents, 
  clampMinimum,
  NEGOTIATION_MIN_VALUE_CENTS,
  NEGOTIATION_STEP_CENTS 
} from '@/utils/currency';

interface MotoNegociaOfferProps {
  initialValueCents?: number;
  onConfirm: (offerCents: number) => Promise<void>;
  onCancel: () => void;
}

export const MotoNegociaOffer = ({
  initialValueCents = 1470, // R$ 14,70 por padrão
  onConfirm,
  onCancel
}: MotoNegociaOfferProps) => {
  const [valueCents, setValueCents] = useState<number>(
    clampMinimum(initialValueCents)
  );
  const [rawInput, setRawInput] = useState<string>(
    formatBRL(clampMinimum(initialValueCents)).replace(/\s/g, '')
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatted = useMemo(() => formatBRL(valueCents), [valueCents]);

  const handleDecrement = () => {
    setError(null);
    const newValue = Math.max(
      valueCents - NEGOTIATION_STEP_CENTS,
      NEGOTIATION_MIN_VALUE_CENTS
    );
    setValueCents(newValue);
    setRawInput(formatBRL(newValue).replace(/\s/g, ''));
  };

  const handleIncrement = () => {
    setError(null);
    const newValue = valueCents + NEGOTIATION_STEP_CENTS;
    setValueCents(newValue);
    setRawInput(formatBRL(newValue).replace(/\s/g, ''));
  };

  const handleInputChange = (value: string) => {
    setRawInput(value);
    const cents = parseBRLToCents(value);
    if (cents !== null) {
      setValueCents(clampMinimum(cents));
      setError(null);
    }
  };

  const handleConfirm = async () => {
    setError(null);
    
    let finalCents = valueCents;
    if (finalCents < NEGOTIATION_MIN_VALUE_CENTS) {
      finalCents = NEGOTIATION_MIN_VALUE_CENTS;
      setValueCents(finalCents);
      setRawInput(formatBRL(finalCents).replace(/\s/g, ''));
      setError('O valor mínimo para oferta é R$ 3,00.');
      return;
    }
    
    try {
      setSubmitting(true);
      await onConfirm(finalCents);
    } catch (error) {
      setError('Não foi possível enviar sua oferta. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const isMinValue = valueCents <= NEGOTIATION_MIN_VALUE_CENTS;

  return (
    <div className="bg-background/95 backdrop-blur rounded-lg p-4 border border-border/50 space-y-4">
      {/* Header */}
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold text-foreground">
          Faça sua oferta
        </h3>
        <p className="text-sm text-muted-foreground">
          Os motoristas costumam aceitar valores mais altos.
        </p>
      </div>

      {/* Valor com botões */}
      <div className="flex items-center justify-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleDecrement}
          disabled={submitting || isMinValue}
          className="h-12 w-12 rounded-full"
          aria-label="Diminuir 1 real"
        >
          <Minus className="h-4 w-4" />
        </Button>

        <div className="flex-1 max-w-48">
          <input
            type="text"
            inputMode="decimal"
            pattern="[0-9]*[.,]?[0-9]{0,2}"
            className="text-2xl font-bold text-center w-full focus:outline-none bg-transparent text-foreground placeholder:text-muted-foreground"
            value={rawInput}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="R$ 0,00"
            aria-label="Valor da oferta em reais"
            disabled={submitting}
          />
          <div className="text-xs text-center text-muted-foreground mt-1">
            {formatted}
          </div>
        </div>

        <Button
          type="button"
          variant="outline" 
          size="icon"
          onClick={handleIncrement}
          disabled={submitting}
          className="h-12 w-12 rounded-full"
          aria-label="Aumentar 1 real"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Erro */}
      {error && (
        <div className="text-center">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Botões de ação */}
      <div className="space-y-2">
        <Button
          type="button"
          onClick={handleConfirm}
          disabled={submitting || valueCents < NEGOTIATION_MIN_VALUE_CENTS}
          className="w-full h-11 bg-primary hover:bg-primary/90 font-medium"
        >
          {submitting ? (
            <LoadingSpinner size="sm" />
          ) : (
            `Fazer oferta (${formatted})`
          )}
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={submitting}
          className="w-full h-10"
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
};