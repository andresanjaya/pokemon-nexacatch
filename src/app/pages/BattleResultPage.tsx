import { useNavigate, useLocation } from 'react-router';
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Star, Zap, RotateCcw, Home, ArrowLeft } from 'lucide-react';
import { Pokemon } from '../types/pokemon';
import { applyXpGain } from '../utils/playerProgress';
import { calculatePokemonRarity, fetchRandomPokemon } from '../services/pokeapi';
import { PokedexHeader } from '../components/PokedexHeader';
import { readCapturedPokemonFromStorage, withDefaultProgress } from '../utils/capturedPokemonProgress';
import { useAuth } from '../contexts/AuthContext';
import { syncCapturedPokemonToSupabase, syncPlayerProgressToSupabase } from '../utils/supabaseSync';

export function BattleResultPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [levelUps, setLevelUps] = useState(0);
  const [levelUpRewards, setLevelUpRewards] = useState<Pokemon[]>([]);
  const [currentRewardIndex, setCurrentRewardIndex] = useState(0);
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [pokemonLevelUps, setPokemonLevelUps] = useState<Array<{ name: string; fromLevel: number; toLevel: number }>>([]);
  const [showPokemonLevelUpModal, setShowPokemonLevelUpModal] = useState(false);
  const progressAppliedRef = useRef(false);
  
  // Get state data
  const success = location.state?.success as boolean | undefined;
  const pokemon = location.state?.pokemon as Pokemon | undefined;
  const rarity = location.state?.rarity as number | undefined;
  const mode = location.state?.mode as string | undefined;
  const xpEarned = location.state?.xpEarned as number | undefined;

  const getTotalStats = (candidate: Pokemon): number => {
    return (
      (candidate.stats.hp || 0) +
      (candidate.stats.attack || 0) +
      (candidate.stats.defense || 0) +
      (candidate.stats.specialAttack || 0) +
      (candidate.stats.specialDefense || 0) +
      (candidate.stats.speed || 0)
    );
  };

  const pickLevelRewardPokemon = async (targetLevel: number): Promise<Pokemon | null> => {
    const sampleSize = Math.min(16, 8 + Math.floor(targetLevel / 2));
    const pool = await fetchRandomPokemon(sampleSize);

    if (pool.length === 0) {
      return null;
    }

    const sortedByStats = [...pool].sort((a, b) => getTotalStats(b) - getTotalStats(a));

    let topPoolRatio = 1;
    if (targetLevel >= 20) {
      topPoolRatio = 0.25;
    } else if (targetLevel >= 15) {
      topPoolRatio = 0.35;
    } else if (targetLevel >= 10) {
      topPoolRatio = 0.5;
    } else if (targetLevel >= 5) {
      topPoolRatio = 0.7;
    }

    const topCount = Math.max(1, Math.floor(sortedByStats.length * topPoolRatio));
    const weightedPool = sortedByStats.slice(0, topCount);
    return weightedPool[Math.floor(Math.random() * weightedPool.length)] ?? null;
  };

  // Check if state exists, otherwise redirect
  useEffect(() => {
    if (!location.state || !pokemon) {
      setIsRedirecting(true);
      const timer = setTimeout(() => {
        navigate('/game/battle');
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [location.state, pokemon, navigate]);

  // Update player level and XP, then generate level-up reward encounters.
  useEffect(() => {
    if (!pokemon || typeof xpEarned !== 'number' || progressAppliedRef.current) return;

    progressAppliedRef.current = true;

    let cancelled = false;

    const updateProgressAndRewards = async () => {
      const currentXP = parseInt(localStorage.getItem('playerXP') || '0');
      const currentLevel = parseInt(localStorage.getItem('playerLevel') || '1');

      const { newLevel, newXp, levelUps: gainedLevels } = applyXpGain(currentLevel, currentXP, xpEarned);

      localStorage.setItem('playerLevel', newLevel.toString());
      localStorage.setItem('playerXP', newXp.toString());
      setLevelUps(gainedLevels);

      // Sync to Supabase if logged in
      if (user) {
        syncPlayerProgressToSupabase(user.id, newLevel, newXp)
          .catch((e) => console.warn('Failed to sync progress to Supabase:', e));
      }

      if (gainedLevels <= 0 || cancelled) {
        return;
      }

      const rewards: Pokemon[] = [];

      for (let i = 0; i < gainedLevels; i += 1) {
        const rewardLevel = currentLevel + i + 1;
        const rewardPokemon = await pickLevelRewardPokemon(rewardLevel);

        if (!rewardPokemon) {
          continue;
        }

        rewards.push(rewardPokemon);
      }

      if (!cancelled && rewards.length > 0) {
        setLevelUpRewards(rewards);
        setCurrentRewardIndex(0);
        setShowRewardModal(true);
      }
    };

    updateProgressAndRewards();

    return () => {
      cancelled = true;
    };
  }, [pokemon, xpEarned]);

  useEffect(() => {
    const levelUpRaw = sessionStorage.getItem('battlePokemonLevelUps');
    if (!levelUpRaw) {
      return;
    }

    try {
      const parsed = JSON.parse(levelUpRaw) as Array<{ name: string; fromLevel: number; toLevel: number }>;
      if (Array.isArray(parsed) && parsed.length > 0) {
        setPokemonLevelUps(parsed);
        setShowPokemonLevelUpModal(true);
      }
    } catch (error) {
      console.error('Failed to parse battlePokemonLevelUps:', error);
    } finally {
      sessionStorage.removeItem('battlePokemonLevelUps');
    }
  }, []);

  const saveCapturedPokemon = async (capturedPokemon: Pokemon, capturedMode: string) => {
    const captured = readCapturedPokemonFromStorage();

    const normalizedCapturedPokemon = withDefaultProgress({
      ...capturedPokemon,
      rarity: calculatePokemonRarity(capturedPokemon),
      capturedAt: new Date().toISOString(),
      mode: capturedMode,
    });

    captured.push(normalizedCapturedPokemon);

    localStorage.setItem('capturedPokemon', JSON.stringify(captured));
    localStorage.setItem('capturedCount', captured.length.toString());

    if (user) {
      await syncCapturedPokemonToSupabase(user.id, normalizedCapturedPokemon)
        .catch((e) => console.warn('Failed to sync reward pokemon to Supabase:', e));
    }
  };

  const handleCaptureLevelReward = async () => {
    const rewardPokemon = levelUpRewards[currentRewardIndex];
    if (!rewardPokemon) return;

    await saveCapturedPokemon(rewardPokemon, 'level-reward');

    if (currentRewardIndex >= levelUpRewards.length - 1) {
      setShowRewardModal(false);
      return;
    }

    setCurrentRewardIndex((prev) => prev + 1);
  };

  const handleSkipLevelReward = () => {
    if (currentRewardIndex >= levelUpRewards.length - 1) {
      setShowRewardModal(false);
      return;
    }

    setCurrentRewardIndex((prev) => prev + 1);
  };

  // Show nothing while redirecting - EARLY RETURN AFTER ALL HOOKS
  if (isRedirecting || !pokemon) {
    return null;
  }
  
  return (
    <div className="min-h-screen pb-20 bg-[linear-gradient(180deg,#73dee3_0%,#b9e4db_35%,#b3e073_58%,#68d7bb_74%,#48ae4e_100%)] flex flex-col">
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
      <div className="max-w-md w-full mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-[#f5f3de] border-2 border-[#2d2a43] rounded-3xl p-8 shadow-xl"
        >
          {/* Header */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="text-center mb-6"
          >
            <div className="text-8xl mb-4">
              {success ? '🎉' : '😢'}
            </div>
            <h1 className={`text-4xl font-black mb-2 ${
              success ? 'text-green-600' : 'text-[#4a5467]'
            }`}>
              {success ? 'Victory!' : 'Better Luck Next Time'}
            </h1>
          </motion.div>

          {/* Pokemon Card */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className={`rounded-2xl p-6 mb-6 border ${
              success ? 'bg-[#dfe9e4] border-[#c2d2cb]' : 'bg-[#ece9df] border-[#d7d2c3]'
            }`}
          >
            <img
              src={pokemon.image}
              alt={pokemon.name}
              className="w-32 h-32 object-contain mx-auto mb-4"
              style={{ imageRendering: 'pixelated' }}
            />
            
            <h3 className="text-2xl font-bold text-[#1f1e2d] capitalize text-center mb-2">
              {pokemon.name}
            </h3>

            {/* Rarity Stars (if captured) */}
            {success && rarity && (
              <div className="flex justify-center gap-1 mb-4">
                {Array.from({ length: rarity }).map((_, i) => (
                  <motion.span
                    key={i}
                    initial={{ opacity: 0, scale: 0, rotate: -180 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    transition={{ delay: 0.5 + i * 0.1 }}
                    className={`text-3xl ${
                      rarity >= 5 ? 'text-yellow-400' : 
                      rarity >= 3 ? 'text-blue-400' : 
                      'text-gray-400'
                    }`}
                  >
                    ★
                  </motion.span>
                ))}
              </div>
            )}

            {/* Status */}
            <div className="text-center">
              <span className={`inline-block px-4 py-2 rounded-full font-bold text-sm ${
                success 
                  ? 'bg-green-500 text-white' 
                  : 'bg-[#6f7a8d] text-white'
              }`}>
                {success ? 'CAPTURED' : 'ESCAPED'}
              </span>
            </div>
          </motion.div>

          {/* Rewards */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="bg-[#ece9df] border border-[#d7d2c3] rounded-2xl p-6 mb-6"
          >
            <h3 className="font-bold text-[#1f1e2d] mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              Rewards
            </h3>

            <div className="space-y-3">
              {/* XP Reward */}
              <div className="flex items-center justify-between bg-[#f8f7ef] border border-[#d9d4c8] rounded-xl p-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <Zap className="w-5 h-5 text-blue-600" />
                  </div>
                  <span className="font-semibold text-[#1f1e2d]">Experience Points</span>
                </div>
                <span className="font-black text-blue-600 text-lg">
                  +{xpEarned} XP
                </span>
              </div>

              {levelUps > 0 && (
                <div className="flex items-center justify-between bg-[#f8f7ef] border border-[#d9d4c8] rounded-xl p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                      <Trophy className="w-5 h-5 text-yellow-600" />
                    </div>
                    <span className="font-semibold text-[#1f1e2d]">Level Up Reward</span>
                  </div>
                  <span className="font-black text-yellow-600 text-lg">
                    +{levelUps} Reward
                  </span>
                </div>
              )}

              {/* Pokemon Reward (if captured) */}
              {success && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.6 }}
                  className="flex items-center justify-between bg-[#f8f7ef] border border-[#d9d4c8] rounded-xl p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <Star className="w-5 h-5 text-green-600" />
                    </div>
                    <span className="font-semibold text-[#1f1e2d]">New Pokémon</span>
                  </div>
                  <span className="font-black text-green-600 text-lg capitalize">
                    {pokemon.name}
                  </span>
                </motion.div>
              )}

              {/* Mode Bonus */}
              {mode !== 'normal' && (
                <div className="flex items-center justify-between bg-[#f8f7ef] border border-[#d9d4c8] rounded-xl p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                      <Trophy className="w-5 h-5 text-purple-600" />
                    </div>
                    <span className="font-semibold text-[#1f1e2d]">
                      {mode === 'boss' ? 'Boss Bonus' : mode === 'mega' ? 'Mega Bonus' : 'Event Bonus'}
                    </span>
                  </div>
                  <span className="font-black text-purple-600 text-lg">
                    +{mode === 'boss' || mode === 'mega' ? '100' : '50'} XP
                  </span>
                </div>
              )}
            </div>
          </motion.div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <motion.button
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              onClick={() => navigate('/game/battle')}
              className="w-full bg-[#DC2626] text-white font-bold py-4 rounded-2xl hover:bg-[#B91C1C] active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-5 h-5" />
              <span>Battle Again</span>
            </motion.button>

            {success && (
              <motion.button
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6 }}
                onClick={() => navigate('/game/battle/collection')}
                className="w-full bg-[#f5f3de] border-2 border-[#2d2a43] text-[#1f1e2d] font-bold py-4 rounded-2xl hover:bg-[#ece8cc] active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Star className="w-5 h-5" />
                <span>View Collection</span>
              </motion.button>
            )}

            <motion.button
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.7 }}
              onClick={() => navigate('/')}
              className="w-full bg-[#f5f3de] border-2 border-[#2d2a43] text-[#1f1e2d] font-bold py-4 rounded-2xl hover:bg-[#ece8cc] transition-all flex items-center justify-center gap-2"
            >
              <Home className="w-5 h-5" />
              <span>Back to Pokédex</span>
            </motion.button>
          </div>
        </motion.div>
      </div>
      </div>

      {showRewardModal && levelUpRewards[currentRewardIndex] && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-[#f5f3de] border-2 border-[#2d2a43] rounded-3xl p-6 max-w-sm w-full shadow-xl"
          >
            <div className="text-center mb-4">
              <div className="text-4xl mb-2">🎁</div>
              <h2 className="text-2xl font-black text-[#1f1e2d]">Level Up Reward!</h2>
              <p className="text-sm text-[#4a5467]">
                Reward {currentRewardIndex + 1} / {levelUpRewards.length}
              </p>
            </div>

            <div className="bg-[#ece9df] border border-[#d7d2c3] rounded-2xl p-4 mb-4">
              <img
                src={levelUpRewards[currentRewardIndex].image}
                alt={levelUpRewards[currentRewardIndex].name}
                className="w-36 h-36 object-contain mx-auto"
                style={{ imageRendering: 'pixelated' }}
              />
              <h3 className="text-xl font-bold text-center capitalize text-[#1f1e2d] mt-2">
                {levelUpRewards[currentRewardIndex].name}
              </h3>
              <div className="flex justify-center gap-1 mt-2">
                {Array.from({ length: calculatePokemonRarity(levelUpRewards[currentRewardIndex]) }).map((_, i) => (
                  <span key={i} className="text-yellow-400 text-2xl">★</span>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={handleCaptureLevelReward}
                className="w-full bg-[#DC2626] text-white font-bold py-3 rounded-2xl hover:bg-[#B91C1C]"
              >
                Capture Reward
              </button>
              <button
                onClick={handleSkipLevelReward}
                className="w-full bg-[#f5f3de] border-2 border-[#2d2a43] text-[#1f1e2d] font-bold py-3 rounded-2xl hover:bg-[#ece8cc]"
              >
                Skip
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <AnimatePresence>
        {showPokemonLevelUpModal && pokemonLevelUps.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[60]"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 12 }}
              className="bg-[#f5f3de] border-2 border-[#2d2a43] rounded-3xl p-6 max-w-md w-full shadow-xl"
            >
              <div className="text-center mb-4">
                <div className="text-5xl mb-1">⬆️</div>
                <h2 className="text-2xl font-black text-[#1f1e2d]">Level Up!</h2>
                <p className="text-sm text-[#4a5467]">Pokémon kamu bertambah kuat setelah battle.</p>
              </div>

              <div className="space-y-2 mb-5 max-h-[260px] overflow-y-auto pr-1">
                {pokemonLevelUps.map((entry, index) => (
                  <div key={`${entry.name}-${entry.toLevel}-${index}`} className="bg-[#ece9df] border border-[#d7d2c3] rounded-xl px-3 py-2 flex items-center justify-between">
                    <span className="font-bold capitalize text-[#1f1e2d]">{entry.name}</span>
                    <span className="text-sm font-black text-[#b74d35]">Lv {entry.fromLevel} → Lv {entry.toLevel}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setShowPokemonLevelUpModal(false)}
                className="w-full bg-[#DC2626] text-white font-bold py-3 rounded-2xl hover:bg-[#B91C1C]"
              >
                Nice!
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}