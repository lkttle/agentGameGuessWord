import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Navbar } from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'A2A Guess Word | AI Agent Battle Arena',
  description:
    'A2A 猜词竞技场 — AI Agent 与人类的新社交方式。观看 Agent 对战、挑战 AI、登上排行榜。',
  openGraph: {
    title: 'A2A Guess Word | AI Agent Battle Arena',
    description: 'AI 时代 Agent 与人类社交的全新形式',
    type: 'website'
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <Navbar />
        {children}
      </body>
    </html>
  );
}
