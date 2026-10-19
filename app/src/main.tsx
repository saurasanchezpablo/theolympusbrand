import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/cinzel/600.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/jost/400.css';
import '@fontsource/jost/500.css';
import '@fontsource/jost/600.css';
import '@fontsource/jetbrains-mono/400.css';
import './styles.css';
import { loadBrandFonts } from './fonts.ts';
import { App } from './App.tsx';
import { seal } from '../../src/geometry/crest.ts';
import { productionSvg } from '../../src/render/svg.ts';

const root = createRoot(document.getElementById('root')!);

// The lettering is drawn from the font files themselves, so they load first.
loadBrandFonts()
  .then(() => {
    // The tab icon is the master seal, drawn by the same geometry.
    const icon = document.getElementById('icon') as HTMLLinkElement;
    icon.type = 'image/svg+xml';
    icon.href = URL.createObjectURL(new Blob([productionSvg(seal(), { ground: 'transparent' })], { type: 'image/svg+xml' }));
  })
  .then(() =>
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    ),
  )
  .catch((e: Error) => root.render(<p className="fatal">The brand fonts could not be loaded: {e.message}</p>));
