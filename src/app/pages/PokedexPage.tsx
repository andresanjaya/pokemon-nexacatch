import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, SlidersHorizontal, ArrowDownWideNarrow, ArrowUpNarrowWide } from 'lucide-react';
import { usePokemonList } from '../hooks/usePokemon';
import { PokemonCard } from '../components/PokemonCard';
import { PokemonType } from '../types/pokemon';
import { motion, AnimatePresence } from 'motion/react';
import { typeColors } from '../utils/typeColors';
import { getTypeIconStyle } from '../utils/typeIconImages';
import { useSearchParams } from 'react-router';

// Generation ranges
const GENERATION_RANGES = [
  { gen: 1, name: 'Generation I', start: 1, end: 151 },
  { gen: 2, name: 'Generation II', start: 152, end: 251 },
  { gen: 3, name: 'Generation III', start: 252, end: 386 },
  { gen: 4, name: 'Generation IV', start: 387, end: 493 },
  { gen: 5, name: 'Generation V', start: 494, end: 649 },
  { gen: 6, name: 'Generation VI', start: 650, end: 721 },
  { gen: 7, name: 'Generation VII', start: 722, end: 809 },
  { gen: 8, name: 'Generation VIII', start: 810, end: 898 },
];

export function PokedexPage() {
  const {
    pokemon: pokemonData,
    loading,
    loadingMore,
    error,
    hasMore,
    loadMore,
    globalReady,
    ensureGlobalDataLoaded,
  } = usePokemonList();
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<PokemonType | 'all'>('all');
  const [sortBy, setSortBy] = useState<'id' | 'name' | 'hp' | 'attack' | 'defense' | 'specialAttack' | 'specialDefense' | 'speed'>('id');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [applyingFilter, setApplyingFilter] = useState(false);
  
  // Ref for infinite scroll observer
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Get region filter from URL
  const regionStart = searchParams.get('start');
  const regionEnd = searchParams.get('end');

  const allTypes: PokemonType[] = [
    'fire', 'water', 'grass', 'electric', 'psychic', 'ice', 
    'dragon', 'dark', 'fairy', 'normal', 'fighting', 'flying',
    'poison', 'ground', 'rock', 'bug', 'ghost', 'steel'
  ];

  const statSortOptions: Array<{
    id: 'hp' | 'attack' | 'defense' | 'specialAttack' | 'specialDefense' | 'speed';
    label: string;
  }> = [
    { id: 'hp', label: 'HP' },
    { id: 'attack', label: 'ATK' },
    { id: 'defense', label: 'DEF' },
    { id: 'specialAttack', label: 'SP ATK' },
    { id: 'specialDefense', label: 'SP DEF' },
    { id: 'speed', label: 'SPEED' },
  ];

  // Infinite scroll observer
  useEffect(() => {
    if (!loadMoreRef.current || !hasMore || loadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          loadMore();
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(loadMoreRef.current);

    return () => observer.disconnect();
  }, [hasMore, loadingMore, loadMore]);

  const filteredAndSortedPokemon = useMemo(() => {
    let result = [...pokemonData];

    // Filter by region (from URL params)
    if (regionStart && regionEnd) {
      const start = parseInt(regionStart);
      const end = parseInt(regionEnd);
      result = result.filter((p) => {
        const dexId = p.pokedexId ?? p.id;
        return dexId >= start && dexId <= end;
      });
    }

    // Filter by search
    if (searchQuery) {
      result = result.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by type
    if (selectedType !== 'all') {
      result = result.filter((p) => p.types.includes(selectedType));
    }

    // Sort
    result.sort((a, b) => {
      const direction = sortDirection === 'asc' ? 1 : -1;

      if (sortBy === 'name') {
        return a.name.localeCompare(b.name) * direction;
      }

      if (sortBy === 'id') {
        const leftDex = a.pokedexId ?? a.id;
        const rightDex = b.pokedexId ?? b.id;
        if (leftDex !== rightDex) {
          return (leftDex - rightDex) * direction;
        }
        return (a.id - b.id) * direction;
      }

      const left = a.stats[sortBy] ?? 0;
      const right = b.stats[sortBy] ?? 0;
      return (left - right) * direction;
    });

    return result;
  }, [pokemonData, searchQuery, selectedType, sortBy, sortDirection, regionStart, regionEnd]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading Pokémon...</p>
          <p className="text-gray-400 text-sm mt-2">Fetching data from all regions</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Filter Modals */}
      <AnimatePresence>
        {showFilterModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[100] flex items-end"
            onClick={() => setShowFilterModal(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
              className="bg-white w-full rounded-t-3xl p-6 max-h-[70vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-bold text-lg mb-4">Select a type</h3>
              <div className="space-y-2">
                <button
                  onClick={() => {
                    setSelectedType('all');
                  }}
                  className={`w-full py-3 px-4 rounded-xl font-medium ${
                    selectedType === 'all'
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  All types
                </button>
                {allTypes.map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      setSelectedType(type);
                    }}
                    style={{ 
                      backgroundColor: selectedType === type ? typeColors[type] : undefined,
                      color: selectedType === type ? 'white' : undefined
                    }}
                    className={`w-full py-3 px-4 rounded-xl font-medium capitalize flex items-center gap-2 ${
                      selectedType === type
                        ? ''
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <div 
                      className="w-6 h-6 rounded-full flex items-center justify-center p-1"
                      style={{ 
                        backgroundColor: selectedType === type ? 'rgba(255,255,255,0.3)' : typeColors[type]
                      }}
                    >
                        <div style={getTypeIconStyle(type, 14)} />
                    </div>
                    {type}
                  </button>
                ))}
              </div>

              <h3 className="font-bold text-lg mb-4 mt-6">Select order</h3>
              <div className="space-y-2">
                <button
                  onClick={() => {
                    setSortBy('id');
                  }}
                  className={`w-full py-3 px-4 rounded-xl font-medium ${
                    sortBy === 'id'
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  Lowest number
                </button>
                <button
                  onClick={() => {
                    setSortBy('name');
                  }}
                  className={`w-full py-3 px-4 rounded-xl font-medium ${
                    sortBy === 'name'
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  A-Z
                </button>

                {statSortOptions.map((stat) => (
                  <button
                    key={stat.id}
                    onClick={() => setSortBy(stat.id)}
                    className={`w-full py-3 px-4 rounded-xl font-medium ${
                      sortBy === stat.id
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    {stat.label}
                  </button>
                ))}
              </div>

              <h3 className="font-bold text-lg mb-4 mt-6">Direction</h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setSortDirection('asc')}
                  className={`py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2 ${
                    sortDirection === 'asc'
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <ArrowUpNarrowWide className="w-4 h-4" />
                  ASC
                </button>
                <button
                  onClick={() => setSortDirection('desc')}
                  className={`py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2 ${
                    sortDirection === 'desc'
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <ArrowDownWideNarrow className="w-4 h-4" />
                  DESC
                </button>
              </div>

              <button
                onClick={async () => {
                  setApplyingFilter(true);
                  try {
                    await ensureGlobalDataLoaded();
                    setShowFilterModal(false);
                  } finally {
                    setApplyingFilter(false);
                  }
                }}
                disabled={applyingFilter}
                className="w-full mt-6 py-3 px-4 rounded-xl font-bold bg-[#DC2626] text-white"
              >
                {applyingFilter || !globalReady ? 'Applying...' : 'Apply'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content area with search */}
      <div className="bg-white">
        {/* Search Bar with Filter Button */}
        <div className="px-4 pt-3 pb-4">
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search Pokemon"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-100 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            {/* Filter Button */}
            <button
              onClick={() => {
                setShowFilterModal(!showFilterModal);
                if (!globalReady) {
                  void ensureGlobalDataLoaded();
                }
              }}
              className="w-12 h-12 bg-gray-900 text-white rounded-xl flex items-center justify-center flex-shrink-0 hover:bg-gray-800 transition-colors"
            >
              <SlidersHorizontal className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Pokemon List */}
      <div className="px-4 pt-4 pb-24">
        <div className="flex flex-col gap-3">
          {filteredAndSortedPokemon.map((pokemon) => (
            <PokemonCard key={pokemon.id} pokemon={pokemon} />
          ))}
        </div>
        
        {/* Infinite Scroll Loader */}
        {hasMore && (
          <div ref={loadMoreRef} className="text-center mt-8">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium">Loading more Pokémon...</p>
          </div>
        )}
      </div>
    </div>
  );
}