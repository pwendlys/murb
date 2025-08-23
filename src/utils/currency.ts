// Utilitários para formatação e parsing de moeda brasileira (BRL)

export const NEGOTIATION_MIN_VALUE_CENTS = 300; // R$ 3,00
export const NEGOTIATION_STEP_CENTS = 100; // R$ 1,00

// Formatador BRL oficial
const fmtBRL = new Intl.NumberFormat('pt-BR', { 
  style: 'currency', 
  currency: 'BRL' 
});

/**
 * Formata centavos para string BRL (ex: 1470 -> "R$ 14,70")
 */
export const formatBRL = (cents: number): string => {
  return fmtBRL.format(cents / 100);
};

/**
 * Converte string BRL para centavos (ex: "14,70" -> 1470)
 * Aceita formatos: "50", "50,0", "50.00", "R$ 50,00"
 */
export const parseBRLToCents = (input: string): number | null => {
  if (!input) return null;
  
  // Remove caracteres não numéricos exceto vírgula e ponto
  const sanitized = input
    .replace(/[^\d.,]/g, '')
    .replace(/\./g, ','); // Normaliza ponto para vírgula
    
  if (!sanitized) return null;

  const parts = sanitized.split(',');
  let cents = 0;

  if (parts.length === 1) {
    // Só inteiros: "50" -> 5000 centavos
    const reais = parts[0].replace(/\D/g, '');
    if (!reais) return null;
    cents = parseInt(reais, 10) * 100;
  } else if (parts.length === 2) {
    // Com decimais: "50,9" -> "50,90"; "50,123" -> "50,12"
    const reais = parts[0].replace(/\D/g, '') || '0';
    let decimais = parts[1].replace(/\D/g, '');
    
    // Ajustar decimais para 2 dígitos
    if (decimais.length === 1) {
      decimais = decimais + '0';
    } else if (decimais.length > 2) {
      decimais = decimais.slice(0, 2);
    }
    
    cents = parseInt(reais, 10) * 100 + parseInt(decimais || '00', 10);
  } else {
    // Múltiplas vírgulas são inválidas
    return null;
  }

  if (Number.isNaN(cents)) return null;
  return cents;
};

/**
 * Garante que o valor está no mínimo permitido
 */
export const clampMinimum = (cents: number): number => {
  return Math.max(cents, NEGOTIATION_MIN_VALUE_CENTS);
};

/**
 * Converte centavos para reais (número decimal)
 */
export const centsToReais = (cents: number): number => {
  return cents / 100;
};

/**
 * Converte reais para centavos
 */
export const reaisToCents = (reais: number): number => {
  return Math.round(reais * 100);
};