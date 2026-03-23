import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { motion } from 'motion/react';
import { Zap, Swords, ArrowLeft } from 'lucide-react';
import { Pokemon } from '../types/pokemon';
import { fetchPokemonById, fetchRandomEventPokemon, fetchRandomLegendaryPokemon, fetchRandomMegaPokemon, fetchRandomAlternateFormPokemon } from '../services/pokeapi';
import { PokedexHeader } from '../components/PokedexHeader';

interface CapturedPokemon extends Pokemon {
  rarity: number;
  capturedAt: string;
  mode: string;
}

export function EnemyEncounterPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [team, setTeam] = useState<CapturedPokemon[] | null>(null);
  const [mode, setMode] = useState<string>('normal');
  const [enemy, setEnemy] = useState<Pokemon | null>(null);
  const [showVS, setShowVS] = useState(false);

  useEffect(() => {
    // Try to get state from location
    let teamData = location.state?.team as CapturedPokemon[] | undefined;
    let modeData = location.state?.mode as string | undefined;

    // Fallback to sessionStorage if location state is missing
    if (!teamData || teamData.length === 0) {
      console.log('Location state missing, checking sessionStorage...');
      const savedTeam = sessionStorage.getItem('battleTeam');
      const savedMode = sessionStorage.getItem('battleMode');
      
      if (savedTeam) {
        teamData = JSON.parse(savedTeam);
        modeData = savedMode || 'normal';
        console.log('Retrieved from sessionStorage:', { teamData, modeData });
      }
    }

    console.log('=== EnemyEncounterPage mounted ===');
    console.log('Location:', location.pathname);
    console.log('Location state:', location.state);
    console.log('Team from state:', teamData);
    console.log('Team length:', teamData?.length);
    console.log('Mode:', modeData);
    
    // Check if we have the required state
    if (!teamData || teamData.length === 0) {
      console.error('❌ No team provided to EnemyEncounterPage');
      console.error('Location state:', location.state);
      console.error('SessionStorage battleTeam:', sessionStorage.getItem('battleTeam'));
      console.error('Redirecting back to battle select...');
      
      // Use setTimeout to avoid state update during render
      setTimeout(() => {
        navigate('/game/battle', { replace: true });
      }, 100);
      return;
    }

    // Set state
    setTeam(teamData);
    setMode(modeData || 'normal');

    console.log('✅ Team validated, fetching enemy...');

    // Fetch random enemy Pokemon
    const fetchEnemy = async () => {
      try {
        let enemyPokemon: Pokemon;

        if (modeData === 'boss') {
          console.log('Boss mode: fetching only API-flagged legendary/mythical enemy');
          enemyPokemon = await fetchRandomLegendaryPokemon();

          // Make boss fights harder with stronger stats.
          enemyPokemon = {
            ...enemyPokemon,
            stats: {
              ...enemyPokemon.stats,
              hp: Math.floor(enemyPokemon.stats.hp * 1.3),
              attack: Math.floor(enemyPokemon.stats.attack * 1.1),
              defense: Math.floor(enemyPokemon.stats.defense * 1.1),
              specialAttack: Math.floor(enemyPokemon.stats.specialAttack * 1.1),
              specialDefense: Math.floor(enemyPokemon.stats.specialDefense * 1.1),
              speed: Math.floor(enemyPokemon.stats.speed * 1),
            },
          };
        } else if (modeData === 'event') {
          console.log('Shiny Hunt mode: fetching shiny enemy');
          enemyPokemon = await fetchRandomEventPokemon();

          // Event should feel harder than normal, but still below boss fights.
          enemyPokemon = {
            ...enemyPokemon,
            stats: {
              ...enemyPokemon.stats,
              hp: Math.floor(enemyPokemon.stats.hp * 1.18),
              attack: Math.floor(enemyPokemon.stats.attack * 1.07),
              defense: Math.floor(enemyPokemon.stats.defense * 1.07),
              specialAttack: Math.floor(enemyPokemon.stats.specialAttack * 1.07),
              specialDefense: Math.floor(enemyPokemon.stats.specialDefense * 1.07),
              speed: Math.floor(enemyPokemon.stats.speed * 1.03),
            },
          };
        } else if (modeData === 'mega') {
          console.log('Mega Raid mode: fetching mega evolution enemy');
          enemyPokemon = await fetchRandomMegaPokemon();

          // Mega mode should feel as hard as boss battles.
          enemyPokemon = {
            ...enemyPokemon,
            stats: {
              ...enemyPokemon.stats,
              hp: Math.floor(enemyPokemon.stats.hp * 1.3),
              attack: Math.floor(enemyPokemon.stats.attack * 1.1),
              defense: Math.floor(enemyPokemon.stats.defense * 1.1),
              specialAttack: Math.floor(enemyPokemon.stats.specialAttack * 1.1),
              specialDefense: Math.floor(enemyPokemon.stats.specialDefense * 1.1),
              speed: Math.floor(enemyPokemon.stats.speed * 1),
            },
          };
        } else {
          const shouldUseAlternateForm = Math.random() < 0.12;

          if (shouldUseAlternateForm) {
            try {
              enemyPokemon = await fetchRandomAlternateFormPokemon();
            } catch {
              const randomId = Math.floor(Math.random() * 898) + 1;
              enemyPokemon = await fetchPokemonById(randomId);
            }
          } else {
            const randomId = Math.floor(Math.random() * 898) + 1;
            enemyPokemon = await fetchPokemonById(randomId);
          }
        }

        console.log('✅ Enemy Pokemon fetched:', enemyPokemon.name);
        setEnemy(enemyPokemon);
        
        // Show VS after delay
        setTimeout(() => {
          console.log('Showing VS screen');
          setShowVS(true);
        }, 1500);
        
        // Auto proceed to first attack chance
        setTimeout(() => {
          console.log('Navigating to first-attack with team:', teamData!.length, 'Pokemon');
          
          // Save to sessionStorage before navigating
          sessionStorage.setItem('battleTeam', JSON.stringify(teamData));
          sessionStorage.setItem('battleEnemy', JSON.stringify(enemyPokemon));
          sessionStorage.setItem('battleMode', modeData || 'normal');
          
          navigate('/game/battle/first-attack', {
            state: { team: teamData, enemy: enemyPokemon, mode: modeData }
          });
        }, 3500);
      } catch (error) {
        console.error('Failed to fetch enemy:', error);
        navigate('/game/battle');
      }
    };

    fetchEnemy();
  }, [location, navigate]);

  if (!team || !enemy) {
    return (
      <div className="min-h-screen pb-20 bg-[linear-gradient(180deg,#1f2a44_0%,#1c3a56_40%,#2f7b7e_100%)] relative overflow-hidden flex items-center justify-center">
        <div className="absolute -top-16 -left-10 w-56 h-56 rounded-full bg-[#5fd0d6]/20 blur-2xl" />
        <div className="absolute -bottom-20 -right-8 w-64 h-64 rounded-full bg-[#f9d35b]/20 blur-2xl" />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 w-[86%] max-w-sm rounded-3xl border-2 border-[#9bd2c4]/40 bg-[#0d1f31]/70 backdrop-blur-md p-6 shadow-2xl"
        >
          <div className="flex items-center justify-center mb-5">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.4, ease: 'linear' }}
              className="relative w-16 h-16"
            >
              <div className="absolute inset-0 rounded-full bg-white border-4 border-[#1b2839] overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-1/2 bg-[#d93636]" />
                <div className="absolute inset-x-0 top-1/2 h-[4px] -translate-y-1/2 bg-[#1b2839]" />
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white border-4 border-[#1b2839]" />
              </div>
            </motion.div>
          </div>

          <h2 className="text-center text-[#f6fbff] text-xl font-black tracking-wide mb-2">
            ENTERING BATTLE
          </h2>
          <p className="text-center text-[#c4deef] text-sm mb-5">
            Menyiapkan lawan, moves, dan arena...
          </p>

          <div className="h-2 w-full rounded-full bg-[#16314b] overflow-hidden border border-[#3f6a8a]">
            <motion.div
              className="h-full bg-[linear-gradient(90deg,#f8d44c_0%,#f28f45_60%,#de5e3c_100%)]"
              animate={{ x: ['-100%', '100%'] }}
              transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
              style={{ width: '55%' }}
            />
          </div>

          <div className="mt-4 flex items-center justify-center gap-2 text-[#9bd2c4] text-xs font-semibold uppercase tracking-[0.18em]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#9bd2c4] animate-pulse" />
            <span>Loading</span>
          </div>
        </motion.div>
      </div>
    );
  }

  const playerPokemon = team[0]; // Main Pokemon

  return (
    <div className="min-h-screen pb-20 bg-[linear-gradient(180deg,#73dee3_0%,#b9e4db_35%,#b3e073_58%,#68d7bb_74%,#48ae4e_100%)] overflow-hidden">
      <PokedexHeader
        leftButton={
          <button
            onClick={() => navigate('/game/pokemon/select', { state: { team, mode } })}
            className="w-14 h-14 rounded-full bg-white shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-gray-800" />
          </button>
        }
      />

      <div className="relative w-full px-4 pt-6">
        {/* Wild Pokemon Appeared Text */}
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <motion.h1
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
            className="text-4xl font-black text-[#f8fff9] mb-1"
          >
            WILD POKÉMON
          </motion.h1>
          <motion.h2
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.5, type: 'spring', stiffness: 200 }}
            className="text-5xl font-black text-[#ffe14f]"
          >
            APPEARED!
          </motion.h2>
        </motion.div>

        {/* Battle Preview */}
        <div className="relative flex items-center justify-between gap-3">
          {/* Player Pokemon */}
          <motion.div
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.8, type: 'spring' }}
            className="flex-1"
          >
            <div className="bg-[#2d5957] rounded-3xl p-4 shadow-xl border-4 border-[#a7d9ce]">
              <div className="text-center mb-3">
                <p className="text-[#d4efe6] text-xs font-bold mb-1">YOUR POKÉMON</p>
                <h3 className="text-3xl font-black text-white capitalize">
                  {playerPokemon?.name}
                </h3>
              </div>
              
              {playerPokemon && (
                <motion.img
                  animate={{ y: [0, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  src={playerPokemon.image}
                  alt={playerPokemon.name}
                  className="w-32 h-32 object-contain mx-auto"
                  style={{ imageRendering: 'pixelated' }}
                />
              )}

              {/* Power Indicator */}
              <div className="mt-3 bg-[#4e7a77] rounded-xl p-2">
                <p className="text-[#f3fff8] text-xs text-center font-semibold">
                  Power: {playerPokemon?.stats.attack || 0}
                </p>
              </div>
            </div>
          </motion.div>

          {/* VS Badge */}
          {showVS && (
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
            >
              <div className="w-24 h-24 rounded-full flex items-center justify-center border-4 border-[#f8e59a] bg-[#db5b34] shadow-xl">
                <Swords className="w-12 h-12 text-white" />
              </div>
            </motion.div>
          )}

          {/* Enemy Pokemon */}
          <motion.div
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.8, type: 'spring' }}
            className="flex-1"
          >
            <div className="bg-[#4d6370] rounded-3xl p-4 shadow-xl border-4 border-[#a7d9ce]">
              <div className="text-center mb-3">
                <p className="text-[#d4efe6] text-xs font-bold mb-1">ENEMY POKÉMON</p>
                <h3 className="text-3xl font-black text-white capitalize">
                  {enemy?.name || '???'}
                </h3>
              </div>
              
              {enemy ? (
                <motion.img
                  animate={{ y: [0, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 2, delay: 0.5 }}
                  src={enemy.image}
                  alt={enemy.name}
                  className="w-32 h-32 object-contain mx-auto"
                  style={{ imageRendering: 'pixelated' }}
                />
              ) : (
                <div className="w-32 h-32 mx-auto bg-white/20 rounded-full animate-pulse" />
              )}

              {/* Power Indicator */}
              <div className="mt-3 bg-[#6f8590] rounded-xl p-2">
                <p className="text-[#f3fff8] text-xs text-center font-semibold">
                  Power: {enemy?.stats.attack || '???'}
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Loading Text */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          className="text-center mt-7"
        >
          <div className="flex items-center justify-center gap-2 text-[#1f1e2d]">
            <Zap className="w-5 h-5 animate-pulse text-[#c45a3a]" />
            <span className="font-bold">Preparing for battle...</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}