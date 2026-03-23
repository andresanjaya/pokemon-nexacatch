import { useState, useEffect, useRef } from 'react';
import { Pokemon } from '../types/pokemon';
import { fetchPokemonList, fetchPokemonById } from '../services/pokeapi';

export const usePokemonList = () => {
  const [pokemon, setPokemon] = useState<Pokemon[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [globalReady, setGlobalReady] = useState(false);
  const fullLoadPromiseRef = useRef<Promise<void> | null>(null);

  const QUICK_LOAD_COUNT = 151;
  const TOTAL_POKEMON = 898;
  const CACHE_KEY = 'pokemonFullCacheV2';
  const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

  const cacheFullDataset = (data: Pokemon[]) => {
    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ timestamp: Date.now(), data })
      );
    } catch (err) {
      console.warn('Failed to cache full Pokemon dataset:', err);
    }
  };

  const getCachedFullDataset = (): Pokemon[] | null => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw) as { timestamp: number; data: Pokemon[] };
      if (!parsed?.timestamp || !Array.isArray(parsed?.data)) {
        return null;
      }

      if (Date.now() - parsed.timestamp > CACHE_TTL_MS) {
        return null;
      }

      return parsed.data;
    } catch {
      return null;
    }
  };

  const ensureGlobalDataLoaded = async () => {
    if (globalReady) return;
    if (fullLoadPromiseRef.current) {
      await fullLoadPromiseRef.current;
      return;
    }

    fullLoadPromiseRef.current = (async () => {
      setLoadingMore(true);
      try {
        const fullData = await fetchPokemonList(TOTAL_POKEMON, 1, true);
        setPokemon(fullData);
        setGlobalReady(true);
        setHasMore(false);
        cacheFullDataset(fullData);
      } finally {
        setLoadingMore(false);
      }
    })();

    try {
      await fullLoadPromiseRef.current;
    } finally {
      fullLoadPromiseRef.current = null;
    }
  };

  // Initial load
  useEffect(() => {
    const loadInitialPokemon = async () => {
      try {
        setLoading(true);
        setError(null);

        const cached = getCachedFullDataset();
        if (cached && cached.length > 0) {
          setPokemon(cached);
          setGlobalReady(true);
          setHasMore(false);
          return;
        }

        // Fast first paint with Kanto-sized data, then complete full index in background.
        const quickData = await fetchPokemonList(QUICK_LOAD_COUNT, 1);
        setPokemon(quickData);
        setGlobalReady(quickData.length >= TOTAL_POKEMON);
        setHasMore(false);

        void ensureGlobalDataLoaded();
      } catch (err) {
        setError('Failed to load Pokemon data. Please try again.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadInitialPokemon();
  }, []);

  // Load more function
  const loadMore = async () => {
    // Kept for API compatibility with existing callers.
    setLoadingMore(false);
    setHasMore(false);
  };

  return {
    pokemon,
    loading,
    loadingMore,
    error,
    hasMore,
    loadMore,
    globalReady,
    ensureGlobalDataLoaded,
  };
};

export const usePokemonById = (id: number) => {
  const [pokemon, setPokemon] = useState<Pokemon | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPokemon = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchPokemonById(id);
        setPokemon(data);
      } catch (err) {
        setError('Failed to load Pokemon. Please try again.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      loadPokemon();
    }
  }, [id]);

  return { pokemon, loading, error };
};