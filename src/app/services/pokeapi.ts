import { Pokemon, PokemonType, Weakness, Evolution } from '../types/pokemon';

export const fetchRandomLegendaryPokemon = async (): Promise<Pokemon> => {
  const maxAttempts = 40;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const randomId = Math.floor(Math.random() * TOTAL_POKEMON) + 1;
    try {
      const pokemon = await fetchPokemonById(randomId);
      // API species flags are mapped into pokemon.isLegendary.
      if (pokemon.isLegendary) {
        return pokemon;
      }
    } catch (error) {
      console.warn(`Legendary roll failed for ID ${randomId}:`, error);
    }
  }

  throw new Error('Failed to find legendary/mythical Pokemon using API flags');
};

const EVENT_SHINY_IDS = [
  6, 59, 94, 130, 143, 149, 196, 248, 282, 373, 448, 635, 700,
];

const MEGA_SPECIES_IDS = [
  3, 6, 9, 15, 18, 65, 80, 94, 115, 127, 130, 142, 150, 181, 208, 212, 214,
  229, 248, 254, 257, 260, 282, 302, 303, 306, 308, 310, 319, 323, 334, 354,
  359, 362, 373, 376, 380, 381, 384, 428, 445, 448, 460, 475, 531, 719,
];

const pickRandomFrom = <T>(list: T[]): T => {
  return list[Math.floor(Math.random() * list.length)];
};

export const fetchRandomEventPokemon = async (): Promise<Pokemon> => {
  const id = pickRandomFrom(EVENT_SHINY_IDS);
  const pokemon = await fetchPokemonById(id);
  return {
    ...pokemon,
    name: `Shiny ${pokemon.name}`,
    image: `${SPRITES_BASE_URL}/shiny/${pokemon.id}.png`,
  };
};

const POKEAPI_BASE_URL = 'https://pokeapi.co/api/v2';
const SPRITES_BASE_URL = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';
const TOTAL_POKEMON = 898; // All Pokemon up to Gen 8

// Helper to get animated sprite URL
const getAnimatedSpriteUrl = (id: number): string => {
  return `${SPRITES_BASE_URL}/versions/generation-v/black-white/animated/${id}.gif`;
};

// Fallback to static sprite if animated not available
const getStaticSpriteUrl = (id: number): string => {
  return `${SPRITES_BASE_URL}/${id}.png`;
};

// Get best available sprite (animated if possible)
const getPokemonSpriteUrl = (id: number): string => {
  // For Generation 1 Pokemon (1-151), animated sprites are available
  if (id <= 649) { // Gen V animated sprites go up to Gen 5
    return getAnimatedSpriteUrl(id);
  }
  return getStaticSpriteUrl(id);
};

interface PokeAPIType {
  type: {
    name: string;
  };
}

interface PokeAPIStat {
  base_stat: number;
  stat: {
    name: string;
  };
}

interface PokeAPIAbility {
  ability: {
    name: string;
  };
}

interface PokeAPISpecies {
  genera: {
    genus: string;
    language: {
      name: string;
    };
  }[];
  flavor_text_entries: {
    flavor_text: string;
    language: {
      name: string;
    };
  }[];
  evolution_chain: {
    url: string;
  };
  is_legendary: boolean;
  is_mythical: boolean;
}

interface PokeAPISpeciesVariety {
  is_default: boolean;
  pokemon: {
    name: string;
    url: string;
  };
}

interface PokeAPISpeciesDetailResponse {
  varieties: PokeAPISpeciesVariety[];
}

interface PokeAPIPokemonFormResponse {
  form_name: string;
  is_mega: boolean;
}

interface PokeAPIResponse {
  id: number;
  name: string;
  types: PokeAPIType[];
  stats: PokeAPIStat[];
  abilities: PokeAPIAbility[];
  weight: number;
  height: number;
  sprites: {
    other: {
      'official-artwork': {
        front_default: string;
      };
    };
  };
  species: {
    name: string;
    url: string;
  };
}

interface PokeAPIPokemonMoveEntry {
  move: {
    name: string;
    url: string;
  };
}

interface PokeAPIPokemonMovesResponse {
  id: number;
  moves: PokeAPIPokemonMoveEntry[];
}

