import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Heart, Weight, Ruler, Zap, Shield, ChevronLeft, ChevronRight, Dna } from 'lucide-react';
import { useState, useEffect } from 'react';
import { usePokemonById } from '../hooks/usePokemon';
import { fetchPokemonMegaForms, fetchAbilityDescription, MegaFormInfo } from '../services/pokeapi';
import { TypeBadge } from '../components/TypeBadge';
import { StatBar } from '../components/StatBar';
import { motion, AnimatePresence } from 'motion/react';
import { typeColors } from '../utils/typeColors';
import { PokedexHeader } from '../components/PokedexHeader';

// Pokemon Detail Page - Fixed stats structure
export function DetailPage(): JSX.Element {
  const { id } = useParams();
  const navigate = useNavigate();
  const { pokemon, loading, error } = usePokemonById(Number(id));
  const [isFavorite, setIsFavorite] = useState(false);
  const [megaForms, setMegaForms] = useState<MegaFormInfo[]>([]);
  const [loadingMegaForms, setLoadingMegaForms] = useState(false);
  const [selectedAbility, setSelectedAbility] = useState<string | null>(null);
  const [abilityDescription, setAbilityDescription] = useState('');
  const [loadingAbility, setLoadingAbility] = useState(false);

  // Check if pokemon is favorited
  useEffect(() => {
    if (pokemon) {
      const savedIds = localStorage.getItem('favoritePokemon');
      if (savedIds) {
        const ids: number[] = JSON.parse(savedIds);
        setIsFavorite(ids.includes(pokemon.id));
      }
    }
  }, [pokemon]);

  // Load mega forms for this pokemon species
  useEffect(() => {
    if (!pokemon) {
      setMegaForms([]);
      return;
    }

    let cancelled = false;
    setLoadingMegaForms(true);

    fetchPokemonMegaForms(pokemon.id)
      .then((forms) => {
        if (!cancelled) {
          setMegaForms(forms);
        }
      })
      .catch((err) => {
        console.warn('Failed to load mega forms:', err);
        if (!cancelled) {
          setMegaForms([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingMegaForms(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pokemon]);

  const toggleFavorite = () => {
    if (!pokemon) return;

    const savedIds = localStorage.getItem('favoritePokemon');
    let ids: number[] = savedIds ? JSON.parse(savedIds) : [];

    if (isFavorite) {
      ids = ids.filter(favId => favId !== pokemon.id);
    } else {
      ids.push(pokemon.id);
    }

    localStorage.setItem('favoritePokemon', JSON.stringify(ids));
    setIsFavorite(!isFavorite);
  };

  const handleAbilityClick = async (ability: string) => {
    setSelectedAbility(ability);
    setAbilityDescription('');
    setLoadingAbility(true);

    const description = await fetchAbilityDescription(ability);
    setAbilityDescription(description);
    setLoadingAbility(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Pokémon...</p>
        </div>
      </div>
    );
  }

  if (error || !pokemon) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-500 mb-4">Failed to load Pokémon</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg"
          >
            Back to Pokédex
          </button>
        </div>
      </div>
    );
  }

  // Defensive check for stats structure
  if (!pokemon.stats || typeof pokemon.stats !== 'object') {
    console.error('Invalid pokemon stats structure:', pokemon);
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-500 mb-4">Invalid Pokémon data structure</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg"
          >
            Back to Pokédex
          </button>
        </div>
      </div>
    );
  }

  const primaryColor = typeColors[pokemon.types[0]];
  const displayDexId = pokemon.pokedexId ?? pokemon.id;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Pokedex Header with Back and Favorite buttons */}
      <PokedexHeader
        leftButton={
          <button
            onClick={() => navigate('/')}
            className="w-14 h-14 rounded-full bg-white shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-gray-800" />
          </button>
        }
        rightButton={
          <button
            onClick={toggleFavorite}
            className="w-14 h-14 rounded-full bg-white shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors"
          >
            <Heart 
              className={`w-6 h-6 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-800'}`}
            />
          </button>
        }
      />
      
      {/* Pokemon Hero Section with colored background - seamless with header, no gap */}
      <div className="relative -mt-6" style={{ backgroundColor: primaryColor }}>
        {/* Pokemon image area with semi-circle decoration */}
        <div className="relative px-4 pt-12 pb-32">
          {/* Semi-circle decoration - positioned at bottom */}
          <div 
            className="absolute left-1/2 -translate-x-1/2 bottom-16 w-[300px] h-[150px] rounded-t-full" 
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.1)' }} 
          />
          
          {/* Pokemon Image - in colored background area */}
          <div className="relative flex justify-center pt-4 pb-0 z-20">
            <motion.img
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
              src={pokemon.image}
              alt={pokemon.name}
              className="w-56 h-56 object-contain drop-shadow-2xl"
              style={{ imageRendering: 'pixelated' }}
            />
          </div>
        </div>
      </div>

      {/* White rounded container with all info - overlapping colored section */}
      <div className="relative -mt-24 z-30 px-4 pb-6">
        <div className="bg-white rounded-3xl p-6 shadow-xl">
          {/* Pokemon Name */}
          <h1 className="text-3xl font-black text-gray-900 capitalize mb-1">
            {pokemon.name}
          </h1>
          
          {/* Pokemon ID */}
          <p className="text-gray-400 font-bold text-base mb-4">
            #{displayDexId.toString().padStart(3, '0')}
          </p>

          {/* Types */}
          <div className="flex gap-2 mb-6">
            {pokemon.types.map((type) => (
              <TypeBadge key={type} type={type} />
            ))}
          </div>

          {/* Description - in the same card */}
          {pokemon.description && (
            <>
              <h2 className="text-lg font-bold text-gray-900 mb-3">Description</h2>
              <p className="text-gray-600 leading-relaxed text-sm">
                {pokemon.description}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Info Cards */}
      <div className="px-4 mb-6">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl p-4 shadow-md text-center">
            <Weight className="w-6 h-6 text-gray-500 mx-auto mb-2" />
            <p className="text-xs text-gray-500 mb-1">Weight</p>
            <p className="font-bold text-gray-900">{pokemon.weight / 10} kg</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-md text-center">
            <Ruler className="w-6 h-6 text-gray-500 mx-auto mb-2" />
            <p className="text-xs text-gray-500 mb-1">Height</p>
            <p className="font-bold text-gray-900">{pokemon.height / 10} m</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-md text-center">
            <Dna className="w-6 h-6 text-gray-500 mx-auto mb-2" />
            <p className="text-xs text-gray-500 mb-1">Species</p>
            <p className="font-bold text-gray-900 text-xs">{pokemon.genus}</p>
          </div>
        </div>
      </div>

      {/* Weaknesses */}
      {pokemon.weaknesses && pokemon.weaknesses.length > 0 && (
        <div className="px-4 mb-6">
          <div className="bg-white rounded-3xl p-6 shadow-xl">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Weaknesses</h2>
            <div className="flex flex-wrap gap-2">
              {pokemon.weaknesses.map((weakness, index) => (
                <TypeBadge key={`${weakness.type}-${index}`} type={weakness.type} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="px-4 mb-6">
        <div className="bg-white rounded-3xl p-6 shadow-xl">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            Base Stats
          </h2>
          <div className="space-y-3">
            <StatBar label="HP" value={pokemon.stats.hp} maxValue={255} />
            <StatBar label="Attack" value={pokemon.stats.attack} maxValue={255} />
            <StatBar label="Defense" value={pokemon.stats.defense} maxValue={255} />
            <StatBar label="Sp. Atk" value={pokemon.stats.specialAttack} maxValue={255} />
            <StatBar label="Sp. Def" value={pokemon.stats.specialDefense} maxValue={255} />
            <StatBar label="Speed" value={pokemon.stats.speed} maxValue={255} />
          </div>
          
          {/* Total Stats */}
          <div className="mt-4 pt-4 border-t-2 border-gray-200">
            <div className="flex justify-between items-center">
              <span className="font-bold text-gray-700">Total</span>
              <span className="font-black text-xl text-gray-900">
                {pokemon.stats.hp + pokemon.stats.attack + pokemon.stats.defense + 
                 pokemon.stats.specialAttack + pokemon.stats.specialDefense + pokemon.stats.speed}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Abilities */}
      {pokemon.abilities && pokemon.abilities.length > 0 && (
        <div className="px-4 mb-6">
          <div className="bg-white rounded-3xl p-6 shadow-xl">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-500" />
              Abilities
            </h2>
            <div className="flex flex-wrap gap-2">
              {pokemon.abilities.map((ability, index) => (
                <button
                  key={index}
                  onClick={() => handleAbilityClick(ability)}
                  className="px-4 py-2 bg-gray-100 rounded-full font-semibold text-gray-700 capitalize text-sm hover:bg-gray-200 transition-colors"
                >
                  {ability}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {selectedAbility && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center px-4"
            onClick={() => setSelectedAbility(null)}
          >
            <motion.div
              initial={{ scale: 0.94, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, y: 16 }}
              className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-black text-gray-900 capitalize mb-2">{selectedAbility}</h3>
              <p className="text-xs font-bold uppercase tracking-wide text-blue-500 mb-3">Ability Description</p>

              {loadingAbility ? (
                <div className="py-4 text-gray-500 font-medium">Loading ability info...</div>
              ) : (
                <p className="text-gray-700 leading-relaxed text-sm">{abilityDescription}</p>
              )}

              <button
                onClick={() => setSelectedAbility(null)}
                className="mt-5 w-full bg-blue-500 text-white font-bold py-3 rounded-xl hover:bg-blue-600 transition-colors"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Evolution Chain */}
      {pokemon.evolution && (pokemon.evolution.prev || pokemon.evolution.next) && (
        <div className="px-4 mb-6">
          <div className="bg-white rounded-3xl p-6 shadow-xl">
            <h2 className="text-xl font-bold text-gray-900 mb-6">
              Evolution Chain
            </h2>
            <div className="flex items-center justify-around">
              {/* Previous Evolution */}
              {pokemon.evolution.prev && (
                <>
                  <button
                    onClick={() => navigate(`/pokemon/${pokemon.evolution.prev!.id}`)}
                    className="flex flex-col items-center group"
                  >
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-2 group-hover:bg-gray-200 transition-colors">
                      <img
                        src={pokemon.evolution.prev.image}
                        alt={pokemon.evolution.prev.name}
                        className="w-16 h-16 object-contain"
                        style={{ imageRendering: 'pixelated' }}
                      />
                    </div>
                    <p className="font-semibold text-gray-700 capitalize text-sm">
                      {pokemon.evolution.prev.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      #{pokemon.evolution.prev.id.toString().padStart(3, '0')}
                    </p>
                  </button>
                  <div className="mx-2 text-gray-400 text-xl">→</div>
                </>
              )}

              {/* Current Pokemon */}
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-2 border-2 border-blue-500">
                  <img
                    src={pokemon.image}
                    alt={pokemon.name}
                    className="w-16 h-16 object-contain"
                    style={{ imageRendering: 'pixelated' }}
                  />
                </div>
                <p className="font-bold text-gray-900 capitalize text-sm">
                  {pokemon.name}
                </p>
                <p className="text-xs text-gray-500">
                  #{displayDexId.toString().padStart(3, '0')}
                </p>
              </div>

              {/* Next Evolution */}
              {pokemon.evolution.next && (
                <>
                  <div className="mx-2 text-gray-400 text-xl">→</div>
                  <button
                    onClick={() => navigate(`/pokemon/${pokemon.evolution.next!.id}`)}
                    className="flex flex-col items-center group"
                  >
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-2 group-hover:bg-gray-200 transition-colors">
                      <img
                        src={pokemon.evolution.next.image}
                        alt={pokemon.evolution.next.name}
                        className="w-16 h-16 object-contain"
                        style={{ imageRendering: 'pixelated' }}
                      />
                    </div>
                    <p className="font-semibold text-gray-700 capitalize text-sm">
                      {pokemon.evolution.next.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      #{pokemon.evolution.next.id.toString().padStart(3, '0')}
                    </p>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mega Evolution */}
      {!loadingMegaForms && megaForms.length > 0 && (
        <div className="px-4 mb-6">
          <div className="bg-white rounded-3xl p-6 shadow-xl">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-orange-500" />
              Mega Evolution
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {megaForms.map((megaForm) => (
                <button
                  key={megaForm.id}
                  onClick={() => navigate(`/pokemon/${megaForm.id}`)}
                  className="w-full text-left bg-gray-50 border border-gray-200 rounded-2xl p-4 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={megaForm.image}
                      alt={megaForm.name}
                      className="w-16 h-16 object-contain"
                      style={{ imageRendering: 'pixelated' }}
                    />

                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 text-sm truncate">{megaForm.name}</p>
                      <p className="text-xs text-gray-500">#{(megaForm.pokedexId ?? megaForm.id).toString().padStart(3, '0')}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {megaForm.types.map((type) => (
                          <TypeBadge key={`${megaForm.id}-${type}`} type={type} />
                        ))}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Navigation Buttons - Previous/Next Pokemon */}
      <div className="px-4 pb-24">
        <div className="flex gap-4">
          {/* Previous Pokemon Button */}
          <button
            onClick={() => {
              const prevId = pokemon.id - 1;
              if (prevId >= 1) {
                navigate(`/pokemon/${prevId}`);
              }
            }}
            disabled={pokemon.id <= 1}
            className={`flex-1 bg-white rounded-2xl p-4 shadow-lg flex items-center justify-center gap-3 font-bold transition-all ${
              pokemon.id <= 1
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:shadow-xl hover:scale-105 active:scale-95'
            }`}
          >
            <ChevronLeft className="w-6 h-6" />
            <span>Previous</span>
          </button>

          {/* Next Pokemon Button */}
          <button
            onClick={() => {
              const nextId = pokemon.id + 1;
              navigate(`/pokemon/${nextId}`);
            }}
            className="flex-1 bg-white rounded-2xl p-4 shadow-lg flex items-center justify-center gap-3 font-bold hover:shadow-xl hover:scale-105 active:scale-95 transition-all"
          >
            <span>Next</span>
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
}