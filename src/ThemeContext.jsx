import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    return localStorage.getItem('crc_theme') || 'light';
  });

  useEffect(() => {
    localStorage.setItem('crc_theme', mode);
    document.documentElement.setAttribute('data-theme', mode);
  }, [mode]);

  const toggle = () => setMode(m => m === 'light' ? 'dark' : 'light');

  return (
    <ThemeContext.Provider value={{ mode, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeMode() {
  return useContext(ThemeContext);
}
