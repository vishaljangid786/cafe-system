import Script from "next/script";
import "./globals.css";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ValueVisibilityProvider } from "./context/ValueVisibilityContext";
import { NotificationProvider } from "./context/NotificationContext";
import { Toaster } from "react-hot-toast";
import TopProgressBar, { RouteProgress } from "./components/ui/TopProgressBar";
import DateInputEnhancer from "./components/ui/DateInputEnhancer";
import TooltipLayer from "./components/ui/TooltipLayer";

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
                  // Restore the "hide values" privacy preference before paint so real
                  // numbers never flash before React masks them (see globals.css).
                  if (localStorage.getItem('cafe:valuesHidden') === '1') {
                    document.documentElement.classList.add('values-hidden');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning className="font-sans text-(--color-text-primary) antialiased transition-colors duration-300">
        <ThemeProvider>
          <ValueVisibilityProvider>
          <DateInputEnhancer />
          <TopProgressBar />
          <AuthProvider>
            <RouteProgress />
            <NotificationProvider>
              <Toaster
                position="bottom-right"
                toastOptions={{
                  className: '!bg-(--color-surface) !text-(--color-text-primary) !border !border-(--color-border) !rounded-xl !p-4 !text-sm !font-medium !shadow-[var(--shadow-md)]',
                  duration: 4000,
                }}
              />
              <div className="relative z-10 min-h-screen app-shell">
                {children}
              </div>
              {/* Global styled hover tooltips for every icon/action button
                  (reads their title / data-tooltip / aria-label). */}
              <TooltipLayer />
            </NotificationProvider>
          </AuthProvider>
          </ValueVisibilityProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
