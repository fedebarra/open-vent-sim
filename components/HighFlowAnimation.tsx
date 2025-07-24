
import React, { useRef, useEffect, useCallback } from 'react';
import { THEME_CONFIG } from '../constants';
import { ThemeName } from '../types';
import { useLanguage } from '../src/contexts/LanguageContext';

interface HighFlowAnimationProps {
  fgfValue: number;
  currentTheme: ThemeName;
  isVentilationActive: boolean;
}

const MAX_DISPLAY_FLOW = 70; // L/min, for graph scale
const SCALE_STEP = 10; // L/min

export const HighFlowAnimation: React.FC<HighFlowAnimationProps> = ({ fgfValue, currentTheme, isVentilationActive }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number | null>(null);
  const { t } = useLanguage();
  const themeColors = THEME_CONFIG[currentTheme]; // Should be ICU theme
  const timeRef = useRef<number>(0);

  const draw = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const paddingLeft = 40; // Space for Y-axis labels
    const paddingRight = 10;
    const paddingTop = 10;
    const paddingBottom = 20; // Space for unit label
    const graphWidth = canvas.width - paddingLeft - paddingRight;
    const graphHeight = canvas.height - paddingTop - paddingBottom;

    if (graphWidth <= 0 || graphHeight <= 0) return;

    // Draw Y-axis scale and labels
    ctx.fillStyle = '#A0AEC0'; // gray-400
    ctx.font = '10px Arial';
    ctx.textAlign = 'right';
    for (let val = 0; val <= MAX_DISPLAY_FLOW; val += SCALE_STEP) {
      const yPos = paddingTop + graphHeight - ((val / MAX_DISPLAY_FLOW) * graphHeight);
      if (yPos >= paddingTop && yPos <= paddingTop + graphHeight) {
        ctx.fillText(String(val), paddingLeft - 8, yPos + 3);
        // Draw tick mark
        ctx.beginPath();
        ctx.moveTo(paddingLeft - 4, yPos);
        ctx.lineTo(paddingLeft, yPos);
        ctx.strokeStyle = '#636b77'; // A bit lighter than grid
        ctx.stroke();
      }
    }
    // Y-axis unit
    ctx.save();
    ctx.translate(paddingLeft - 30, paddingTop + graphHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText(`(${t.unit_L_min})`, 0, 0);
    ctx.restore();


    // Draw Grid (horizontal lines)
    ctx.strokeStyle = '#4A5568'; // Darker grid color
    ctx.lineWidth = 0.5;
    for (let val = 0; val <= MAX_DISPLAY_FLOW; val += SCALE_STEP) {
      const y = paddingTop + graphHeight - ((val / MAX_DISPLAY_FLOW) * graphHeight);
      ctx.beginPath();
      ctx.moveTo(paddingLeft, y);
      ctx.lineTo(paddingLeft + graphWidth, y);
      ctx.stroke();
    }
     // Vertical line for Y-axis
    ctx.beginPath();
    ctx.moveTo(paddingLeft, paddingTop);
    ctx.lineTo(paddingLeft, paddingTop + graphHeight);
    ctx.stroke();


    // Draw the FGF line
    const fgfLineY = paddingTop + graphHeight - ((Math.min(fgfValue, MAX_DISPLAY_FLOW) / MAX_DISPLAY_FLOW) * graphHeight);
    
    ctx.save();
    ctx.beginPath();
    ctx.rect(paddingLeft, paddingTop, graphWidth, graphHeight);
    ctx.clip();

    ctx.strokeStyle = themeColors.graphColor1; // Use a theme color
    ctx.lineWidth = 4; // Make the line thicker

    // Simple animation: moving dashes or a "pulse"
    const segmentLength = 15;
    const gapLength = 10;
    const totalPatternLength = segmentLength + gapLength;
    const offset = (timeRef.current * 30) % totalPatternLength; // Adjust speed with * 30

    ctx.beginPath();
    for (let x = -offset; x < graphWidth; x += totalPatternLength) {
        ctx.moveTo(paddingLeft + x, fgfLineY);
        ctx.lineTo(paddingLeft + Math.min(x + segmentLength, graphWidth), fgfLineY);
    }
    ctx.stroke();
    
    // Display FGF value next to the line end
    ctx.fillStyle = themeColors.graphColor1;
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`${fgfValue.toFixed(0)} ${t.unit_L_min}`, paddingLeft + graphWidth + 5, fgfLineY + 4);

    ctx.restore();
    timeRef.current += 0.016; // Increment time for animation

  }, [fgfValue, themeColors, t]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      if (canvasRef.current && canvasRef.current.parentElement) {
        canvasRef.current.width = canvasRef.current.parentElement.offsetWidth;
        canvasRef.current.height = canvasRef.current.parentElement.offsetHeight;
        if (isVentilationActive) {
            draw(ctx, canvas);
        }
      }
    };

    const animate = () => {
      if (isVentilationActive && ctx && canvas) {
        draw(ctx, canvas);
        animationFrameId.current = requestAnimationFrame(animate);
      }
    };

    resizeCanvas(); // Initial resize

    if (isVentilationActive) {
      timeRef.current = 0; // Reset animation time
      animate();
    } else {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
       // Optionally draw a static representation or clear when not active
       ctx.clearRect(0,0, canvas.width, canvas.height); // Clear if not active
    }

    window.addEventListener('resize', resizeCanvas);

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [isVentilationActive, draw, fgfValue]); // fgfValue in dependencies to redraw if it changes

  return (
    <div className={`w-full h-full bg-gray-800 border-2 ${themeColors.border === 'border-red-600' ? 'border-gray-600' : themeColors.border} rounded-lg relative overflow-hidden shadow-inner flex flex-col`}>
      <canvas ref={canvasRef} className="w-full h-full"></canvas>
    </div>
  );
};
