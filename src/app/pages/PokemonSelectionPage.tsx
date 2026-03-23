import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, Shuffle, Gift, ArrowLeft } from 'lucide-react';
import { Pokemon } from '../types/pokemon';
import { fetchPokemonById, fetchPokemonList, calculatePokemonRarity } from '../services/pokeapi';
import { PokedexHeader } from '../components/PokedexHeader';
import { TypeBadge } from '../components/TypeBadge';
import { typeLightColors } from '../utils/typeColors';
import { getPokemonLevel, getPokemonXpProgress, readCapturedPokemonFromStorage, withDefaultProgress } from '../utils/capturedPokemonProgress';
import { getPokemonPowerTier, getPowerTierBadgeClass } from '../utils/powerTier';

interface CapturedPokemon extends Pokemon {
  rarity: number;
  capturedAt: string;
  mode: string;
  isRented?: boolean;
  capturedId?: string;
  level?: number;
  xp?: number;
  battlesUsed?: number;
  wins?: number;
}

export function PokemonSelectionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const mode = location.state?.mode || 'normal';

  const [collection, setCollection] = useState<CapturedPokemon[]>([]);
  const [selectedSlots, setSelectedSlots] = useState<(CapturedPokemon | null)[]>([null, null, null]);
  const [showCollection, setShowCollection] = useState(false);
  const [selectingSlot, setSelectingSlot] = useState<number | null>(null);
  const [isRenting, setIsRenting] = useState(false);
  const [rentalFormPool, setRentalFormPool] = useState<Pokemon[] | null>(null);

  const getPowerTier = (pokemon: CapturedPokemon) => {
    return getPokemonPowerTier(pokemon);
  };

  useEffect(() => {
    const savedCaptured = readCapturedPokemonFromStorage<CapturedPokemon>();
    if (savedCaptured.length > 0) {
      const ownedCaptured = savedCaptured
        .map((pokemon) => withDefaultProgress(pokemon))
        .filter((pokemon) => pokemon.mode !== 'rental' && !pokemon.isRented);

      // Clean up old buggy rental entries from local storage.
      localStorage.setItem('capturedPokemon', JSON.stringify(ownedCaptured));
      setCollection(ownedCaptured);
      
      // Auto-select first 3 if available
      if (ownedCaptured.length > 0) {
        const autoSelect = [
          ownedCaptured[0] || null,
          ownedCaptured[1] || null,
          ownedCaptured[2] || null,
        ];
        setSelectedSlots(autoSelect);
      }
    } else {
      setCollection([]);
      setSelectedSlots([null, null, null]);
    }
  }, []);

  const handleSlotClick = (slotIndex: number) => {
    if (collection.length === 0) {
      // If no collection, show alert to use rental
      alert('No Pokémon in collection! Use "Rent Random Pokémon" to get starter Pokémon.');
      return;
    }
    setSelectingSlot(slotIndex);
    setShowCollection(true);
  };

  const handlePokemonSelect = (pokemon: CapturedPokemon) => {
    if (selectingSlot !== null) {
      const newSlots = [...selectedSlots];
      newSlots[selectingSlot] = pokemon;
      setSelectedSlots(newSlots);
      setShowCollection(false);
      setSelectingSlot(null);
    }
  };

  const handleRandomize = () => {
    if (collection.length === 0) return;
    
    const shuffled = [...collection].sort(() => Math.random() - 0.5);
    const randomSlots = [
      shuffled[0] || null,
      shuffled[1] || null,
      shuffled[2] || null,
    ];
    setSelectedSlots(randomSlots);
  };

  const handleRentPokemon = async () => {
    setIsRenting(true);

    try {
      let formPool = rentalFormPool;
      if (!formPool) {
        try {
          const allPokemonWithForms = await fetchPokemonList(200, 1, true);
          formPool = allPokemonWithForms.filter((pokemon) => Boolean(pokemon.formName));
          setRentalFormPool(formPool);
        } catch (error) {
          console.warn('Failed to preload form pool for rental:', error);
          formPool = [];
        }
      }

      // Generate 3 random rental Pokemon from all gens (ID 1-898)
      const rentalPokemon: CapturedPokemon[] = [];
      
      for (let i = 0; i < 3; i++) {
        const randomId = Math.floor(Math.random() * 898) + 1; // All gens!
        const data = await fetchPokemonById(randomId);

        const pokemon: CapturedPokemon = {
          ...data,
          rarity: calculatePokemonRarity(data),
          capturedAt: new Date().toISOString(),
          mode: 'rental',
          isRented: true,
        };

        rentalPokemon.push(withDefaultProgress(pokemon));
      }

      // Add form variants into rental pool without removing existing random behavior.
      if (formPool && formPool.length > 0) {
        const slotIndices = [0, 1, 2].sort(() => Math.random() - 0.5);
        const formSlots = Math.random() < 0.7 ? 1 : 2;
        const usedFormIds = new Set<number>();

        for (let i = 0; i < formSlots; i++) {
          const slotIndex = slotIndices[i];
          let attempts = 0;
          let selectedForm: Pokemon | null = null;

          while (attempts < 20 && !selectedForm) {
            const candidate = formPool[Math.floor(Math.random() * formPool.length)];
            if (!candidate || usedFormIds.has(candidate.id)) {
              attempts += 1;
              continue;
            }
            selectedForm = candidate;
          }

          if (!selectedForm) {
            continue;
          }

          usedFormIds.add(selectedForm.id);
          rentalPokemon[slotIndex] = withDefaultProgress({
            ...selectedForm,
            rarity: calculatePokemonRarity(selectedForm),
            capturedAt: new Date().toISOString(),
            mode: 'rental',
            isRented: true,
          });
        }
      }

      console.log('Rental Pokemon generated:', rentalPokemon);

      // Set them to selected slots
      setSelectedSlots(rentalPokemon);
      
      console.log('Selected slots updated with rental Pokemon');
      
      setIsRenting(false);
    } catch (error) {
      console.error('Failed to rent Pokemon:', error);
      alert('Failed to rent Pokemon. Please try again.');
      setIsRenting(false);
    }
  };

  const handleStartBattle = () => {
    // Filter out null values explicitly
    const team: CapturedPokemon[] = [];
    for (const slot of selectedSlots) {
      if (slot !== null) {
        team.push(slot);
      }
    }

    if (team.length === 0) {
      alert('Please select at least one Pokemon!');
      return;
    }

    console.log('=== STARTING BATTLE ===');
    console.log('Team:', team);
    console.log('Team length:', team.length);
    console.log('Mode:', mode);
    console.log('Team details:', team.map(p => ({ name: p.name, id: p.id })));

    // Save to sessionStorage as backup
    sessionStorage.setItem('battleTeam', JSON.stringify(team));
    sessionStorage.setItem('battleMode', mode);

    // Navigate with state
    navigate('/game/battle/encounter', {
      state: { 
        team: team,
        mode: mode 
      }
    });
  };

  const canStart = selectedSlots.some(slot => slot !== null);

  return (
    <div className="min-h-screen pb-20 bg-[linear-gradient(180deg,#73dee3_0%,#b9e4db_35%,#b3e073_58%,#68d7bb_74%,#48ae4e_100%)]">
      <PokedexHeader
        leftButton={
          <button
            onClick={() => navigate('/game/battle')}
            className="w-14 h-14 rounded-full bg-white shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-gray-800" />
          </button>
        }
      />

      <div className="w-full px-4 pt-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-2xl font-black text-[#1f1e2d] mb-2">
            SELECT YOUR POKEMON
          </h1>
          <p className="text-[#1f1e2d] font-semibold">
            Choose up to 3 Pokémon for battle
          </p>
        </motion.div>

        {/* Pokemon Slots */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {selectedSlots.map((pokemon, index) => (
            <motion.button
              key={index}
              onClick={() => handleSlotClick(index)}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`relative bg-[#f5f3de] border-4 rounded-3xl p-4 min-h-[200px] flex flex-col items-center justify-center transition-all ${
                pokemon 
                  ? 'border-yellow-400 shadow-lg shadow-yellow-400/50' 
                  : 'border-[#a7d9ce] border-dashed'
              }`}
              style={pokemon ? { backgroundColor: typeLightColors[pokemon.types[0]] } : undefined}
            >
              {/* Slot Number */}
              <div className="absolute top-2 left-2 min-w-[24px] h-[18px] px-1.5 bg-[#DC2626] rounded-full flex items-center justify-center">
                <span className="text-white text-[9px] font-black leading-none">{index + 1}</span>
              </div>

              {/* Rental Badge */}
              {pokemon?.isRented && (
                <div className="absolute top-2 right-2 bg-[#DC2626] text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                  RENTAL
                </div>
              )}

              {pokemon ? (
                <>
                  <img
                    src={pokemon.image}
                    alt={pokemon.name}
                    className="w-24 h-24 object-contain mb-2"
                    style={{ imageRendering: 'pixelated' }}
                  />
                  <h3 className="text-[#1f1e2d] font-bold capitalize text-sm mb-1">
                    {pokemon.name}
                  </h3>
                  <p className="text-[#1f1e2d] text-xs font-semibold mb-1">
                    Lv. {getPokemonLevel(pokemon)}
                  </p>
                  <div className="w-full mb-2">
                    <div className="h-1.5 w-full bg-white/70 rounded-full overflow-hidden border border-[#d6d2c6]">
                      <div
                        className="h-full bg-[#4f8f98]"
                        style={{ width: `${getPokemonXpProgress(pokemon).progressPercent}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-[#364046] font-semibold mt-0.5 text-center">
                      XP {getPokemonXpProgress(pokemon).currentXp}/{getPokemonXpProgress(pokemon).xpRequired}
                    </p>
                  </div>
                  
                  <div className={`px-2 py-1 rounded-full text-[10px] font-black mb-2 ${getPowerTierBadgeClass(getPowerTier(pokemon))}`}>
                    TIER {getPowerTier(pokemon)}
                  </div>

                  {/* Type Badge */}
                  <div className={`w-full flex items-center ${pokemon.types.length > 1 ? 'flex-col gap-1' : 'justify-center'}`}>
                    {pokemon.types.map(type => (
                      <TypeBadge key={type} type={type} size="sm" />
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-[#5b6666] text-center">
                  <div className="text-5xl mb-2">+</div>
                  <p className="text-xs">Tap to choose Pokemon</p>
                </div>
              )}
            </motion.button>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 mb-6">
          <button
            onClick={handleRandomize}
            disabled={collection.length === 0}
            className="w-full bg-[#f5f3de] border-2 border-[#2d2a43] text-[#1f1e2d] font-bold py-4 rounded-2xl hover:bg-[#ece8cc] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            <Shuffle className="w-5 h-5" />
            <span>Random Selection</span>
          </button>

          <button
            onClick={handleRentPokemon}
            disabled={isRenting}
            className="w-full bg-[#f5f3de] border-2 border-[#2d2a43] text-[#1f1e2d] font-bold py-4 rounded-2xl hover:bg-[#ece8cc] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            <Gift className="w-5 h-5" />
            <span >{isRenting ? 'Loading Rental Pokemon...' : 'Rent Random Pokémon'}</span>
          </button>

          <motion.button
            onClick={handleStartBattle}
            disabled={!canStart}
            whileHover={canStart ? { scale: 1.02 } : {}}
            whileTap={canStart ? { scale: 0.98 } : {}}
            className={`w-full font-black py-6 rounded-2xl shadow-2xl transition-all flex items-center justify-center gap-2 ${
              canStart
                ? 'bg-[#f5f3de] border-2 border-[#2d2a43] text-[#1f1e2d] hover:bg-[#ece8cc]'
                : 'bg-gray-400 text-gray-200 cursor-not-allowed'
            }`}
          >
            <span style={{ fontFamily: 'PKMN RBYGSC, monospace' }}>START BATTLE</span>
            <ChevronRight className="w-6 h-6" />
          </motion.button>
        </div>

        {/* Collection Info */}
        <div className="bg-[#f5f3de] border-2 border-[#2d2a43] rounded-2xl p-4 text-center">
          <p className="text-[#1f1e2d] text-sm">
            Collection: <span className="font-bold text-[#1f1e2d]">{collection.length}</span> Pokémon
          </p>
          {collection.length === 0 && (
            <div className="mt-3 bg-yellow-400/20 border-2 border-yellow-400 rounded-xl p-3">
              <div className="flex items-start gap-2">
                <div className="text-2xl">💡</div>
                <div className="text-left">
                  <h4 className="font-bold text-dark-300 text-sm mb-1">First Time?</h4>
                  <p className="text-dark-100 text-xs" >
                    Don't have Pokémon yet? Use <strong>"Rent Random Pokémon"</strong> to get 3 starter Pokémon for free! Win battles to catch and build your own collection.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Collection Modal */}
        <AnimatePresence>
          {showCollection && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
              onClick={() => {
                setShowCollection(false);
                setSelectingSlot(null);
              }}
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-[#f5f3de] border-2 border-[#2d2a43] rounded-3xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
              >
                <h2 className="text-2xl font-black text-[#1f1e2d] mb-4 text-center">
                  SELECT POKÉMON FOR SLOT {selectingSlot !== null ? selectingSlot + 1 : ''}
                </h2>

                <div className="grid grid-cols-3 gap-3">
                  {collection.map((pokemon, index) => (
                    <motion.button
                      key={index}
                      onClick={() => handlePokemonSelect(pokemon)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="bg-white border-2 border-[#2d2a43] rounded-2xl p-3 hover:border-[#DC2626] transition-all"
                    >
                      <img
                        src={pokemon.image}
                        alt={pokemon.name}
                        className="w-16 h-16 object-contain mx-auto mb-2"
                        style={{ imageRendering: 'pixelated' }}
                      />
                      <p className="text-[#1f1e2d] text-xs font-bold capitalize truncate">
                        {pokemon.name}
                      </p>
                      <p className="text-[#1f1e2d] text-xs font-semibold mb-1">
                        Lv. {getPokemonLevel(pokemon)}
                      </p>
                      <div className="w-full mb-1">
                        <div className="h-1.5 w-full bg-[#e5e2d7] rounded-full overflow-hidden border border-[#d6d2c6]">
                          <div
                            className="h-full bg-[#4f8f98]"
                            style={{ width: `${getPokemonXpProgress(pokemon).progressPercent}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-[#364046] font-semibold mt-0.5">
                          XP {getPokemonXpProgress(pokemon).currentXp}/{getPokemonXpProgress(pokemon).xpRequired}
                        </p>
                      </div>
                      <div className="flex justify-center gap-0.5 mt-1">
                        <div className={`px-2 py-1 rounded-full text-[10px] font-black ${getPowerTierBadgeClass(getPowerTier(pokemon))}`}>
                          TIER {getPowerTier(pokemon)}
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>

                <button
                  onClick={() => {
                    setShowCollection(false);
                    setSelectingSlot(null);
                  }}
                  className="w-full mt-4 bg-[#DC2626] text-white font-bold py-3 rounded-xl hover:bg-[#B91C1C] transition-all"
                >
                  Cancel
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}