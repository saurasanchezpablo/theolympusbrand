import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/cinzel/600.css';
import '@fontsource/jost/400.css';
import '@fontsource/jost/500.css';
import '../styles.css';
import './lab.css';
import { Lab } from './Lab.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Lab />
  </StrictMode>,
);