interface PokeAPIMoveResponse {
  name: string;
  power: number | null;
  accuracy: number | null;
  pp: number | null;
  type: {
    name: string;
  };
  damage_class: {
    name: 'physical' | 'special' | 'status';
  };
}

interface PokeAPITypeDamageRelationsResponse {
  damage_relations: {
    double_damage_to: Array<{ name: string }>;
    half_damage_to: Array<{ name: string }>;
    no_damage_to: Array<{ name: string }>;
  };
}

interface PokeAPIPokemonListEntry {
  name: string;
  url: string;
}

interface PokeAPIPokemonListResponse {
  count: number;
  results: PokeAPIPokemonListEntry[];
}

export interface BattleMove {
  name: string;
  power: number;
  accuracy: number | null;
  type: PokemonType;
  damageClass: 'physical' | 'special';
}

export interface MegaFormInfo {
  id: number;
  pokedexId: number;
  name: string;
  baseName: string;
  formName: string;
  image: string;
  types: PokemonType[];
}

const moveDetailsCache = new Map<string, BattleMove | null>();
const typeEffectivenessCache = new Map<PokemonType, Map<PokemonType, number>>();

interface EvolutionChain {
  species: {
    name: string;
    url: string;
  };
  evolves_to: EvolutionChain[];
}

interface PokeAPIEvolutionChain {
  chain: EvolutionChain;
}

// Type effectiveness chart (simplified for common weaknesses)
const typeWeaknesses: Record<PokemonType, PokemonType[]> = {
  fire: ['water', 'ground', 'rock'],
  water: ['electric', 'grass'],
  grass: ['fire', 'ice', 'poison', 'flying', 'bug'],
  electric: ['ground'],
  psychic: ['bug', 'ghost', 'dark'],
  ice: ['fire', 'fighting', 'rock', 'steel'],
  dragon: ['ice', 'dragon', 'fairy'],
  dark: ['fighting', 'bug', 'fairy'],
  fairy: ['poison', 'steel'],
  normal: ['fighting'],
  fighting: ['flying', 'psychic', 'fairy'],
  flying: ['electric', 'ice', 'rock'],
  poison: ['ground', 'psychic'],
  ground: ['water', 'grass', 'ice'],
  rock: ['water', 'grass', 'fighting', 'ground', 'steel'],
  bug: ['fire', 'flying', 'rock'],
  ghost: ['ghost', 'dark'],
  steel: ['fire', 'fighting', 'ground'],
};

// Map PokeAPI types to our app's types
const mapPokemonType = (type: string): PokemonType => {
  const typeMap: Record<string, PokemonType> = {
    fire: 'fire',
    water: 'water',
    grass: 'grass',
    electric: 'electric',
    psychic: 'psychic',
    ice: 'ice',
    dragon: 'dragon',
    dark: 'dark',
    fairy: 'fairy',
    normal: 'normal',
    fighting: 'fighting',
    flying: 'flying',
    poison: 'poison',
    ground: 'ground',
    rock: 'rock',
    bug: 'bug',
    ghost: 'ghost',
    steel: 'steel',
  };
  return typeMap[type] || 'normal';
};

// Capitalize first letter
const capitalize = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

// Format ability name
const formatAbilityName = (name: string): string => {
  return name.split('-').map(capitalize).join(' ');
};

const formatPokemonName = (name: string): string => {
  return name
    .split('-')
    .map(capitalize)
    .join(' ');
};

const extractFormName = (fullName: string, speciesName: string): string | undefined => {
  if (fullName === speciesName) {
    return undefined;
  }

  if (fullName.startsWith(`${speciesName} `)) {
    return fullName.slice(speciesName.length + 1);
  }

  return fullName;
};

// Get Pokemon ID from species URL
const getIdFromUrl = (url: string): number => {
  const parts = url.split('/');
  return parseInt(parts[parts.length - 2]);
};

// Get weaknesses for a Pokemon's types
const getWeaknesses = (types: PokemonType[]): Weakness[] => {
  const weaknessMap = new Map<PokemonType, number>();
  
  types.forEach(type => {
    const weakTo = typeWeaknesses[type] || [];
    weakTo.forEach(weakType => {
      const current = weaknessMap.get(weakType) || 1;
      weaknessMap.set(weakType, current * 2);
    });
  });
  
  // Convert to array and sort by multiplier
  return Array.from(weaknessMap.entries())
    .map(([type, multiplier]) => ({ type, multiplier }))
    .sort((a, b) => b.multiplier - a.multiplier)
    .slice(0, 4); // Top 4 weaknesses
};

