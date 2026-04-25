import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { NotificationProvider } from "./context/NotificationContext";
import { Toaster } from "react-hot-toast";
import CinematicBackground from "./components/ui/CinematicBackground";

const inter = Inter({ subsets: ["latin"], variable: '--font-inter' });
const outfit = Outfit({ subsets: ["latin"], variable: '--font-outfit' });

export const metadata = {
  title: "Cafe Management System | Premium Dashboard",
  description: "Advanced Multi-Location Cafe Management Platform",
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    shortcut: ['/favicon.svg'],
    apple: [
      { url: '/favicon.svg' },
    ],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const savedTheme = localStorage.getItem('theme');
                  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  const theme = savedTheme || systemTheme;
                  if (theme === 'dark') {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className={`${inter.variable} ${outfit.variable} font-sans bg-transparent text-[var(--color-text-primary)] antialiased selection:bg-amber-500/30 selection:text-amber-500 transition-colors duration-300`}>
        <div id="cinematic-root" />
        <div className="scan-line" />
        <ThemeProvider>
          <CinematicBackground />
          <AuthProvider>
            <NotificationProvider>
              <Toaster
                position="top-right"
                toastOptions={{
                  className: '!bg-[var(--color-surface)] !text-[var(--color-text-primary)] !border !border-[var(--color-border)] !rounded-[var(--radius-lg)] !p-4 !text-sm !font-bold !shadow-[var(--shadow-premium)]',
                  duration: 4000,
                }}
              />
              <div className="relative z-10 min-h-screen">
                {children}
              </div>
            </NotificationProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
