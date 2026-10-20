// The interface's line icons: 24-unit strokes in the current text colour.

export function Icon({ name }: { name: 'copy' | 'download' | 'trash' | 'plus' | 'upload' | 'undo' | 'redo' | 'link' | 'close' | 'menu' | 'library' | 'sliders' | 'image' }) {
  const paths: Record<typeof name, string> = {
    close: 'M6 6l12 12M18 6 6 18',
    menu: 'M4 7h16M4 12h16M4 17h16',
    library: 'M5 4h4v16H5zM10 4h4v16h-4zM15.5 4.5l3.8 1 -3.7 15 -3.8-1z',
    sliders: 'M5 6h9M18 6h1M5 12h3M12 12h7M5 18h11M19 18h0M14 4v4M8 10v4M16 16v4',
    image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4',
    copy: 'M8 8h11v11H8zM5 16V5h11',
    undo: 'M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
    redo: 'm15 14 5-5-5-5m5 5H10a6 6 0 0 0 0 12h3',
    link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
    download: 'M12 4v11m-5-5 5 5 5-5M5 20h14',
    trash: 'M5 7h14M10 7V4h4v3m-7 0 1 13h8l1-13',
    plus: 'M12 5v14M5 12h14',
    upload: 'M12 20V9m-5 5 5-5 5 5M5 4h14',
  };
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name]} />
    </svg>
  );
}
