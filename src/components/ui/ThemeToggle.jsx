'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // İlk yüklemede depolanan temayı uygula
    const stored = typeof window !== 'undefined' ? localStorage.getItem('theme') : null;
    const prefersDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldDark = stored ? stored === 'dark' : prefersDark;
    document.documentElement.classList.toggle('dark', shouldDark);
    setIsDark(shouldDark);
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  return (
    <button
      onClick={toggleTheme}
      className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors bg-card text-foreground border-border hover:bg-muted"
      aria-label="Tema değiştir"
    >
      {isDark ? (
        <>
          <Sun className="h-4 w-4" />
          <span>Açık Mod</span>
        </>
      ) : (
        <>
          <Moon className="h-4 w-4" />
          <span>Koyu Mod</span>
        </>
      )}
    </button>
  );
}


