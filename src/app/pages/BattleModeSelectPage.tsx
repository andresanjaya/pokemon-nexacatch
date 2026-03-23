import { useNavigate } from 'react-router';
import { PokedexHeader } from '../components/PokedexHeader';
import { ArrowLeft, Zap, Crown, Star, Sparkles, TrendingUp, Trophy } from 'lucide-react';
import { motion } from 'motion/react';
import { getXpRequiredForNextLevel } from '../utils/playerProgress';

export function BattleModeSelectPage() {
  const navigate = useNavigate();
  const playerLevel = parseInt(localStorage.getItem('playerLevel') || '1');
  const playerXP = parseInt(localStorage.getItem('playerXP') || '0');
  const xpNeeded = getXpRequiredForNextLevel(playerLevel);
  const xpProgress = (playerXP / xpNeeded) * 100;
  const capturedCount = parseInt(localStorage.getItem('capturedCount') || '0');

  const modes = [
    {
      id: 'normal',
      title: 'Normal Battle',
      description: 'Battle wild Pokémon and capture them for your collection',
      difficulty: 'Easy',
      difficultyColor: 'text-green-600',
      icon: Zap,
      color: 'from-green-400 to-emerald-600',
      rewards: ['Common Pokémon', '50-100 XP'],
      minLevel: 1,
    },
    {
      id: 'boss',
      title: 'Boss Battle',
      description: 'Face powerful legendary Pokémon in epic battles',
      difficulty: 'Hard',
      difficultyColor: 'text-red-600',
      icon: Crown,
      color: 'from-red-500 to-rose-600',
      rewards: ['Legendary Pokémon', 'Mythical Pokemon', '200-300 XP'],
      minLevel: 1,
    },
    {
      id: 'event',
      title: 'Shiny Hunt',
      description: 'Hunt shiny Pokemon with boosted battle challenge and exclusive shiny encounters',
      difficulty: 'Medium-Hard',
      difficultyColor: 'text-purple-600',
      icon: Star,
      color: 'from-purple-500 to-pink-600',
      rewards: ['Shiny Pokemon', '150-250 XP'],
      minLevel: 1,
      badge: 'SHINY',
    },
    {
      id: 'mega',
      title: 'Mega Raid',
      description: 'Challenge Mega Evolution Pokémon with boss-tier difficulty and capture them',
      difficulty: 'Hard',
      difficultyColor: 'text-red-700',
      icon: Sparkles,
      color: 'from-orange-500 to-red-600',
      rewards: ['Mega Pokémon', '200-300 XP'],
      minLevel: 1,
      badge: 'MEGA',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Pokedex Header */}
      <PokedexHeader
        leftButton={
          <button
            onClick={() => navigate('/game')}
            className="w-14 h-14 rounded-full bg-white shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-gray-800" />
          </button>
        }
        title="Battle & Capture"
      />

      {/* Content */}
      <div className="p-4">
        {/* Player Info */}
        <div className="mb-6 bg-white rounded-3xl p-6 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm text-gray-600 mb-1">Player Level</h3>
              <div className="text-3xl font-black text-gray-900">
                Level {playerLevel}
              </div>
            </div>
            <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
              <TrendingUp className="w-8 h-8 text-white" />
            </div>
          </div>
          {/* XP Bar */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-600 mb-2">
              <span>XP Progress</span>
              <span>{playerXP} / {xpNeeded}</span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all"
                style={{ width: `${xpProgress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Mode Selection */}
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Choose Battle Mode
        </h2>

        <div className="space-y-4">
          {modes.map((mode, index) => {
            const isLocked = playerLevel < mode.minLevel;
            
            return (
              <motion.button
                key={mode.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => {
                  if (!isLocked) {
                    navigate('/game/battle/select-pokemon', { state: { mode: mode.id } });
                  }
                }}
                disabled={isLocked}
                className={`w-full bg-white rounded-3xl p-6 shadow-xl transition-all relative overflow-hidden ${
                  isLocked 
                    ? 'opacity-50 cursor-not-allowed' 
                    : 'hover:shadow-2xl hover:scale-[1.02]'
                }`}
              >
                {/* Gradient Overlay */}
                <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${mode.color} opacity-20 rounded-bl-full`} />

                {/* Badge */}
                {mode.badge && !isLocked && (
                  <div className="absolute top-4 right-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                    {mode.badge}
                  </div>
                )}

                {/* Lock Badge */}
                {isLocked && (
                  <div className="absolute top-4 right-4 bg-gray-400 text-white text-xs font-bold px-3 py-1 rounded-full">
                    LOCKED - Level {mode.minLevel}
                  </div>
                )}

                <div className="relative z-10">
                  {/* Header */}
                  <div className="flex items-start gap-4 mb-4">
                    <div className={`w-14 h-14 bg-gradient-to-br ${mode.color} rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0`}>
                      <mode.icon className="w-7 h-7 text-white" />
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="text-xl font-bold text-gray-900 mb-1">
                        {mode.title}
                      </h3>
                      <p className={`text-sm font-semibold ${mode.difficultyColor}`}>
                        Difficulty: {mode.difficulty}
                      </p>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-gray-600 text-sm mb-4 text-left">
                    {mode.description}
                  </p>

                  {/* Rewards */}
                  <div className="bg-gray-50 rounded-2xl p-4">
                    <div className="text-xs font-bold text-gray-700 mb-2">REWARDS</div>
                    <div className="flex flex-wrap gap-2">
                      {mode.rewards.map((reward, idx) => (
                        <div
                          key={idx}
                          className="text-xs bg-white px-3 py-1 rounded-full text-gray-700 font-medium"
                        >
                          {reward}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Tips */}
        <div className="mt-6 bg-blue-50 border-2 border-blue-200 rounded-2xl p-4">
          <div className="flex gap-3">
            <div className="text-2xl">💡</div>
            <div>
              <h4 className="font-bold text-blue-900 mb-1">Tip</h4>
              <p className="text-sm text-blue-800">
                Complete battles to earn XP and level up! Higher levels unlock more challenging modes with better rewards.
              </p>
            </div>
          </div>
        </div>

        {/* View Collection Button */}
        {capturedCount > 0 && (
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            onClick={() => navigate('/game/battle/collection')}
            className="mt-4 w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-4 rounded-2xl shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Trophy className="w-5 h-5" />
            <span>View My Collection ({capturedCount})</span>
          </motion.button>
        )}
      </div>
    </div>
  );
}