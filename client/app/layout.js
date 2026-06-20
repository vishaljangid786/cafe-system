import Script from "next/script";
import "./globals.css";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { NotificationProvider } from "./context/NotificationContext";
import { Toaster } from "react-hot-toast";
import TopProgressBar, { RouteProgress } from "./components/ui/TopProgressBar";

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
        <Script
          id="theme-initializer"
          strategy="beforeInteractive"
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
      <body suppressHydrationWarning className="font-sans text-[var(--color-text-primary)] antialiased transition-colors duration-300">
        <ThemeProvider>
          <TopProgressBar />
          <AuthProvider>
            <RouteProgress />
            <NotificationProvider>
              <Toaster
                position="bottom-right"
                toastOptions={{
                  className: '!bg-[var(--color-surface)] !text-[var(--color-text-primary)] !border !border-[var(--color-border)] !rounded-xl !p-4 !text-sm !font-medium !shadow-[var(--shadow-md)]',
                  duration: 4000,
                }}
              />
              <div className="relative z-10 min-h-screen app-shell">
                {children}
              </div>
            </NotificationProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
