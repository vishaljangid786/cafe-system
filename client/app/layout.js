import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { Toaster } from "react-hot-toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Cafe Management System | Premium Dashboard",
  description: "Advanced Multi-Branch Cafe Management Platform",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col transition-colors duration-300">
        <ThemeProvider>
          <Toaster 
            position="top-right" 
            toastOptions={{
              duration: 4000,
              style: {
                background: '#18181b',
                color: '#fafafa',
                borderRadius: '1rem',
                border: '1px solid #27272a',
                fontSize: '0.875rem',
                fontWeight: '600',
                padding: '12px 16px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
              },
              success: {
                iconTheme: {
                  primary: '#f59e0b',
                  secondary: '#18181b',
                },
              },
            }}
          />
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