// Get evolution info from evolution chain
const getEvolutionInfo = async (
  chain: EvolutionChain,
  currentName: string
): Promise<{ prev?: Evolution; next?: Evolution } | undefined> => {
  const evolution: { prev?: Evolution; next?: Evolution } = {};
  
  const findInChain = async (
    node: EvolutionChain,
    parent?: EvolutionChain
  ): Promise<boolean> => {
    if (node.species.name === currentName) {
      // Get previous evolution
      if (parent) {
        const prevId = getIdFromUrl(parent.species.url);
        evolution.prev = {
          id: prevId,
          name: capitalize(parent.species.name),
          image: getPokemonSpriteUrl(prevId),
        };
      }
      
      // Get next evolution
      if (node.evolves_to.length > 0) {
        const nextSpecies = node.evolves_to[0].species;
        const nextId = getIdFromUrl(nextSpecies.url);
        evolution.next = {
          id: nextId,
          name: capitalize(nextSpecies.name),
          image: getPokemonSpriteUrl(nextId),
        };
      }
      return true;
    }
    
    for (const nextNode of node.evolves_to) {
      if (await findInChain(nextNode, node)) {
        return true;
      }
    }
    
    return false;
  };
  
  await findInChain(chain);
  return evolution.prev || evolution.next ? evolution : undefined;
};

// Helper function to fetch with retry
const fetchWithRetry = async (
  url: string,
  retries: number = 3,
  delay: number = 1000
): Promise<Response> => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return response;
      }
      // If not ok but not a network error, don't retry
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      if (i === retries - 1) {
        throw error;
      }
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
    }
  }
  throw new Error('Failed after retries');
};

// Fetch a single Pokemon by ID
export const fetchPokemonById = async (id: number): Promise<Pokemon> => {
  try {
    // Fetch basic Pokemon data
    const response = await fetchWithRetry(`${POKEAPI_BASE_URL}/pokemon/${id}`);
    const data: PokeAPIResponse = await response.json();
    
    // Fetch species data for description and evolution chain
    const speciesResponse = await fetchWithRetry(data.species.url);
    const speciesData: PokeAPISpecies = await speciesResponse.json();
    
    // Get English description
    const englishEntry = speciesData.flavor_text_entries.find(
      entry => entry.language.name === 'en'
    );
    const description = englishEntry
      ? englishEntry.flavor_text.replace(/\f/g, ' ').replace(/\n/g, ' ')
      : 'A mysterious Pokemon.';

    const englishGenusEntry = speciesData.genera.find(
      entry => entry.language.name === 'en'
    );
    const genus = englishGenusEntry
      ? englishGenusEntry.genus.trim()
      : data.species.name.split('-').map(capitalize).join(' ');
    
    // Fetch evolution chain
    let evolution: { prev?: Evolution; next?: Evolution } | undefined = undefined;
    try {
      const evolutionResponse = await fetchWithRetry(speciesData.evolution_chain.url);
      const evolutionData: PokeAPIEvolutionChain = await evolutionResponse.json();
      const evolutionInfo = await getEvolutionInfo(evolutionData.chain, data.name);
      if (evolutionInfo) {
        evolution = evolutionInfo;
      }
    } catch (error) {
      console.warn(`Failed to fetch evolution chain for ${data.name}:`, error);
    }
    
    // Map to our Pokemon interface
    const pokemon: Pokemon = {
      id: data.id,
      pokedexId: getIdFromUrl(data.species.url),
      name: capitalize(data.name),
      speciesName: formatPokemonName(data.species.name),
      formName: extractFormName(formatPokemonName(data.name), formatPokemonName(data.species.name)),
      hasAlternateForms: (speciesData.varieties?.length ?? 1) > 1,
      genus,
      types: data.types.map(t => mapPokemonType(t.type.name)),
      stats: {
        hp: data.stats.find(s => s.stat.name === 'hp')?.base_stat || 0,
        attack: data.stats.find(s => s.stat.name === 'attack')?.base_stat || 0,
        defense: data.stats.find(s => s.stat.name === 'defense')?.base_stat || 0,
        specialAttack: data.stats.find(s => s.stat.name === 'special-attack')?.base_stat || 0,
        specialDefense: data.stats.find(s => s.stat.name === 'special-defense')?.base_stat || 0,
        speed: data.stats.find(s => s.stat.name === 'speed')?.base_stat || 0,
      },
      abilities: data.abilities.slice(0, 2).map(a => formatAbilityName(a.ability.name)),
      description,
      image: getPokemonSpriteUrl(data.id),
      isLegendary: speciesData.is_legendary || speciesData.is_mythical,
      isMythical: speciesData.is_mythical,
      evolution,
      weight: data.weight,
      height: data.height,
      weaknesses: getWeaknesses(data.types.map(t => mapPokemonType(t.type.name))),
    };
    
    return pokemon;
  } catch (error) {
    console.error(`Error fetching Pokemon ${id}:`, error);
    throw error;
  }
};

