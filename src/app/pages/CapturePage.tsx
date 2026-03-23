import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Star, ArrowLeft } from 'lucide-react';
import { Pokemon } from '../types/pokemon';
import { calculatePokemonRarity } from '../services/pokeapi';
import { PokedexHeader } from '../components/PokedexHeader';
import { readCapturedPokemonFromStorage, withDefaultProgress } from '../utils/capturedPokemonProgress';
import { getPlayerCaptureOutcomeXp } from '../utils/expRewards';
import { useAuth } from '../contexts/AuthContext';
import { syncCapturedPokemonToSupabase } from '../utils/supabaseSync';

export function CapturePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  const [pokemon, setPokemon] = useState<Pokemon | null>(null);
  const [mode, setMode] = useState<string>('normal');
  
  const [capturing, setCapturing] = useState(false);
  const [captureSuccess, setCaptureSuccess] = useState<boolean | null>(null);
  const [meterValue, setMeterValue] = useState(0);
  const [meterDirection, setMeterDirection] = useState<'up' | 'down'>('up');
  const [captureAttempted, setCaptureAttempted] = useState(false);
  const [rarity, setRarity] = useState(1);

  // Calculate capture probability based on mode
  const baseProbability = mode === 'normal' ? 0.7 : (mode === 'boss' || mode === 'mega') ? 0.3 : 0.5;
  const successZoneStart = 40;
  const successZoneEnd = 60;

  // Initialize state from location or sessionStorage
  useEffect(() => {
    let pokemonData = location.state?.pokemon as Pokemon | undefined;
    let modeData = location.state?.mode as string | undefined;

    // Fallback to sessionStorage
    if (!pokemonData) {
      const savedEnemy = sessionStorage.getItem('battleEnemy');
      const savedMode = sessionStorage.getItem('battleMode');
      
      if (savedEnemy) {
        pokemonData = JSON.parse(savedEnemy);
        modeData = savedMode || 'normal';
        console.log('CapturePage - Retrieved from sessionStorage');
      }
    }

    console.log('=== CapturePage mounted ===');
    console.log('Pokemon:', pokemonData?.name);
    console.log('Mode:', modeData);

    if (!pokemonData) {
      console.error('❌ No Pokemon in CapturePage');
      console.error('Redirecting back...');
      
      setTimeout(() => {
        navigate('/game/battle', { replace: true });
      }, 100);
      return;
    }

    setPokemon(pokemonData);
    setMode(modeData || 'normal');
  }, [location, navigate]);

  // Meter animation
  useEffect(() => {
    if (capturing && !captureAttempted && pokemon) {
      const interval = setInterval(() => {
        setMeterValue(prev => {
          if (meterDirection === 'up') {
            if (prev >= 100) {
              setMeterDirection('down');
              return 100;
            }
            return prev + 2;
          } else {
            if (prev <= 0) {
              setMeterDirection('up');
              return 0;
            }
            return prev - 2;
          }
        });
      }, 20);

      return () => clearInterval(interval);
    }
  }, [capturing, captureAttempted, meterDirection, pokemon]);

  // Calculate rarity (1-6 stars) based on Pokemon total stats
  useEffect(() => {
    if (!pokemon) return;
    setRarity(calculatePokemonRarity(pokemon));
  }, [pokemon]);

  // Return early AFTER all hooks
  if (!pokemon) {
    return null;
  }

  const startCapture = () => {
    setCapturing(true);
  };

  const attemptCapture = () => {
    if (captureAttempted) return;
    
    setCaptureAttempted(true);
    
    // Check if meter is in success zone
    const inSuccessZone = meterValue >= successZoneStart && meterValue <= successZoneEnd;
    
    // Calculate final success rate
    const bonusFromTiming = inSuccessZone ? 0.2 : 0;
    const finalProbability = Math.min(0.95, baseProbability + bonusFromTiming);
    
    const success = Math.random() < finalProbability;
    
    setTimeout(async () => {
      if (success) {
        // Save captured Pokemon locally first
        const capturedPokemon = withDefaultProgress({
          ...pokemon,
          rarity,
          capturedAt: new Date().toISOString(),
          mode,
        });

        const captured = readCapturedPokemonFromStorage();
        captured.push(capturedPokemon);
        localStorage.setItem('capturedPokemon', JSON.stringify(captured));

        // Update capture count
        localStorage.setItem('capturedCount', captured.length.toString());

        // Ensure cloud sync is attempted before showing success UI.
        // This reduces risk of data loss when user hard-refreshes immediately.
        if (user) {
          await syncCapturedPokemonToSupabase(user.id, capturedPokemon)
            .catch((e) => console.warn('Failed to sync pokemon to Supabase:', e));
        }
      }

      setCaptureSuccess(success);
    }, 1500);
  };

  const handleContinue = () => {
    if (captureSuccess) {
      navigate('/game/battle/result', {
        state: {
          success: true,
          pokemon,
          rarity,
          mode,
          xpEarned: getPlayerCaptureOutcomeXp(mode, true),
        }
      });
    } else {
      navigate('/game/battle/result', {
        state: {
          success: false,
          pokemon,
          mode,
          xpEarned: getPlayerCaptureOutcomeXp(mode, false),
        }
      });
    }
  };

  return (
    <div className="min-h-screen pb-20 bg-[linear-gradient(180deg,#73dee3_0%,#b9e4db_35%,#b3e073_58%,#68d7bb_74%,#48ae4e_100%)] flex flex-col">
      <PokedexHeader
        leftButton={
          <button
            onClick={() => navigate('/game/battle/fight')}
            className="w-14 h-14 rounded-full bg-white shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-gray-800" />
          </button>
        }
      />

      <div className="w-full px-4 pt-4">
      <div className="max-w-md w-full mx-auto">
        {/* Capture Animation */}
        <AnimatePresence mode="wait">
          {!captureSuccess && captureSuccess !== false && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="text-center"
            >
              {/* Pokemon */}
              <motion.div
                animate={{ 
                  scale: capturing ? [1, 1.1, 1] : 1,
                  rotate: capturing ? [0, -5, 5, 0] : 0,
                }}
                transition={{ 
                  repeat: capturing ? Infinity : 0,
                  duration: 2,
                }}
                className="mb-8"
              >
                <img
                  src={pokemon.image}
                  alt={pokemon.name}
                  className="w-48 h-48 object-contain mx-auto drop-shadow-2xl"
                  style={{ imageRendering: 'pixelated' }}
                />
              </motion.div>

              {/* Pokemon Info */}
              <div className="bg-[#f5f3de] border-2 border-[#2d2a43] rounded-3xl p-6 shadow-xl mb-6">
                <h2 className="text-3xl font-black text-[#1f1e2d] capitalize mb-2">
                  {pokemon.name}
                </h2>
                <p className="text-[#4a5467] mb-4">
                  A wild Pokémon appeared!
                </p>

                {/* Probability Indicator */}
                <div className="bg-white rounded-2xl border border-[#cfd4d9] p-4 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-[#4a5467]">
                      Capture Rate
                    </span>
                    <span className="text-lg font-black text-green-600">
                      {Math.round(baseProbability * 100)}%
                    </span>
                  </div>
                  <div className="h-2 bg-gray-300 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[#4bb860]"
                      style={{ width: `${baseProbability * 100}%` }}
                    />
                  </div>
                </div>

                {/* Capture Meter */}
                {capturing && !captureAttempted && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-[#4a5467]">
                        Timing Meter
                      </span>
                      <Star className="w-5 h-5 text-[#DC2626]" />
                    </div>
                    
                    {/* Meter Container */}
                    <div className="relative h-12 bg-gray-300 rounded-2xl overflow-hidden">
                      {/* Success Zone */}
                      <div 
                        className="absolute h-full bg-green-400/50"
                        style={{ 
                          left: `${successZoneStart}%`,
                          width: `${successZoneEnd - successZoneStart}%`,
                        }}
                      />
                      
                      {/* Moving Indicator */}
                      <motion.div
                        className="absolute top-0 bottom-0 w-2 bg-[#DC2626]"
                        style={{ left: `${meterValue}%` }}
                      />
                    </div>
                    
                    <p className="text-xs text-[#4a5467] mt-2">
                      Tap when the line is in the green zone for bonus chance!
                    </p>
                  </motion.div>
                )}

                {/* Capture Button */}
                {!capturing && (
                  <button
                    onClick={startCapture}
                    className="w-full bg-[#f5f3de] border-2 border-[#2d2a43] text-[#1f1e2d] font-bold py-4 rounded-2xl hover:bg-[#ece8cc] active:scale-95 transition-all"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Star className="w-5 h-5" />
                      <span>Start Capture</span>
                    </div>
                  </button>
                )}

                {/* Attempt Button */}
                {capturing && !captureAttempted && (
                  <button
                    onClick={attemptCapture}
                    className="w-full bg-[#DC2626] text-white font-bold py-4 rounded-2xl hover:bg-[#B91C1C] active:scale-95 transition-all animate-pulse"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Sparkles className="w-5 h-5" />
                      <span>THROW POKÉBALL!</span>
                    </div>
                  </button>
                )}

                {/* Capturing Animation */}
                {captureAttempted && captureSuccess === null && (
                  <div className="text-center py-4">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                      className="w-16 h-16 mx-auto mb-3"
                    >
                      🔴
                    </motion.div>
                    <p className="text-[#4a5467] font-bold">Capturing...</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Success Result */}
          {captureSuccess === true && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <motion.div
                animate={{ 
                  scale: [1, 1.2, 1],
                  rotate: [0, 360],
                }}
                transition={{ duration: 0.6 }}
                className="text-9xl mb-6"
              >
                ✨
              </motion.div>

              <div className="bg-[#f5f3de] border-2 border-[#2d2a43] rounded-3xl p-8 shadow-xl">
                <h2 className="text-4xl font-black text-green-600 mb-4">
                  Captured!
                </h2>
                
                <img
                  src={pokemon.image}
                  alt={pokemon.name}
                  className="w-32 h-32 object-contain mx-auto mb-4"
                  style={{ imageRendering: 'pixelated' }}
                />

                <h3 className="text-2xl font-bold text-[#1f1e2d] capitalize mb-2">
                  {pokemon.name}
                </h3>

                {/* Rarity Stars */}
                <div className="flex justify-center gap-1 mb-6">
                  {Array.from({ length: rarity }).map((_, i) => (
                    <motion.span
                      key={i}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.1 }}
                      className={`text-2xl ${
                        rarity >= 5 ? 'text-yellow-400' : 
                        rarity >= 3 ? 'text-blue-400' : 
                        'text-gray-400'
                      }`}
                    >
                      ★
                    </motion.span>
                  ))}
                </div>

                <button
                  onClick={handleContinue}
                  className="w-full bg-[#f5f3de] border-2 border-[#2d2a43] text-[#1f1e2d] font-bold py-4 rounded-2xl hover:bg-[#ece8cc] transition-all"
                >
                  Continue
                </button>
              </div>
            </motion.div>
          )}

          {/* Failure Result */}
          {captureSuccess === false && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <motion.div
                animate={{ 
                  rotate: [0, -10, 10, -10, 0],
                }}
                transition={{ duration: 0.5 }}
                className="text-9xl mb-6"
              >
                💔
              </motion.div>

              <div className="bg-[#f5f3de] border-2 border-[#2d2a43] rounded-3xl p-8 shadow-xl">
                <h2 className="text-4xl font-black text-red-600 mb-4">
                  Escaped!
                </h2>
                
                <img
                  src={pokemon.image}
                  alt={pokemon.name}
                  className="w-32 h-32 object-contain mx-auto mb-4 opacity-50"
                  style={{ imageRendering: 'pixelated' }}
                />

                <h3 className="text-2xl font-bold text-[#1f1e2d] capitalize mb-2">
                  {pokemon.name}
                </h3>

                <p className="text-[#4a5467] mb-6">
                  The Pokémon broke free and escaped!
                </p>

                <button
                  onClick={handleContinue}
                  className="w-full bg-[#f5f3de] border-2 border-[#2d2a43] text-[#1f1e2d] font-bold py-4 rounded-2xl hover:bg-[#ece8cc] transition-all"
                >
                  Continue
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      </div>
    </div>
  );
}