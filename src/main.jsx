import React from 'react';
import ReactDOM from 'react-dom/client';
import '@radix-ui/themes/styles.css';
import { Theme } from '@radix-ui/themes';
import App from './App';
import './index.css';
import { ThemeProvider, useThemeMode } from './ThemeContext';

function Root() {
  const { mode } = useThemeMode();
  return (
    <Theme accentColor="purple" grayColor="slate" radius="large" appearance={mode}>
      <App />
    </Theme>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <Root />
    </ThemeProvider>
  </React.StrictMode>
);
