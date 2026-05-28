import { useEffect, useRef, useState } from 'react';

import type { DashboardCardProps } from '@/features/dashboard/types';

const COLOR_MAP = {
  blue: 'bg-blue-600',
  green: 'bg-green-600',
  orange: 'bg-orange-600',
} as const;

function useAnimatedCounter(targetValue: number, duration = 1000) {
  const [displayValue, setDisplayValue] = useState(0);
  const previousValueRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const startValue = previousValueRef.current;
    const startTime = performance.now();

    function animate(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const currentValue = Math.floor(startValue + (targetValue - startValue) * progress);
      setDisplayValue(currentValue);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        previousValueRef.current = targetValue;
      }
    }

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [targetValue, duration]);

  return displayValue;
}

export function DashboardCard({ label, value, color, showIndicator = false }: DashboardCardProps) {
  const displayValue = useAnimatedCounter(value);

  return (
    <div
      className={`${COLOR_MAP[color]} text-white p-4 rounded-lg shadow-xl text-center relative overflow-hidden flex-1 max-w-xs transition-all duration-500`}
    >
      <div className="text-4xl font-extrabold transition-all duration-500 ease-in-out">
        {displayValue}
      </div>
      <p className="text-base font-medium">{label}</p>
      {showIndicator && (
        <div className="absolute top-1 right-1 w-3 h-3 bg-yellow-300 rounded-full animate-ping" />
      )}
    </div>
  );
}
