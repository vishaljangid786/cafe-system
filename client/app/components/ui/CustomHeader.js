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
      <div className="bg-(--color-surface) p-5 md:p-6 rounded-xl border border-(--color-border) flex flex-col md:flex-row justify-between items-start md:items-center gap-5 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="p-2.5 rounded-lg bg-(--color-surface-soft) border border-(--color-border) text-(--color-text-muted) hover:text-(--color-text-primary) hover:border-(--color-border-strong) transition-colors flex items-center justify-center"
            title="Go Back"
          >
            <ChevronLeft size={20} strokeWidth={2.5} />
          </button>

          {Icon && (
            <div className="p-3 rounded-lg bg-(--color-primary-soft) text-primary flex items-center justify-center">
              <Icon size={22} strokeWidth={2.5} />
            </div>
          )}

          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-(--color-text-primary) flex items-center gap-2">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-(--color-text-muted) mt-0.5">
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
