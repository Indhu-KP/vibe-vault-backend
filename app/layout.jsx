import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Vibe Vault',
  description: 'Track your mood, save your thoughts, and see your story build up.',
  icons: {
    icon: '/android-chrome-192x192.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
      </body>
    </html>
  );
}
