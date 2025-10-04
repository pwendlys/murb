import { describe, it, expect } from 'vitest';
import { CACHE_KEYS } from './cache';

describe('Cache Keys', () => {
  it('generates correct availability cache key', () => {
    const key = CACHE_KEYS.availability('juiz_de_fora');
    expect(key).toEqual(['availability', 'juiz_de_fora']);
  });

  it('generates correct pricing settings cache key', () => {
    const key = CACHE_KEYS.pricingSettings('moto_taxi');
    expect(key).toEqual(['pricing', 'moto_taxi']);
  });

  it('generates correct estimated price cache key', () => {
    const key = CACHE_KEYS.estimatedPrice('moto_taxi', 10);
    expect(key).toEqual(['price-estimate', 'moto_taxi', 10]);
  });

  it('handles different service types', () => {
    const motoKey = CACHE_KEYS.pricingSettings('moto_taxi');
    const carKey = CACHE_KEYS.pricingSettings('passenger_car');
    expect(motoKey).not.toEqual(carKey);
  });

  it('handles different regions', () => {
    const jfKey = CACHE_KEYS.availability('juiz_de_fora');
    const spKey = CACHE_KEYS.availability('sao_paulo');
    expect(jfKey).not.toEqual(spKey);
  });
});
