'use client';
import { ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { SlideIn } from './AnimatedContainer';

export default function CustomHeader({ 
  title, 
  subtitle, 
  icon: Icon, 
  goBackUrl, 
  onGoBack,
  rightElement 
}) {
  const router = useRouter();

  const handleBack = () => {
    if (onGoBack) {
      onGoBack();
    } else if (goBackUrl) {
      router.push(goBackUrl);
    } else {
      router.back();
    }
  };

  return (
    <SlideIn direction="down">
      <div className="bg-[var(--color-surface)] p-5 md:p-6 rounded-xl border border-[var(--color-border)] flex flex-col md:flex-row justify-between items-start md:items-center gap-5 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="p-2.5 rounded-lg bg-[var(--color-surface-soft)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] transition-colors flex items-center justify-center"
            title="Go Back"
          >
            <ChevronLeft size={20} strokeWidth={2.5} />
          </button>

          {Icon && (
            <div className="p-3 rounded-lg bg-[var(--color-primary-soft)] text-[var(--color-primary)] flex items-center justify-center">
              <Icon size={22} strokeWidth={2.5} />
            </div>
          )}

          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[var(--color-text-primary)] flex items-center gap-2">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {rightElement && (
          <div className="flex items-center gap-3 w-full md:w-auto">
            {rightElement}
          </div>
        )}
      </div>
    </SlideIn>
  );
}
