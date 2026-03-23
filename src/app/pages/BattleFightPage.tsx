import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, RefreshCw, ArrowLeft } from 'lucide-react';
import { Pokemon } from '../types/pokemon';
import { PokedexHeader } from '../components/PokedexHeader';
import { TypeBadge } from '../components/TypeBadge';
import {
  BattleMove,
  fetchPokemonBattleMoves,
  getTypeEffectivenessMultiplier,
} from '../services/pokeapi';
import {
  applyBattleProgressToCapturedPokemon,
  getPokemonLevel,
  readCapturedPokemonFromStorage,
  withDefaultProgress,
} from '../utils/capturedPokemonProgress';
import { getPlayerBattleXp } from '../utils/expRewards';
import { useAuth } from '../contexts/AuthContext';
import { syncCapturedPokemonToSupabase } from '../utils/supabaseSync';

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

const getEnemyHpMultiplier = (battleMode?: string): number => {
  if (battleMode === 'boss') return 3;
  if (battleMode === 'mega') return 3;
  if (battleMode === 'event') return 2.7;
  return 2.4;
};

export function BattleFightPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [team, setTeam] = useState<CapturedPokemon[] | null>(null);
  const [enemy, setEnemy] = useState<Pokemon | null>(null);
  const [mode, setMode] = useState<string>('normal');
  const [firstAttackBonus, setFirstAttackBonus] = useState<boolean>(false);

  const [currentPokemonIndex, setCurrentPokemonIndex] = useState(0);
  
  // State that depends on team/enemy - initialized with fallback values
  const [playerHP, setPlayerHP] = useState(100);
  const [enemyHP, setEnemyHP] = useState(300);
  const [battlePhase, setBattlePhase] = useState<'player-turn' | 'enemy-turn' | 'complete'>('player-turn');

  const [showDamage, setShowDamage] = useState<{ target: 'player' | 'enemy'; amount: number; type: string } | null>(null);
  const [turnCount, setTurnCount] = useState(0);
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [firstAttackApplied, setFirstAttackApplied] = useState(false);
  const [currentMoveLabel, setCurrentMoveLabel] = useState<string | null>(null);
  const [playerMoves, setPlayerMoves] = useState<BattleMove[]>([]);
  const [enemyMoves, setEnemyMoves] = useState<BattleMove[]>([]);
  const [loadingMoves, setLoadingMoves] = useState(false);
  const [showRunAwayMessage, setShowRunAwayMessage] = useState(false);
  const battleProgressAppliedRef = useRef(false);

  const applyTeamBattleProgress = useCallback(async (didWin: boolean) => {
    if (!team || battleProgressAppliedRef.current) {
      return;
    }

    battleProgressAppliedRef.current = true;
    const progressResult = applyBattleProgressToCapturedPokemon(team, didWin, mode);

    // Persist updated captured pokemon stats (xp/wins/battles_used) to Supabase.
    // Without this, hard refresh can reset to stale DB values.
    if (user) {
      const updatedCaptured = readCapturedPokemonFromStorage<CapturedPokemon>();
      for (const pokemon of updatedCaptured) {
        await syncCapturedPokemonToSupabase(user.id, withDefaultProgress(pokemon as any));
      }
    }

    // Only show level-up popup after completed victory flow.
    if (didWin && progressResult.levelUps.length > 0) {
      sessionStorage.setItem('battlePokemonLevelUps', JSON.stringify(progressResult.levelUps));
    } else {
      sessionStorage.removeItem('battlePokemonLevelUps');
    }
  }, [team, mode, user]);

  // Define all functions BEFORE any useEffect that uses them
  const dealDamage = useCallback((target: 'player' | 'enemy', amount: number, type: string) => {
    if (!team || !enemy) return;

    setShowDamage({ target, amount, type });
    setTimeout(() => setShowDamage(null), 1500);

    if (target === 'enemy') {
      setEnemyHP(prev => {
        const newHP = Math.max(0, prev - amount);
        if (newHP <= 0) {
          setTimeout(() => {
            (async () => {
              // Ensure battle progress reaches cloud before next flow.
              await applyTeamBattleProgress(true);
              navigate('/game/battle/capture', {
                state: { pokemon: enemy, mode }
              });
            })();
          }, 2000);
        }
        return newHP;
      });
    } else {
      setPlayerHP(prev => {
        const newHP = Math.max(0, prev - amount);
        if (newHP <= 0) {
          // Battle lost - switch Pokemon or lose
          if (currentPokemonIndex < team.length - 1) {
            setTimeout(() => {
              const nextPokemon = team[currentPokemonIndex + 1];
              const nextMaxHP = nextPokemon?.stats?.hp || 100;
              setCurrentPokemonIndex(prev => prev + 1);
              setPlayerHP(nextMaxHP);
              setBattlePhase('player-turn');
            }, 2000);
          } else {
            setTimeout(() => {
              (async () => {
                // Ensure battle progress reaches cloud before result page.
                await applyTeamBattleProgress(false);
                navigate('/game/battle/result', {
                  state: {
                    success: false,
                    pokemon: enemy,
                    mode,
                    xpEarned: getPlayerBattleXp(mode, false),
                  }
                });
              })();
            }, 2000);
          }
        }
        return newHP;
      });
    }
  }, [team, enemy, mode, currentPokemonIndex, navigate, applyTeamBattleProgress]);

  const calculateMoveDamage = useCallback(async (
    attacker: Pokemon,
    defender: Pokemon,
    move: BattleMove
  ) => {
    const isPhysical = move.damageClass === 'physical';
    const attackStat = isPhysical ? (attacker.stats?.attack ?? 50) : (attacker.stats?.specialAttack ?? 50);
    const defenseStat = isPhysical ? (defender.stats?.defense ?? 50) : (defender.stats?.specialDefense ?? 50);
    const hp = attacker.stats?.hp ?? 50;
    const attack = attacker.stats?.attack ?? 50;
    const speed = attacker.stats?.speed ?? 50;
    const attackerLevel = Math.max(30, Math.floor((hp + attack + speed) / 6));
    const stab = (attacker.types ?? []).includes(move.type) ? 1.5 : 1;
    const effectiveness = await getTypeEffectivenessMultiplier(move.type, defender.types ?? ['normal']);
    const randomFactor = 0.85 + Math.random() * 0.15;

    const base = (((2 * attackerLevel) / 5 + 2) * (move.power ?? 50) * (attackStat / Math.max(1, defenseStat))) / 50 + 2;
    const rawDamage = Math.floor(base * stab * effectiveness * randomFactor);
    const damage = Math.max(1, rawDamage);

    let effectivenessText = 'Normal hit';
    if (effectiveness === 0) {
      effectivenessText = 'No effect';
    } else if (effectiveness > 1) {
      effectivenessText = 'Super effective';
    } else if (effectiveness < 1) {
      effectivenessText = 'Not very effective';
    }

    return {
      damage,
      effectivenessText,
    };
  }, []);

  const performEnemyAttack = useCallback(async () => {
    if (!team || !enemy || enemyMoves.length === 0) {
      setBattlePhase('player-turn');
      return;
    }

    const attacker = team[currentPokemonIndex];
    if (!attacker) {
      setBattlePhase('player-turn');
      return;
    }

    const move = enemyMoves[Math.floor(Math.random() * enemyMoves.length)];
    const { damage, effectivenessText } = await calculateMoveDamage(enemy, attacker, move);

    setCurrentMoveLabel(`${enemy.name} used ${move.name.replace(/-/g, ' ')}`);
    dealDamage('player', damage, `${effectivenessText}!`);

    setTimeout(() => {
      setBattlePhase('player-turn');
      setTurnCount(prev => prev + 1);
      setCurrentMoveLabel(null);
    }, 2000);
  }, [team, currentPokemonIndex, enemy, enemyMoves, calculateMoveDamage, dealDamage]);

  // Initialize state from location or sessionStorage
  useEffect(() => {
    sessionStorage.removeItem('battlePokemonLevelUps');

    let teamData = location.state?.team as CapturedPokemon[] | undefined;
    let enemyData = location.state?.enemy as Pokemon | undefined;
    let modeData = location.state?.mode as string | undefined;
    let bonusData = location.state?.firstAttackBonus as boolean | undefined;

    // Fallback to sessionStorage
    if (!teamData || !enemyData) {
      const savedTeam = sessionStorage.getItem('battleTeam');
      const savedEnemy = sessionStorage.getItem('battleEnemy');
      const savedMode = sessionStorage.getItem('battleMode');
      const savedBonus = sessionStorage.getItem('firstAttackBonus');
      
      if (savedTeam && savedEnemy) {
        teamData = JSON.parse(savedTeam);
        enemyData = JSON.parse(savedEnemy);
        modeData = savedMode || 'normal';
        bonusData = savedBonus ? JSON.parse(savedBonus) : false;
        console.log('BattleFightPage - Retrieved from sessionStorage');
      }
    }

    console.log('=== BattleFightPage mounted ===');
    console.log('Team:', teamData?.length);
    console.log('Enemy:', enemyData?.name);
    console.log('Mode:', modeData);
    console.log('First attack bonus:', bonusData);

    if (!teamData || !enemyData) {
      console.error('❌ No team or enemy in BattleFightPage');
      console.error('Redirecting back...');
      
      setTimeout(() => {
        navigate('/game/battle', { replace: true });
      }, 100);
      return;
    }

    setTeam(teamData);
    setEnemy(enemyData);
    setMode(modeData || 'normal');
    setFirstAttackBonus(bonusData || false);
    
    // Initialize HP values based on loaded data
    const initialMaxPlayerHP = teamData[0]?.stats?.hp || 100;
    const enemyHpMultiplier = getEnemyHpMultiplier(modeData);
    const initialMaxEnemyHP = Math.round((enemyData?.stats?.hp || 100) * enemyHpMultiplier);
    setPlayerHP(initialMaxPlayerHP);
    setEnemyHP(initialMaxEnemyHP);
  }, [location, navigate]);

  // Enemy Turn
  useEffect(() => {
    if (battlePhase === 'enemy-turn' && enemyHP > 0 && team && enemy) {
      const timer = setTimeout(() => {
        performEnemyAttack();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [battlePhase, enemyHP, team, enemy, performEnemyAttack]);

  // Load battle moves for current player Pokemon and enemy.
  useEffect(() => {
    if (!team || !enemy) {
      return;
    }

    const currentPokemon = team[currentPokemonIndex];
    if (!currentPokemon) {
      return;
    }

    let isCancelled = false;
    const loadMoves = async () => {
      setLoadingMoves(true);
      try {
        const [loadedPlayerMoves, loadedEnemyMoves] = await Promise.all([
          fetchPokemonBattleMoves(currentPokemon.id, currentPokemon.types),
          fetchPokemonBattleMoves(enemy.id, enemy.types),
        ]);

        if (!isCancelled) {
          setPlayerMoves(loadedPlayerMoves);
          setEnemyMoves(loadedEnemyMoves);
        }
      } catch (error) {
        console.error('Failed to load battle moves:', error);
        if (!isCancelled) {
          setPlayerMoves([]);
          setEnemyMoves([]);
        }
      } finally {
        if (!isCancelled) {
          setLoadingMoves(false);
        }
      }
    };

    loadMoves();

    return () => {
      isCancelled = true;
    };
  }, [team, currentPokemonIndex, enemy]);

  // Opening attack flow from coin flip result
  useEffect(() => {
    if (!team || !enemy || firstAttackApplied || team.length === 0) {
      return;
    }

    if (firstAttackBonus) {
      // Player gets first free hit
      if (playerMoves.length === 0) {
        return;
      }

      const attacker = team[currentPokemonIndex];
      if (!attacker) {
        return;
      }

      const timer = setTimeout(async () => {
        const move = playerMoves[Math.floor(Math.random() * playerMoves.length)];
        const { damage, effectivenessText } = await calculateMoveDamage(attacker, enemy, move);
        const boostedDamage = Math.max(1, Math.floor(damage * 1.2));
        setCurrentMoveLabel(`${attacker.name} used ${move.name.replace(/-/g, ' ')} (First Attack Bonus)`);
        dealDamage('enemy', boostedDamage, `${effectivenessText}!`);
        setFirstAttackApplied(true);
        setTimeout(() => {
          setCurrentMoveLabel(null);
        }, 1200);
      }, 500);

      return () => clearTimeout(timer);
    }

    // Enemy goes first if player loses coin flip.
    if (enemyMoves.length > 0) {
      setFirstAttackApplied(true);
      setBattlePhase('enemy-turn');
    }
  }, [firstAttackBonus, team, currentPokemonIndex, enemy, firstAttackApplied, playerMoves, enemyMoves, calculateMoveDamage, dealDamage]);

  // Return early only AFTER all hooks
  if (!team || !enemy) {
    return null;
  }

  // Now it's safe to access team[currentPokemonIndex]
  const currentPokemon = team[currentPokemonIndex];
  const maxPlayerHP = currentPokemon?.stats?.hp || 100;
  const maxEnemyHP = Math.round((enemy?.stats?.hp || 100) * getEnemyHpMultiplier(mode));
  const displayedPlayerHP = Math.min(playerHP, maxPlayerHP);
  const displayedEnemyHP = Math.min(enemyHP, maxEnemyHP);
  const isBattleOngoing = enemyHP > 0 && playerHP > 0;

  const handleBackClick = () => {
    if (!isBattleOngoing || showRunAwayMessage) {
      if (!showRunAwayMessage) {
        navigate('/game/battle');
      }
      return;
    }

    setShowSwitchModal(false);
    setShowRunAwayMessage(true);
    setTimeout(() => {
      navigate('/game/battle');
    }, 1400);
  };

  const handleAttackClick = async () => {
    if (battlePhase !== 'player-turn' || loadingMoves || playerMoves.length === 0) {
      return;
    }

    // Immediately change phase to prevent spam clicking
    setBattlePhase('enemy-turn');

    const move = playerMoves[Math.floor(Math.random() * playerMoves.length)];
    const { damage, effectivenessText } = await calculateMoveDamage(currentPokemon, enemy, move);

    setCurrentMoveLabel(`${currentPokemon.name} used ${move.name.replace(/-/g, ' ')}`);
    dealDamage('enemy', damage, `${effectivenessText}!`);

    setTimeout(() => {
      setCurrentMoveLabel(null);
    }, 1500);
  };

  return (
    <div className="min-h-screen pb-20 bg-[linear-gradient(180deg,#73dee3_0%,#b9e4db_35%,#b3e073_58%,#68d7bb_74%,#48ae4e_100%)] flex flex-col">
      {/* Pokedex Header */}
      <PokedexHeader
        leftButton={
          <button
            onClick={handleBackClick}
            className="w-14 h-14 rounded-full bg-white shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-gray-800" />
          </button>
        }
      />

      <div className="w-full px-4 pt-4">
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#f5f3de] border-2 border-[#f25353] shadow-[0_3px_0_#2d2a43]">
            <span className="text-[10px] font-black tracking-[0.14em] text-[#b74d35] uppercase">Battle</span>
            <div className="w-px h-4 bg-[#d4cfbb]" />
            <span className="text-xs font-black text-[#1f1e2d]">Turn {turnCount + 1}</span>
          </div>
        </div>
      {/* Retro Battle Scene */}
      <div className="relative flex-1 min-h-[395px] rounded-2xl overflow-hidden mt-2">
          

          {/* Battle circles */}
          <div className="absolute top-[92px] right-[26px] w-44 h-16 rounded-full bg-[#52b95a] shadow-[0_6px_0_rgba(47,105,50,0.75)]" />
          <div className="absolute bottom-[34px] left-[10px] w-56 h-20 rounded-full bg-[#61bd5f] shadow-[0_6px_0_rgba(47,105,50,0.75)]" />

          {/* Enemy Status Panel */}
          <div className="absolute top-4 left-4 z-20 w-[58%] max-w-[250px] bg-[#f5f3de] rounded-sm px-3 py-2 shadow-[4px_4px_0_#2d2a43]">
            <div className="flex items-center justify-between mb-1 text-[#1f1e2d]">
              <p className="font-black fs-1 capitalize truncate pr-2" style={{ fontFamily: 'PKMN RBYGSC, monospace' }}>{enemy.name}</p>
              <p className="font-black text-xs">Lv {getPokemonLevel(enemy)}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-[#b74d35]">HP</span>
              <div className="h-3 flex-1 bg-[#c2bca4] rounded-sm overflow-hidden">
                <motion.div
                  initial={{ width: '100%' }}
                  animate={{ width: `${(displayedEnemyHP / maxEnemyHP) * 100}%` }}
                  className="h-full bg-[#5fcc73]"
                  transition={{ duration: 0.4 }}
                />
              </div>
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-[11px] font-bold text-[#2d2a43]">{displayedEnemyHP}/{maxEnemyHP}</p>
              <div className="flex gap-1 flex-wrap justify-end">
                {enemy.types.map((type) => (
                  <TypeBadge key={type} type={type} size="xs" />
                ))}
              </div>
            </div>
          </div>

          {/* Enemy Sprite */}
          <motion.div
            animate={{ y: battlePhase === 'enemy-turn' ? [0, -6, 0] : 0, scale: showDamage?.target === 'enemy' ? 0.92 : 1 }}
            transition={{ y: { repeat: Infinity, duration: 1.4 }, scale: { duration: 0.2 } }}
            className="absolute top-[40px] right-[30px] z-10"
          >
            <img
              src={enemy.image}
              alt={enemy.name}
              className="w-28 h-28 sm:w-36 sm:h-36 object-contain drop-shadow-[0_8px_0_rgba(44,41,66,0.55)]"
              style={{ imageRendering: 'pixelated' }}
            />
          </motion.div>

          {/* Player Sprite */}
          <motion.div
            animate={{ y: battlePhase === 'player-turn' ? [0, -8, 0] : 0, scale: showDamage?.target === 'player' ? 0.92 : 1 }}
            transition={{ y: { repeat: Infinity, duration: 1.4 }, scale: { duration: 0.2 } }}
            className="absolute bottom-[38px] left-[24px] z-10"
          >
            <img
              src={currentPokemon.image}
              alt={currentPokemon.name}
              className="w-32 h-32 sm:w-40 sm:h-40 object-contain drop-shadow-[0_8px_0_rgba(44,41,66,0.55)]"
              style={{ imageRendering: 'pixelated' }}
            />
          </motion.div>

          {/* Player Status Panel */}
          <div className="absolute bottom-4 right-4 z-20 w-[62%] max-w-[280px] bg-[#f5f3de] rounded-sm px-3 py-2 shadow-[4px_4px_0_#2d2a43]">
            <div className="flex items-center justify-between mb-1 text-[#1f1e2d]">
              <p className="font-black text-sm capitalize truncate pr-2" style={{ fontFamily: 'PKMN RBYGSC, monospace' }}>{currentPokemon.name}</p>
              <p className="font-black text-xs">Lv {getPokemonLevel(currentPokemon)}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-[#b74d35]">HP</span>
              <div className="h-3 flex-1 bg-[#c2bca4] rounded-sm overflow-hidden">
                <motion.div
                  initial={{ width: '100%' }}
                  animate={{ width: `${(displayedPlayerHP / maxPlayerHP) * 100}%` }}
                  className="h-full bg-[#5fcc73]"
                  transition={{ duration: 0.4 }}
                />
              </div>
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-[11px] font-bold text-[#2d2a43]">{displayedPlayerHP}/{maxPlayerHP}</p>
              <div className="flex gap-1 flex-wrap justify-end">
                {currentPokemon.types.map((type) => (
                  <TypeBadge key={type} type={type} size="xs" />
                ))}
              </div>
            </div>
          </div>

          {/* Damage Numbers */}
          <AnimatePresence>
            {showDamage && (
              <motion.div
                initial={{ scale: 0, y: 0 }}
                animate={{ scale: 1.2, y: -36 }}
                exit={{ opacity: 0, scale: 0.7 }}
                className={`absolute ${showDamage.target === 'enemy' ? 'right-16 top-28' : 'left-16 bottom-28'} z-30`}
              >
                <div className="text-4xl font-black text-[#ffd24d]" style={{ textShadow: '0 0 12px rgba(0,0,0,0.45)' }}>
                  -{showDamage.amount}
                </div>
                <div className="text-xs font-bold text-[#1f1e2d] text-center bg-white/80 px-2 py-0.5 rounded">
                  {showDamage.type}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
      </div>

      {/* Retro Command Area */}
      <div className="bg-[#db5b34] rounded-2xl p-1 mt-3">
          <div className="bg-[#4f8f98] rounded-xl p-3 min-h-[70px] flex items-center justify-center">
            <p className="text-white text-lg font-black text-center">
              {currentMoveLabel ?? (battlePhase === 'enemy-turn' ? `Enemy's turn...` : `What will ${currentPokemon.name} do?`)}
            </p>
          </div>
      </div>

      {/* Command Buttons */}
      <div className="grid grid-cols-2 gap-2 mt-3">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleAttackClick}
            disabled={battlePhase !== 'player-turn' || loadingMoves || playerMoves.length === 0 || showRunAwayMessage}
            className="bg-[#f08f4f] text-white font-black py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Zap className="w-5 h-5" />
            <span>{loadingMoves ? 'Loading...' : 'FIGHT'}</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowSwitchModal(true)}
            disabled={battlePhase !== 'player-turn' || team.length <= 1 || showRunAwayMessage}
            className="bg-[#5d8ed8] text-white font-black py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            <span>POKEMON</span>
          </motion.button>
      </div>

     
      </div>

      {/* Switch Pokemon Modal */}
      <AnimatePresence>
        {showSwitchModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
            onClick={() => setShowSwitchModal(false)}
          >
            <motion.div
              initial={{ scale: 0.8, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 50 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto"
            >
              <h2 className="text-2xl font-black text-gray-900 mb-4">Switch Pokémon</h2>
              
              <div className="space-y-3">
                {team.map((pokemon, index) => {
                  const isCurrentPokemon = index === currentPokemonIndex;
                  const isFainted = index < currentPokemonIndex;
                  
                  return (
                    <button
                      key={index}
                      onClick={() => {
                        if (!isCurrentPokemon && !isFainted) {
                          const newPokemon = team[index];
                          const newMaxHP = newPokemon?.stats?.hp || 100;
                          setCurrentPokemonIndex(index);
                          setPlayerHP(newMaxHP);
                          setShowSwitchModal(false);
                          // Enemy attacks after switching
                          setTimeout(() => {
                            setBattlePhase('enemy-turn');
                          }, 1000);
                        }
                      }}
                      disabled={isCurrentPokemon || isFainted}
                      className={`w-full p-4 rounded-2xl transition-all flex items-center gap-4 ${
                        isCurrentPokemon
                          ? 'bg-blue-100 border-2 border-blue-500'
                          : isFainted
                          ? 'bg-gray-100 opacity-50 cursor-not-allowed'
                          : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent hover:border-blue-300'
                      }`}
                    >
                      <img
                        src={pokemon.image}
                        alt={pokemon.name}
                        className={`w-16 h-16 object-contain ${isFainted ? 'grayscale' : ''}`}
                        style={{ imageRendering: 'pixelated' }}
                      />
                      <div className="flex-1 text-left">
                        <h3 className="font-bold text-gray-900 capitalize" style={{ fontFamily: 'PKMN RBYGSC, monospace' }}>
                          {pokemon.name}
                        </h3>
                        <p className="text-sm text-gray-600">
                          Lv. {getPokemonLevel(pokemon)}
                        </p>
                        {isCurrentPokemon && (
                          <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded-full font-bold">
                            ACTIVE
                          </span>
                        )}
                        {isFainted && (
                          <span className="text-xs bg-gray-400 text-white px-2 py-1 rounded-full font-bold">
                            FAINTED
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setShowSwitchModal(false)}
                className="w-full mt-4 bg-gray-200 text-gray-800 font-bold py-3 rounded-2xl hover:bg-gray-300 transition-all"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRunAwayMessage && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="fixed left-1/2 -translate-x-1/2 bottom-28 w-[min(90vw,330px)] z-50 pointer-events-none"
          >
            <div className="bg-[#f8f8f8] border-[3px] border-[#2d2a43] p-1.5 shadow-[4px_4px_0_#2d2a43]">
              <div className="bg-white border-2 border-[#c9ccd4] px-3 py-4 text-left text-[#2a2a2a] tracking-wide leading-snug text-[17px] sm:text-[18px]" style={{ fontFamily: 'PKMN RBYGSC, monospace' }}>
                You got away safely!
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}