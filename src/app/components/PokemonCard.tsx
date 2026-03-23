import { Pokemon } from '../types/pokemon';
import { TypeBadge } from './TypeBadge';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import { Heart } from 'lucide-react';
import { typeColors } from '../utils/typeColors';
import { useState, useEffect } from 'react';

interface PokemonCardProps {
  pokemon: Pokemon;
}

// Soft pastel versions of type colors for card backgrounds
const cardTypeColors: Record<string, string> = {
  fire: '#FFCCB3',
  water: '#C0DCFF',
  grass: '#C8E6C9',
  electric: '#FFF9C4',
  psychic: '#F8BBD0',
  ice: '#CCEEFF',
  dragon: '#D1C4E9',
  dark: '#D7CCC8',
  fairy: '#FFD6E8',
  normal: '#E0E0E0',
  fighting: '#FFCCBC',
  flying: '#BBDEFB',
  poison: '#E1BEE7',
  ground: '#FFECB3',
  rock: '#D7CCC8',
  bug: '#DCEDC8',
  ghost: '#D1C4E9',
  steel: '#CFD8DC',
};

export function PokemonCard({ pokemon }: PokemonCardProps) {
  const primaryType = pokemon.types[0];
  const cardBgColor = cardTypeColors[primaryType] || '#E0E0E0';
  const [isFavorite, setIsFavorite] = useState(false);
  const displayDexId = pokemon.pokedexId ?? pokemon.id;
  const displayName = pokemon.speciesName || pokemon.name;
  const formLabel = pokemon.formName;
  const cardImage = pokemon.pixelImage || pokemon.image;

  // Check if pokemon is favorited
  useEffect(() => {
    const savedIds = localStorage.getItem('favoritePokemon');
    if (savedIds) {
      const ids: number[] = JSON.parse(savedIds);
      setIsFavorite(ids.includes(pokemon.id));
    }
  }, [pokemon.id]);

  const toggleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

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

  return (
    <Link to={`/pokemon/${pokemon.id}`}>
      <motion.div
        whileTap={{ scale: 0.98 }}
        className="rounded-3xl p-5 flex items-center gap-4 relative shadow-md overflow-hidden"
        style={{ backgroundColor: cardBgColor }}
      >
        {/* Left side - Pokemon info */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium mb-1 opacity-60">
            #{displayDexId.toString().padStart(3, '0')}
          </div>
          <div>
            <h3 className="font-bold text-xl text-gray-900 capitalize">
            {displayName}
          </h3>
          {formLabel && (
            <p className="text-sm text-gray-700 font-semibold mb-3 truncate">
              {formLabel}
            </p>
          )}
          </div>
          
          
          {/* Type badges */}
          <div className="flex gap-2 flex-wrap mt-3">
            {pokemon.types.map((type) => (
              <TypeBadge key={type} type={type} />
            ))}
          </div>
        </div>

        {/* Right side - Pokemon image */}
        <div className="relative flex-shrink-0">
          <img
            src={cardImage}
            alt={pokemon.name}
            className="w-24 h-24 object-contain relative z-10"
            style={{ imageRendering: 'pixelated' }}
          />
          
          {/* Heart icon for favorite */}
          <button
            onClick={toggleFavorite}
            className="absolute top-0 right-0 w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center z-20 hover:bg-gray-50 transition-colors"
          >
            <Heart 
              className={`w-4 h-4 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-400'}`}
            />
          </button>
        </div>
      </motion.div>
    </Link>
  );
}