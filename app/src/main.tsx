import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/cinzel/600.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/jost/400.css';
import '@fontsource/jost/500.css';
import '@fontsource/jost/600.css';
import '@fontsource/jetbrains-mono/400.css';
import './styles.css';
import './tailwind.css';
import { App } from './App.tsx';

// The shell draws at once; the parts that outline lettering load the brand fonts themselves.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
