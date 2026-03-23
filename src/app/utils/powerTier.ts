import { Pokemon } from '../types/pokemon';

export type PowerTier = 'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S';

const sumStats = (pokemon: Pick<Pokemon, 'stats'>): number => {
  return (
    (pokemon.stats.hp || 0) +
    (pokemon.stats.attack || 0) +
    (pokemon.stats.defense || 0) +
    (pokemon.stats.specialAttack || 0) +
    (pokemon.stats.specialDefense || 0) +
    (pokemon.stats.speed || 0)
  );
};

export const getPokemonPowerTier = (pokemon: Pokemon): PowerTier => {
  if (pokemon.isLegendary || pokemon.isMythical) {
    return 'S';
  }

  const total = sumStats(pokemon);

  if (total >= 560) return 'A';
  if (total >= 500) return 'B';
  if (total >= 450) return 'C';
  if (total >= 400) return 'D';
  if (total >= 330) return 'E';
  return 'F';
};

export const getPowerTierRank = (tier: PowerTier): number => {
  const order: Record<PowerTier, number> = {
    S: 7,
    A: 6,
    B: 5,
    C: 4,
    D: 3,
    E: 2,
    F: 1,
  };

  return order[tier];
};

export const getPowerTierBadgeClass = (tier: PowerTier): string => {
  const classMap: Record<PowerTier, string> = {
    S: 'bg-fuchsia-600 text-white',
    A: 'bg-red-500 text-white',
    B: 'bg-orange-500 text-white',
    C: 'bg-yellow-500 text-[#2d2a43]',
    D: 'bg-lime-500 text-[#1f1e2d]',
    E: 'bg-emerald-500 text-white',
    F: 'bg-sky-400 text-[#1f1e2d]',
  };

  return classMap[tier];
};
