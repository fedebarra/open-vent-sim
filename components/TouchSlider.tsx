import React, { useState, useRef, useEffect, useCallback } from 'react';
import { THEME_CONFIG } from '../constants';
import { ThemeName } from '../types';

interface TouchSliderProps {
  label: string;
  min: number;
  max: number;
  step: number;
  initialValue: number | null;
  unit: string;
  themeColors: typeof THEME_CONFIG[ThemeName];
  onChange: (value: number) => void;
  disabled?: boolean;
}

export const TouchSlider: React.FC<TouchSliderProps> = ({
  label, min, max, step, initialValue, unit, themeColors, onChange, disabled = false
}) => {
  const [value, setValue] = useState<number>(initialValue ?? min);
  const sliderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setValue(initialValue ?? min);
  }, [initialValue, min]);

  const calculateValueFromPosition = useCallback((clientX: number) => {
    if (!sliderRef.current) return value;

    const rect = sliderRef.current.getBoundingClientRect();
    const percent = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    let newValue = min + percent * (max - min);
    
    // Snap to step
    newValue = Math.round(newValue / step) * step;
    // Clamp to min/max
    newValue = Math.min(max, Math.max(min, newValue));
    
    return newValue;
  }, [min, max, step, value]);

  const handleChange = (newValue: number) => {
    if (disabled) return;
    setValue(newValue);
    onChange(newValue);
  };

  const handleInteractionStart = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (disabled) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const newValue = calculateValueFromPosition(clientX);
    handleChange(newValue);

    const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
      // Prevent page scroll on touch devices while dragging slider
      if ('touches' in moveEvent) {
          moveEvent.preventDefault();
      }
      const moveClientX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const movedNewValue = calculateValueFromPosition(moveClientX);
      handleChange(movedNewValue);
    };

    const handleEnd = () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchend', handleEnd);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('touchmove', handleMove, { passive: false}); // passive: false is required for preventDefault to work
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchend', handleEnd);
  };
  
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className={`py-2 ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex justify-between items-center text-xs text-gray-300 mb-1">
        <span className="truncate flex-shrink min-w-0 mr-2">{label}</span>
        <span className={`font-semibold truncate flex-shrink min-w-0 ${disabled ? 'text-gray-500' : `text-${themeColors.accent}`}`}>
          {value.toFixed(step < 1 ? String(step).split('.')[1]?.length || 0 : 0)} {unit}
        </span>
      </div>
      <div
        ref={sliderRef}
        className={`relative w-full h-5 bg-gray-700 rounded-full cursor-pointer border border-gray-600 ${disabled ? 'cursor-not-allowed' : ''}`}
        onMouseDown={handleInteractionStart}
        onTouchStart={handleInteractionStart}
      >
        <div
          className={`absolute top-0 left-0 h-full rounded-full bg-${themeColors.accent}`}
          style={{ width: `${percentage}%` }}
        />
        <div
          className={`absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-white shadow-md border-2 ${disabled ? `border-gray-500` : `border-${themeColors.accent}`} flex items-center justify-center`}
          style={{ left: `${percentage}%` }}
        >
           <div className={`w-3 h-3 rounded-full bg-${themeColors.accent} ${disabled ? 'opacity-50' : ''}`}></div>
        </div>
      </div>
    </div>
  );
};