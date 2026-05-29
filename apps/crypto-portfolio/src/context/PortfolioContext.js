import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@crypto_portfolio';

const PortfolioContext = createContext();

export function PortfolioProvider({ children }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPortfolio();
  }, []);

  useEffect(() => {
    if (!loading) {
      savePortfolio();
    }
  }, [assets, loading]);

  const loadPortfolio = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setAssets(JSON.parse(stored));
      } else {
        setAssets([
          { id: '1', symbol: 'BTC', amount: 0.5, name: 'Bitcoin' },
          { id: '2', symbol: 'ETH', amount: 2, name: 'Ethereum' },
        ]);
      }
    } catch (e) {
      setAssets([]);
    } finally {
      setLoading(false);
    }
  };

  const savePortfolio = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(assets));
    } catch (e) {}
  };

  const addAsset = (symbol, amount, name) => {
    const id = Date.now().toString();
    setAssets((prev) => [...prev, { id, symbol: symbol.toUpperCase(), amount: parseFloat(amount) || 0, name: name || symbol }]);
  };

  const removeAsset = (id) => {
    setAssets((prev) => prev.filter((a) => a.id !== id));
  };

  const getAssetById = (id) => assets.find((a) => a.id === id);

  return (
    <PortfolioContext.Provider value={{ assets, loading, addAsset, removeAsset, getAssetById }}>
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio() {
  const ctx = useContext(PortfolioContext);
  if (!ctx) throw new Error('usePortfolio must be used within PortfolioProvider');
  return ctx;
}
