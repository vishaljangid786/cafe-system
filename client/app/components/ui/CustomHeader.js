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
      <div className="bg-card p-6 md:p-8 rounded-[2.5rem] border border-border shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 relative overflow-hidden group">
        <div className="flex items-center gap-4 relative z-10">
          <button 
            onClick={handleBack}
            className="p-3 rounded-2xl bg-muted border border-border text-muted-foreground hover:text-foreground hover:bg-card transition-all shadow-sm flex items-center justify-center"
            title="Go Back"
          >
            <ChevronLeft size={20} strokeWidth={2.5} />
          </button>
          
          {Icon && (
            <div className="p-3.5 rounded-2xl bg-accent/10 text-accent border border-accent/20 shadow-inner flex items-center justify-center">
              <Icon size={24} strokeWidth={2.5} />
            </div>
          )}
          
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs md:text-sm text-muted-foreground font-medium mt-1">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {rightElement && (
          <div className="relative z-10 flex items-center gap-4 w-full md:w-auto">
            {rightElement}
          </div>
        )}

        {/* Premium ambient glow */}
        <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-accent/5 to-transparent pointer-events-none" />
      </div>
    </SlideIn>
  );
}