// Fetch multiple Pokemon with pagination support
export const fetchPokemonList = async (
  limit: number = 200,
  page: number = 1,
  includeForms: boolean = false
): Promise<Pokemon[]> => {
  try {
    if (includeForms) {
      const countResponse = await fetchWithRetry(`${POKEAPI_BASE_URL}/pokemon?limit=1`);
      const countData: PokeAPIPokemonListResponse = await countResponse.json();
      const totalCount = countData.count;

      const listResponse = await fetchWithRetry(`${POKEAPI_BASE_URL}/pokemon?limit=${totalCount}&offset=0`);
      const listData: PokeAPIPokemonListResponse = await listResponse.json();

      const results: Pokemon[] = [];
      const batchSize = 60;
      const entries = listData.results || [];

      for (let start = 0; start < entries.length; start += batchSize) {
        const end = Math.min(start + batchSize, entries.length);
        const batch = entries.slice(start, end);

        const batchResults = await Promise.all(
          batch.map(async (entry) => {
            try {
              const response = await fetchWithRetry(entry.url);
              const data: PokeAPIResponse = await response.json();
              const pokedexId = getIdFromUrl(data.species.url);
              const speciesName = formatPokemonName(data.species.name);
              const fullName = formatPokemonName(data.name);

              return {
                id: data.id,
                pokedexId,
                name: fullName,
                speciesName,
                formName: extractFormName(fullName, speciesName),
                genus: speciesName,
                types: data.types.map((t) => mapPokemonType(t.type.name)),
                stats: {
                  hp: data.stats.find((s) => s.stat.name === 'hp')?.base_stat || 0,
                  attack: data.stats.find((s) => s.stat.name === 'attack')?.base_stat || 0,
                  defense: data.stats.find((s) => s.stat.name === 'defense')?.base_stat || 0,
                  specialAttack: data.stats.find((s) => s.stat.name === 'special-attack')?.base_stat || 0,
                  specialDefense: data.stats.find((s) => s.stat.name === 'special-defense')?.base_stat || 0,
                  speed: data.stats.find((s) => s.stat.name === 'speed')?.base_stat || 0,
                },
                abilities: data.abilities.slice(0, 2).map((a) => formatAbilityName(a.ability.name)),
                description: '',
                image:
                  data.sprites.other['official-artwork'].front_default ||
                  getStaticSpriteUrl(data.id),
                weight: data.weight,
                height: data.height,
                weaknesses: getWeaknesses(data.types.map((t) => mapPokemonType(t.type.name))),
              } as Pokemon;
            } catch (error) {
              console.warn(`Skipping Pokemon form from ${entry.url}:`, error);
              return null;
            }
          })
        );

        const validResults = batchResults.filter((p): p is Pokemon => p !== null);
        results.push(...validResults);
      }

      const sorted = results.sort((a, b) => {
        const leftDex = a.pokedexId ?? a.id;
        const rightDex = b.pokedexId ?? b.id;
        if (leftDex !== rightDex) {
          return leftDex - rightDex;
        }
        return a.id - b.id;
      });

      const speciesCounts = new Map<number, number>();
      sorted.forEach((pokemon) => {
        const dexId = pokemon.pokedexId ?? pokemon.id;
        speciesCounts.set(dexId, (speciesCounts.get(dexId) || 0) + 1);
      });

      return sorted.map((pokemon) => {
        const dexId = pokemon.pokedexId ?? pokemon.id;
        return {
          ...pokemon,
          hasAlternateForms: (speciesCounts.get(dexId) || 0) > 1,
        };
      });
    }

    const results: Pokemon[] = [];
    const batchSize = 50; // Load 50 at a time to avoid rate limiting
    
    // Calculate start and end IDs based on page
    const startId = (page - 1) * limit + 1;
    const endId = Math.min(startId + limit - 1, TOTAL_POKEMON);
    
    // Load in batches
    for (let start = startId; start <= endId; start += batchSize) {
      const end = Math.min(start + batchSize - 1, endId);
      const batchPromises = [];
      
      for (let i = start; i <= end; i++) {
        batchPromises.push(
          fetchPokemonById(i).catch(err => {
            console.warn(`Skipping Pokemon ${i}:`, err.message);
            return null; // Return null for failed fetches
          })
        );
      }
      
      const batchResults = await Promise.all(batchPromises);
      
      // Filter out null values (failed fetches)
      const validResults = batchResults.filter((p): p is Pokemon => p !== null);
      results.push(...validResults);
      
      // Add small delay between batches to avoid rate limiting
      if (end < endId) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return results;
  } catch (error) {
    console.error('Error fetching Pokemon list:', error);
    throw error;
  }
};

// Fetch random Pokemon for quiz
export const fetchRandomPokemon = async (count: number): Promise<Pokemon[]> => {
  const ids = new Set<number>();
  
  // Generate unique random IDs
  while (ids.size < count) {
    const randomId = Math.floor(Math.random() * TOTAL_POKEMON) + 1;
    ids.add(randomId);
  }
  
  const promises = Array.from(ids).map(id => fetchPokemonById(id));
  return Promise.all(promises);
};

// Calculate Pokemon rarity (1-6 stars) based on total stats
export const calculatePokemonRarity = (pokemon: Pokemon): number => {
  // Calculate total base stats (BST - Base Stat Total)
  const totalStats = 
    (pokemon.stats.hp || 0) + 
    (pokemon.stats.attack || 0) + 
    (pokemon.stats.defense || 0) + 
    (pokemon.stats.specialAttack || 0) + 
    (pokemon.stats.specialDefense || 0) + 
    (pokemon.stats.speed || 0);
  
  // Legendary/Mythical Pokemon always get 6 stars
  if (pokemon.isLegendary) return 6;
  
  // Rarity tiers based on total stats (BST - Base Stat Total)
  // Reference:
  // - Legendary Pokemon: 580-720 BST (auto 6★)
  // - Pseudo-legendary: 600 BST
  // - Strong Pokemon: 500-579 BST
  // - Above Average: 450-499 BST
  // - Average: 400-449 BST
  // - Below Average: 300-399 BST
  
  if (totalStats >= 600) return 6; // 6★ - Legendary tier stats
  if (totalStats >= 540) return 5; // 5★ - Pseudo-legendary (Dragonite, Tyranitar, Garchomp)
  if (totalStats >= 500) return 4; // 4★ - Strong (Arcanine, Gyarados, Starters final evo)
  if (totalStats >= 450) return 3; // 3★ - Above Average (Most evolved Pokemon)
  if (totalStats >= 400) return 2; // 2★ - Average (Mid-stage evolutions)
  return 1; // 1★ - Below Average (Basic Pokemon)
};

const shuffleArray = <T>(items: T[]): T[] => {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const fetchMoveDetails = async (moveUrl: string): Promise<BattleMove | null> => {
  if (moveDetailsCache.has(moveUrl)) {
    return moveDetailsCache.get(moveUrl) ?? null;
  }

  try {
    const response = await fetchWithRetry(moveUrl);
    const data: PokeAPIMoveResponse = await response.json();

    if (data.damage_class.name === 'status' || data.power === null || data.power <= 0) {
      moveDetailsCache.set(moveUrl, null);
      return null;
    }

    const mappedType = mapPokemonType(data.type.name);
    const move: BattleMove = {
      name: data.name,
      power: data.power,
      accuracy: data.accuracy,
      type: mappedType,
      damageClass: data.damage_class.name,
    };

    moveDetailsCache.set(moveUrl, move);
    return move;
  } catch (error) {
    console.warn('Failed to fetch move details from:', moveUrl, error);
    moveDetailsCache.set(moveUrl, null);
    return null;
  }
};

export const fetchPokemonBattleMoves = async (
  pokemonId: number,
  pokemonTypes: PokemonType[],
  desiredCount: number = 4
): Promise<BattleMove[]> => {
  const response = await fetchWithRetry(`${POKEAPI_BASE_URL}/pokemon/${pokemonId}`);
  const data: PokeAPIPokemonMovesResponse = await response.json();

  const randomizedMoves = shuffleArray(data.moves);
  const results: BattleMove[] = [];

  // Keep requests bounded while still finding a good set of valid typed moves.
  const maxAttempts = Math.min(40, randomizedMoves.length);
  for (let i = 0; i < maxAttempts && results.length < desiredCount; i += 1) {
    const entry = randomizedMoves[i];
    const move = await fetchMoveDetails(entry.move.url);
    if (!move) {
      continue;
    }

    const isSameTypeMove = pokemonTypes.includes(move.type);
    if (!isSameTypeMove) {
      continue;
    }

    if (!results.some((existing) => existing.name === move.name)) {
      results.push(move);
    }
  }

  // Graceful fallback if no same-type damaging moves are available.
  if (results.length === 0) {
    for (let i = 0; i < maxAttempts && results.length < desiredCount; i += 1) {
      const entry = randomizedMoves[i];
      const move = await fetchMoveDetails(entry.move.url);
      if (!move) {
        continue;
      }
      if (!results.some((existing) => existing.name === move.name)) {
        results.push(move);
      }
    }
  }

  return results;
};

const getAttackTypeEffectivenessMap = async (
  attackType: PokemonType
): Promise<Map<PokemonType, number>> => {
  const cached = typeEffectivenessCache.get(attackType);
  if (cached) {
    return cached;
  }

  const response = await fetchWithRetry(`${POKEAPI_BASE_URL}/type/${attackType}`);
  const data: PokeAPITypeDamageRelationsResponse = await response.json();

  const multiplierMap = new Map<PokemonType, number>();
  (Object.keys(typeWeaknesses) as PokemonType[]).forEach((type) => {
    multiplierMap.set(type, 1);
  });

  data.damage_relations.double_damage_to.forEach((entry) => {
    const targetType = mapPokemonType(entry.name);
    multiplierMap.set(targetType, (multiplierMap.get(targetType) || 1) * 2);
  });

  data.damage_relations.half_damage_to.forEach((entry) => {
    const targetType = mapPokemonType(entry.name);
    multiplierMap.set(targetType, (multiplierMap.get(targetType) || 1) * 0.5);
  });

  data.damage_relations.no_damage_to.forEach((entry) => {
    const targetType = mapPokemonType(entry.name);
    multiplierMap.set(targetType, 0);
  });

  typeEffectivenessCache.set(attackType, multiplierMap);
  return multiplierMap;
};

export const getTypeEffectivenessMultiplier = async (
  attackType: PokemonType,
  defenderTypes: PokemonType[]
): Promise<number> => {
  const map = await getAttackTypeEffectivenessMap(attackType);
  return defenderTypes.reduce((multiplier, defenderType) => {
    const value = map.get(defenderType) ?? 1;
    return multiplier * value;
  }, 1);
};

/**
 * Get mega forms for a Pokemon species by id or name.
 * Example inputs: 6, "charizard", "mewtwo".
 */
export const fetchPokemonMegaForms = async (
  pokemonNameOrId: string | number
): Promise<MegaFormInfo[]> => {
  const speciesResponse = await fetchWithRetry(
    `${POKEAPI_BASE_URL}/pokemon-species/${pokemonNameOrId}`
  );
  const speciesData: PokeAPISpeciesDetailResponse = await speciesResponse.json();

  const varieties = speciesData.varieties || [];

  const megaCandidates = await Promise.all(
    varieties.map(async (variety) => {
      const varietyName = variety.pokemon.name;

      try {
        const formResponse = await fetchWithRetry(
          `${POKEAPI_BASE_URL}/pokemon-form/${varietyName}`
        );
        const formData: PokeAPIPokemonFormResponse = await formResponse.json();

        if (!formData.is_mega) {
          return null;
        }

        const pokemonResponse = await fetchWithRetry(
          `${POKEAPI_BASE_URL}/pokemon/${varietyName}`
        );
        const pokemonData: PokeAPIResponse = await pokemonResponse.json();

        return {
          id: pokemonData.id,
          pokedexId: getIdFromUrl(pokemonData.species.url),
          name: formatPokemonName(pokemonData.name),
          baseName: formatPokemonName(pokemonData.species.name),
          formName: formData.form_name ? capitalize(formData.form_name) : 'Mega',
          image:
            pokemonData.sprites.other['official-artwork'].front_default ||
            getStaticSpriteUrl(pokemonData.id),
          types: pokemonData.types.map((typeEntry) => mapPokemonType(typeEntry.type.name)),
        } as MegaFormInfo;
      } catch (error) {
        console.warn(`Failed to check mega form for ${varietyName}:`, error);
        return null;
      }
    })
  );

  return megaCandidates
    .filter((megaForm): megaForm is MegaFormInfo => megaForm !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
};

/**
 * Fast check to determine whether a Pokemon has at least one mega form.
 */
export const hasMegaForms = async (pokemonNameOrId: string | number): Promise<boolean> => {
  const megaForms = await fetchPokemonMegaForms(pokemonNameOrId);
  return megaForms.length > 0;
};

export const fetchRandomMegaPokemon = async (): Promise<Pokemon> => {
  const maxAttempts = 16;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const speciesId = pickRandomFrom(MEGA_SPECIES_IDS);

    try {
      const megaForms = await fetchPokemonMegaForms(speciesId);
      if (megaForms.length === 0) {
        continue;
      }

      const pickedForm = pickRandomFrom(megaForms);
      const basePokemon = await fetchPokemonById(pickedForm.id);

      return {
        ...basePokemon,
        name: pickedForm.name,
        image: pickedForm.image,
        types: pickedForm.types,
      };
    } catch (error) {
      console.warn(`Mega roll failed for species ${speciesId}:`, error);
    }
  }

  throw new Error('Failed to find a mega pokemon for mega battle mode');
};

export const fetchRandomAlternateFormPokemon = async (): Promise<Pokemon> => {
  const maxAttempts = 24;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const speciesId = Math.floor(Math.random() * TOTAL_POKEMON) + 1;

    try {
      const speciesResponse = await fetchWithRetry(
        `${POKEAPI_BASE_URL}/pokemon-species/${speciesId}`
      );
      const speciesData: PokeAPISpeciesDetailResponse = await speciesResponse.json();

      const nonDefaultVarieties = (speciesData.varieties || []).filter((variety) => !variety.is_default);
      if (nonDefaultVarieties.length === 0) {
        continue;
      }

      const validForms = await Promise.all(
        nonDefaultVarieties.map(async (variety) => {
          const varietyName = variety.pokemon.name;

          try {
            const formResponse = await fetchWithRetry(
              `${POKEAPI_BASE_URL}/pokemon-form/${varietyName}`
            );
            const formData: PokeAPIPokemonFormResponse = await formResponse.json();

            if (formData.is_mega) {
              return null;
            }

            const pokemonResponse = await fetchWithRetry(
              `${POKEAPI_BASE_URL}/pokemon/${varietyName}`
            );
            const pokemonData: PokeAPIResponse = await pokemonResponse.json();

            return {
              id: pokemonData.id,
              name: formatPokemonName(pokemonData.name),
              image:
                pokemonData.sprites.other['official-artwork'].front_default ||
                getStaticSpriteUrl(pokemonData.id),
            };
          } catch {
            return null;
          }
        })
      );

      const candidates = validForms.filter((form): form is { id: number; name: string; image: string } => form !== null);
      if (candidates.length === 0) {
        continue;
      }

      const selected = pickRandomFrom(candidates);
      const basePokemon = await fetchPokemonById(selected.id);

      return {
        ...basePokemon,
        name: selected.name,
        image: selected.image,
      };
    } catch {
      // Try another species candidate.
    }
  }

  throw new Error('Failed to find alternate form pokemon');
};