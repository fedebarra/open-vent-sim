
import React, { useRef, useEffect, useCallback } from 'react';
import { WaveformGraph } from './WaveformGraph';
import { HighFlowAnimation } from './HighFlowAnimation';
import { WAVEFORM_CONFIGS, THEME_CONFIG, SWEEP_SPEED_OPTIONS } from '../constants';
import { VentilationMode, AllParameters, OperatingMode, ICUSubMode, ActiveManeuver, ThemeName, SweepSpeedValue, VentilatorData } from '../types';
import { useLanguage } from '../src/contexts/LanguageContext';
import { TranslationKeys } from '../src/i18n/locales';
import { generateWaveformPoint } from '../services/waveformService';


interface GraphsPanelProps {
  isSimulatorOn: boolean;
  isVentilationActive: boolean;
  isWarmingUpHF: boolean;
  isMechanicalVentilation: boolean;
  isHighFlowMode: boolean;
  operatingMode: OperatingMode | null;
  icuSubMode: ICUSubMode | null;
  currentMode: VentilationMode;
  currentTheme: ThemeName;
  parameters: AllParameters;
  ventilatorData: VentilatorData | null;
  areWaveformsFrozen: boolean;
  activeManeuver: ActiveManeuver | null;
  onToggleFreezeWaveforms: () => void;
  currentSweepSpeedValue: SweepSpeedValue;
  scanlinePixelRate: number;
  onChangeSweepSpeed: () => void;
}

