import type { ReactNode } from 'react';

import { Footer } from './Footer';
import { Header } from './Header';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="bg-gray-100 min-h-screen flex flex-col font-sans">
      <Header />
      <main className="flex-grow flex flex-col items-center justify-start p-6 space-y-8">
        {children}
      </main>
      <Footer />
    </div>
  );
}