const SweepSpeedSelectorButton: React.FC<{
  currentSpeedValue: SweepSpeedValue;
  onClick: () => void;
  themeColors: typeof THEME_CONFIG[ThemeName];
  disabled?: boolean;
}> = ({ currentSpeedValue, onClick, themeColors, disabled }) => {
  const { t } = useLanguage();
  const currentOption = SWEEP_SPEED_OPTIONS.find(opt => opt.value === currentSpeedValue);
  const label = currentOption ? t[currentOption.labelKey] : `${currentSpeedValue} mm/s`;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors
                  ${disabled ? 'bg-gray-500 text-gray-300 cursor-not-allowed' :
                   `bg-gray-600 hover:bg-gray-500 text-gray-200`}
                  `}
      title={t.sweepSpeedChangeTooltip}
    >
      {t.sweepSpeedButtonPrefix}: {label}
    </button>
  );
};

type WaveformType = 'pressure' | 'flow' | 'volume';

const DEFAULT_SCALE_INFO = {
  pressure: { minY: -2, maxY: 30, step: 10, unit: 'cmH₂O' },
  volume: { minY: 0, maxY: 500, step: 250, unit: 'ml' },
  flow: { minY: -60, maxY: 60, step: 30, unit: 'L/min' },
};

// Helper to calculate a "nice" scale with good-looking steps and margins
const getNiceScaleForRange = (type: WaveformType, dataMin: number, dataMax: number): { minY: number, maxY: number, step: number, unit: string } => {
    const fallbackScale = DEFAULT_SCALE_INFO[type];
    if (!isFinite(dataMin) || !isFinite(dataMax)) return fallbackScale;

    const range = dataMax - dataMin;
    const margin = range === 0 ? 5 : range * 0.15; // 15% margin
    let effectiveMin = dataMin - margin;
    let effectiveMax = dataMax + margin;

    if (type === 'flow') {
        const absMax = Math.max(Math.abs(effectiveMin), Math.abs(effectiveMax));
        effectiveMin = -absMax;
        effectiveMax = absMax;
    }
    if (type === 'volume') {
        effectiveMin = Math.max(0, effectiveMin); // Volume never goes below 0
    }

    let newRange = effectiveMax - effectiveMin;
    if (newRange <= 0 || !isFinite(newRange)) {
        newRange = fallbackScale.maxY - fallbackScale.minY;
        effectiveMin = fallbackScale.minY;
        effectiveMax = fallbackScale.maxY;
    }

    const targetSteps = (type === 'flow') ? 4 : 3;
    let rawStep = newRange / targetSteps;
    if (rawStep <= 0) rawStep = fallbackScale.step > 0 ? fallbackScale.step : 1;

    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const residual = rawStep / magnitude;
    let niceStep;
    if (residual > 5) niceStep = 10 * magnitude;
    else if (residual > 2) niceStep = 5 * magnitude;
    else if (residual > 1) niceStep = 2 * magnitude;
    else niceStep = magnitude;

    let niceMinY = Math.floor(effectiveMin / niceStep) * niceStep;
    let niceMaxY = Math.ceil(effectiveMax / niceStep) * niceStep;

    if (niceMaxY === niceMinY) niceMaxY += niceStep;

    return { minY: niceMinY, maxY: niceMaxY, step: niceStep, unit: fallbackScale.unit };
};


export const GraphsPanel: React.FC<GraphsPanelProps> = ({
    isSimulatorOn, isVentilationActive, isWarmingUpHF, isMechanicalVentilation,
    isHighFlowMode,
    operatingMode, icuSubMode,
    currentMode, currentTheme, parameters, ventilatorData,
    areWaveformsFrozen, activeManeuver, onToggleFreezeWaveforms,
    currentSweepSpeedValue, scanlinePixelRate, onChangeSweepSpeed
}) => {
  const { t } = useLanguage();
  const themeColors = THEME_CONFIG[currentTheme];
  const actuallyIsHighFlow = operatingMode === 'icu' && icuSubMode === 'high-flow';
  const showFreezeButton = operatingMode === 'icu' && icuSubMode === 'invasive';
  const showSweepSpeedButton = (operatingMode === 'icu' && (icuSubMode === 'invasive' || icuSubMode === 'non-invasive')) || operatingMode === 'anesthesia';

  const pressureCanvasRef = useRef<HTMLCanvasElement>(null);
  const flowCanvasRef = useRef<HTMLCanvasElement>(null);
  const volumeCanvasRef = useRef<HTMLCanvasElement>(null);

  const animationFrameId = useRef<number | null>(null);
  const scanlinePositionRef = useRef<number>(0);
  const totalSimulatedTimeRef = useRef<number>(0);
  const lastPointsRef = useRef<Record<WaveformType, { x: number, y: number } | null>>({ pressure: null, flow: null, volume: null });
  const isFirstPassRef = useRef<boolean>(true);
  
  const graphScalesRef = useRef<Record<WaveformType, ReturnType<typeof getNiceScaleForRange>>>({
      pressure: DEFAULT_SCALE_INFO.pressure,
      flow: DEFAULT_SCALE_INFO.flow,
      volume: DEFAULT_SCALE_INFO.volume,
  });
  
  // New ref for tracking min/max values during a sweep for auto-scaling
  const sweepMinMaxRef = useRef<Record<WaveformType, { min: number; max: number }>>({
      pressure: { min: Infinity, max: -Infinity },
      flow: { min: Infinity, max: -Infinity },
      volume: { min: Infinity, max: -Infinity },
  });


  const parametersRef = useRef(parameters);
  const ventilatorDataRef = useRef(ventilatorData);
  const activeManeuverRef = useRef(activeManeuver);
  const currentModeRef = useRef(currentMode);

  useEffect(() => {
    parametersRef.current = parameters;
    ventilatorDataRef.current = ventilatorData;
    activeManeuverRef.current = activeManeuver;
    currentModeRef.current = currentMode;
  }, [parameters, ventilatorData, activeManeuver, currentMode]);


  // Calculates an appropriate *initial* scale based on ventilation parameters.
  const calculateInitialScale = useCallback((type: WaveformType, cParams: AllParameters, cMode: VentilationMode) => {
    let dataMin = 0, dataMax = 0;
    const fallback = DEFAULT_SCALE_INFO[type];

    if (type === 'pressure') {
        const { peep, pressureTarget, volume, compliance, psLevel } = cParams;
        const isPSV = cMode === VentilationMode.PS || (cMode === 'SIMV' && Number(psLevel) > 0);
        const isVCV = cMode === 'VC' || (cMode === 'SIMV' && Number(psLevel) === 0);
        let drivingPressure = 0;
        if (isPSV) drivingPressure = Number(psLevel);
        else if (isVCV) drivingPressure = (Number(volume) / (Number(compliance) || 50));
        else drivingPressure = Number(pressureTarget);
        dataMin = -2;
        dataMax = Math.max(30, (Number(peep) + drivingPressure));
    } else if (type === 'volume') {
        const isVC = cMode === 'VC' || (cMode === 'SIMV' && Number(cParams.psLevel) === 0);
        const targetVolume = isVC ? Number(cParams.volume) : ((Number(cParams.pressureTarget) || Number(cParams.psLevel)) * (Number(cParams.compliance) || 50));
        dataMin = 0;
        dataMax = Math.max(250, targetVolume);
    } else { // flow
        return fallback;
    }
    return getNiceScaleForRange(type, dataMin, dataMax);
  }, []);

  const mapYValue = useCallback((rawValue: number, scale: { minY: number; maxY: number; }, graphPixelHeight: number) => {
    if (graphPixelHeight <= 0) return graphPixelHeight / 2;
    const range = scale.maxY - scale.minY;
    if (range === 0) return graphPixelHeight / 2;
    const scaledValue = (rawValue - scale.minY) / range;
    return graphPixelHeight * (1 - scaledValue);
  }, []);

  const drawStaticBackground = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, type: WaveformType, scale: ReturnType<typeof getNiceScaleForRange>) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const paddingLeft = 35, paddingRight = 10;
    const graphWidth = canvas.width - paddingLeft - paddingRight;
    const graphHeight = canvas.height;
    ctx.strokeStyle = '#4A5568';
    ctx.lineWidth = 0.5;
    const verticalLines = Math.max(5, Math.floor(graphWidth / 50));
    for (let i = 0; i <= verticalLines; i++) {
        const x = paddingLeft + (i / verticalLines) * graphWidth;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, graphHeight); ctx.stroke();
    }
    if (scale.step > 0) {
        for (let val = scale.minY; val <= scale.maxY; val += scale.step) {
            const y = mapYValue(val, scale, graphHeight);
            ctx.beginPath(); ctx.moveTo(paddingLeft, y); ctx.lineTo(canvas.width - paddingRight, y); ctx.stroke();
        }
    }
    ctx.fillStyle = '#A0AEC0';
    ctx.font = '10px Arial';
    ctx.textAlign = 'right';
    if (scale.step > 0) {
        for (let val = scale.minY; val <= scale.maxY; val += scale.step) {
            const yPos = mapYValue(val, scale, graphHeight);
            if (yPos >= 5 && yPos <= graphHeight - 5) ctx.fillText(String(val), paddingLeft - 5, yPos + 3);
        }
    }
    ctx.save();
    ctx.fillStyle = (WAVEFORM_CONFIGS as any)[type].color;
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.translate(15, graphHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${t[(WAVEFORM_CONFIGS as any)[type].titleKey]} (${scale.unit})`, 0, 0);
    ctx.restore();
  }, [mapYValue, t]);

  const redrawAllBackgrounds = useCallback(() => {
    const types: WaveformType[] = ['pressure', 'flow', 'volume'];
    types.forEach(type => {
        const canvasRef = type === 'pressure' ? pressureCanvasRef : type === 'flow' ? flowCanvasRef : volumeCanvasRef;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const scale = graphScalesRef.current[type];
        drawStaticBackground(ctx, canvas, type, scale);
    });
  }, [drawStaticBackground]);
  
  const resetSweepMinMax = useCallback(() => {
    sweepMinMaxRef.current = {
        pressure: { min: Infinity, max: -Infinity },
        flow: { min: Infinity, max: -Infinity },
        volume: { min: Infinity, max: -Infinity },
    };
  }, []);

  const animate = useCallback(() => {
    if (areWaveformsFrozen) {
        animationFrameId.current = null;
        return;
    }
    const canvases: Record<WaveformType, HTMLCanvasElement | null> = {
        pressure: pressureCanvasRef.current,
        flow: flowCanvasRef.current,
        volume: volumeCanvasRef.current,
    };
    const contexts = {
        pressure: canvases.pressure?.getContext('2d'),
        flow: canvases.flow?.getContext('2d'),
        volume: canvases.volume?.getContext('2d'),
    };
    const types: WaveformType[] = ['pressure', 'flow', 'volume'];
    if (types.some(type => !contexts[type] || !canvases[type])) {
        animationFrameId.current = requestAnimationFrame(animate);
        return;
    }
    const paddingLeft = 35;
    const graphWidth = canvases.pressure!.width - paddingLeft - 10;
    if (graphWidth <= 0) {
        animationFrameId.current = requestAnimationFrame(animate);
        return;
    }

    const pixelsToAdvance = scanlinePixelRate;
    const T_total = 12000 / scanlinePixelRate;
    const timePerPixel = T_total / graphWidth;

    for (let i = 0; i < pixelsToAdvance; i++) {
        const currentPixel = scanlinePositionRef.current;
        const currentXCoord = paddingLeft + currentPixel;
        const currentTime = totalSimulatedTimeRef.current;
        const currentParams = parametersRef.current;
        const currentVData = ventilatorDataRef.current;
        const uiCycleDurationMs = (Number(currentParams.measuredFrequency) > 0) ? (60 / Number(currentParams.measuredFrequency)) * 1000 : 5000;

        if (!isFirstPassRef.current) {
            types.forEach(type => {
                const canvas = canvases[type]!;
                const ctx = contexts[type]!;
                const clearX = paddingLeft + ((currentPixel + 1) % graphWidth);
                ctx.clearRect(clearX, 0, 2, canvas.height);

                ctx.save();
                ctx.beginPath();
                ctx.rect(clearX, 0, 2, canvas.height);
                ctx.clip();
                const scale = graphScalesRef.current[type];
                ctx.strokeStyle = '#4A5568';
                ctx.lineWidth = 0.5;
                const verticalLines = Math.max(5, Math.floor(graphWidth / 50));
                for (let j = 0; j <= verticalLines; j++) {
                    const x = paddingLeft + (j / verticalLines) * graphWidth;
                    if (x >= clearX && x < clearX + 2) {
                        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
                    }
                }
                if (scale.step > 0) {
                    for (let val = scale.minY; val <= scale.maxY; val += scale.step) {
                        const y = mapYValue(val, scale, canvas.height);
                        ctx.beginPath(); ctx.moveTo(clearX, y); ctx.lineTo(clearX + 2, y); ctx.stroke();
                    }
                }
                ctx.restore();
            });
        }

        types.forEach(type => {
            const ctx = contexts[type]!;
            const canvas = canvases[type]!;
            const scale = graphScalesRef.current[type];

            const newPointValue = generateWaveformPoint(currentTime, uiCycleDurationMs, currentVData, currentParams, type, activeManeuverRef.current, currentModeRef.current);
            
            // Track min/max for auto-scaling
            sweepMinMaxRef.current[type].min = Math.min(sweepMinMaxRef.current[type].min, newPointValue);
            sweepMinMaxRef.current[type].max = Math.max(sweepMinMaxRef.current[type].max, newPointValue);

            const newY = mapYValue(newPointValue, scale, canvas.height);
            let lastPoint = lastPointsRef.current[type];

            if (lastPoint) {
                let color = (WAVEFORM_CONFIGS as any)[type].color;
                const isPatientTriggerPhase = (
                    currentModeRef.current === VentilationMode.PS ||
                    (currentModeRef.current === VentilationMode.SIMV && Number(parametersRef.current.psLevel) > 0)
                );

                if (type === 'flow' && isPatientTriggerPhase) {
                    const timeInCycleMs = totalSimulatedTimeRef.current % uiCycleDurationMs;
                    const TRIGGER_VISUAL_DURATION_MS = 100;
                    if (timeInCycleMs < TRIGGER_VISUAL_DURATION_MS) {
                        color = '#FFFFFF'; // White for trigger
                    }
                }
                
                ctx.beginPath();
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.moveTo(lastPoint.x, lastPoint.y);
                ctx.lineTo(currentXCoord, newY);
                ctx.stroke();

                const fillPath = new Path2D();
                const zeroY = mapYValue(0, scale, canvas.height);
                fillPath.moveTo(lastPoint.x, lastPoint.y);
                fillPath.lineTo(currentXCoord, newY);
                fillPath.lineTo(currentXCoord, zeroY);
                fillPath.lineTo(lastPoint.x, zeroY);
                fillPath.closePath();
                ctx.fillStyle = `${color}33`;
                ctx.fill(fillPath);
            }
            lastPointsRef.current[type] = { x: currentXCoord, y: newY };
        });

        scanlinePositionRef.current++;
        totalSimulatedTimeRef.current += timePerPixel;

        if (scanlinePositionRef.current >= graphWidth) {
            scanlinePositionRef.current = 0;
            isFirstPassRef.current = false;
            lastPointsRef.current = { pressure: null, flow: null, volume: null };

            let needsRescaleAndReset = false;
            const newScales = { ...graphScalesRef.current };

            types.forEach(type => {
                const currentScale = graphScalesRef.current[type];
                const tracked = sweepMinMaxRef.current[type];
                if (!isFinite(tracked.min) || !isFinite(tracked.max)) return;

                const currentRange = currentScale.maxY - currentScale.minY;
                const trackedRange = tracked.max - tracked.min;

                const isOvershooting = tracked.max > currentScale.maxY || tracked.min < currentScale.minY;
                const isUndershooting = currentRange > 0 && trackedRange > 0 && (trackedRange / currentRange) < 0.40;

                if (isOvershooting || isUndershooting) {
                    const calculatedScale = getNiceScaleForRange(type, tracked.min, tracked.max);
                    if (calculatedScale.minY !== currentScale.minY || calculatedScale.maxY !== currentScale.maxY || calculatedScale.step !== currentScale.step) {
                        newScales[type] = calculatedScale;
                        needsRescaleAndReset = true;
                    }
                }
            });

            if (needsRescaleAndReset) {
                graphScalesRef.current = newScales;
                redrawAllBackgrounds();
                scanlinePositionRef.current = 0;
                isFirstPassRef.current = true;
                lastPointsRef.current = { pressure: null, flow: null, volume: null };
            }
            
            resetSweepMinMax();
        }
    }

    animationFrameId.current = requestAnimationFrame(animate);
  }, [areWaveformsFrozen, scanlinePixelRate, mapYValue, redrawAllBackgrounds, resetSweepMinMax]);

  useEffect(() => {
    const canvases = [pressureCanvasRef.current, flowCanvasRef.current, volumeCanvasRef.current];
    const parentElement = pressureCanvasRef.current?.parentElement;
    if (!parentElement || canvases.some(c => !c)) return;

    const resetDrawingState = () => {
        isFirstPassRef.current = true;
        scanlinePositionRef.current = 0;
        lastPointsRef.current = { pressure: null, flow: null, volume: null };
        resetSweepMinMax();
    };

    const resizeObserver = new ResizeObserver(() => {
      canvases.forEach(canvas => {
        if (canvas && canvas.parentElement) {
          canvas.width = canvas.parentElement.offsetWidth;
          canvas.height = canvas.parentElement.offsetHeight;
        }
      });
      redrawAllBackgrounds();
      resetDrawingState();
    });
    resizeObserver.observe(parentElement);

    if (isVentilationActive && !areWaveformsFrozen && !animationFrameId.current) {
        resetDrawingState();
        redrawAllBackgrounds();
        animationFrameId.current = requestAnimationFrame(animate);
    } else if ((!isVentilationActive || areWaveformsFrozen) && animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
    }

    return () => {
        resizeObserver.disconnect();
        if (animationFrameId.current) {
            cancelAnimationFrame(animationFrameId.current);
            animationFrameId.current = null;
        }
    };
  }, [isVentilationActive, areWaveformsFrozen, animate, redrawAllBackgrounds, resetSweepMinMax]);

  const { peep, pressureTarget, volume, compliance, psLevel } = parameters;
  useEffect(() => {
    const types: WaveformType[] = ['pressure', 'flow', 'volume'];
    types.forEach(type => {
        const newScale = calculateInitialScale(type, parametersRef.current, currentModeRef.current);
        graphScalesRef.current[type] = newScale;
    });
    redrawAllBackgrounds();
    isFirstPassRef.current = true;
    scanlinePositionRef.current = 0;
    lastPointsRef.current = { pressure: null, flow: null, volume: null };
    resetSweepMinMax();
  }, [peep, pressureTarget, volume, compliance, psLevel, ventilatorData, currentMode, scanlinePixelRate, redrawAllBackgrounds, calculateInitialScale, resetSweepMinMax]);


  if (actuallyIsHighFlow) {
    return (
      <div className="bg-gray-900 p-4 flex flex-col justify-start items-center overflow-hidden h-full">
        <div className={`text-lg font-bold mb-4 text-white border-b-2 border-gray-700 pb-1 self-stretch text-center`}>
          {t.highFlowAnimationTitle}
        </div>
        {isVentilationActive ? (
          <HighFlowAnimation
            fgfValue={Number(parameters.fgf) || 0}
            currentTheme={currentTheme}
            isVentilationActive={isVentilationActive}
          />
        ) : (
          <div className="flex-grow flex justify-center items-center text-2xl text-gray-400">
            {isWarmingUpHF ? t.status_warming_up : t.oxygenationStandbyStatus}
          </div>
        )}
      </div>
    );
  }

  if (currentMode === VentilationMode.CPAP && operatingMode !== 'anesthesia') {
     return (
      <div className="bg-gray-900 p-4 flex flex-col justify-center items-center overflow-hidden h-full">
        <div className={`text-lg font-bold mb-4 text-white border-b-2 border-gray-700 pb-1 self-stretch text-center`}>
          {t.panelCurves}
        </div>
        <div className="text-2xl text-gray-400">
          {isVentilationActive ? t.cpapActiveMsg : t.ventilationStandbyMsg}
        </div>
      </div>
    );
  }

  if (!isVentilationActive &&
      ( (operatingMode === 'anesthesia' && isMechanicalVentilation) ||
        (operatingMode === 'icu' && (icuSubMode === 'invasive' || icuSubMode === 'non-invasive') && currentMode !== VentilationMode.CPAP)
      )
     ) {
    return (
     <div className="bg-gray-900 p-4 flex flex-col justify-center items-center overflow-hidden h-full">
       <div className={`text-lg font-bold mb-4 text-white border-b-2 border-gray-700 pb-1 self-stretch text-center`}>
         {t.panelCurves}
       </div>
       <div className="text-2xl text-gray-400">
         {t.ventilationStandbyMsg}
       </div>
     </div>
   );
 }

  return (
    <div className="bg-gray-900 p-2 flex flex-col overflow-hidden h-full">
      <div className={`flex justify-between items-center text-sm font-bold mb-1 text-white pb-1`}>
        <span className="pl-2">{t.panelCurves}</span>
        <div className="flex items-center space-x-2">
            {showSweepSpeedButton && (
                <SweepSpeedSelectorButton
                    currentSpeedValue={currentSweepSpeedValue}
                    onClick={onChangeSweepSpeed}
                    themeColors={themeColors}
                    disabled={areWaveformsFrozen || activeManeuver !== null}
                />
            )}
            {showFreezeButton && (
                <button
                    onClick={onToggleFreezeWaveforms}
                    disabled={activeManeuver !== null}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors
                                ${activeManeuver !== null ? 'bg-gray-500 text-gray-300 cursor-not-allowed' :
                                areWaveformsFrozen
                                    ? `bg-sky-500 text-white`
                                    : `bg-gray-600 hover:bg-gray-500 text-gray-200`}
                                `}
                    title={areWaveformsFrozen ? t.unfreezeWaveformsButton : t.freezeWaveformsButton}
                >
                    {areWaveformsFrozen ? t.unfreezeWaveformsButton : t.freezeWaveformsButton}
                </button>
            )}
        </div>
      </div>
      <div className="grid grid-rows-3 gap-1 flex-1 min-h-0">
        <WaveformGraph ref={pressureCanvasRef} />
        <WaveformGraph ref={flowCanvasRef} />
        <WaveformGraph ref={volumeCanvasRef} />
      </div>
    </div>
  );
};
