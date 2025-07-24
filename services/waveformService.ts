import { VentilationMode, AllParameters, ActiveManeuver } from '../types';
import { vcData, pcData, psData } from '../data/ventilatorData';

export interface DataPoint {
  time: number; // in milliseconds, relative to cycle start
  paw: number;
  flow: number;
  volume: number;
}

export interface BaseSettings {
  [key: string]: number;
}

export interface VentilatorData {
  mode: VentilationMode;
  baseSettings: BaseSettings;
  waveforms: DataPoint[];
  cycleDurationMs: number;
  preCalculated: {
    peakPressure: number;
    peakVolume: number;
    peakFlow: number;
  };
}

const parseVentilatorData = (rawData: string, mode: VentilationMode): VentilatorData => {
    const lines = rawData.split('\n');
    const dataStartIndex = lines.findIndex(line => line.startsWith('[DATA]'));

    const headerLines = lines.slice(0, dataStartIndex);
    const dataLines = lines.slice(dataStartIndex + 2); // Skip [DATA] and header row

    const baseSettings: BaseSettings = {};
    const settingMapping: Record<string, string> = {
        'PC sopra PEEP': 'pressureTarget',
        'PS sopra PEEP': 'psLevel',
        'PEEP': 'peep',
        'Freq. resp.': 'frequency',
        'Freq. SIMV': 'frequency',
        'Volume corrente': 'volume',
        'T pausa (%)': 'inspPause',
    };
    headerLines.forEach(line => {
        const parts = line.split('\t').map(p => p.trim());
        const key = parts[0];
        if (settingMapping[key]) {
            const value = parseFloat(parts[1].replace(',', '.'));
            if (!isNaN(value)) {
                baseSettings[settingMapping[key]] = value;
            }
        } else if (key === 'I:E') {
            const ratioParts = parts[1].split(':').map(Number);
            if (ratioParts.length === 2 && !isNaN(ratioParts[0]) && !isNaN(ratioParts[1])) {
                baseSettings['ratio_i'] = ratioParts[0];
                baseSettings['ratio_e'] = ratioParts[1];
            }
        }
    });

    let cycleDurationMs = 4000;
    if(baseSettings.frequency > 0) {
        cycleDurationMs = (60 / baseSettings.frequency) * 1000;
    }
    
    let timeOfFirstInsp = -1;
    let inspFound = false;

    const waveforms: DataPoint[] = dataLines.map(line => {
        const parts = line.split('\t');
        if (parts.length < 5) return null;

        const timeStr = parts[0];
        const phase = parts[1];
        const paw = parseFloat(parts[2].replace(',', '.'));
        const flow = parseFloat(parts[3].replace(',', '.'));
        const volume = parseFloat(parts[4].replace(',', '.'));
        
        if (isNaN(paw) || isNaN(flow) || isNaN(volume)) return null;

        const timeParts = timeStr.split(':').map(Number);
        const timeMs = (timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2]) * 1000 + timeParts[3];

        if (!inspFound && phase.includes('insp')) {
             timeOfFirstInsp = timeMs;
             inspFound = true;
        }

        return { time: timeMs, paw, flow, volume, phase };
    }).filter((p): p is NonNullable<typeof p> => p !== null).map(p => ({
        ...p,
        time: (p.time - timeOfFirstInsp) % cycleDurationMs,
    }));
    
    waveforms.sort((a,b) => a.time - b.time);


    const preCalculated = {
        peakPressure: Math.max(...waveforms.map(p => p.paw)),
        peakVolume: Math.max(...waveforms.map(p => p.volume)),
        peakFlow: Math.max(...waveforms.map(p => p.flow)),
    };

    return { mode, baseSettings, waveforms, cycleDurationMs, preCalculated };
};

const dataCache = new Map<VentilationMode, VentilatorData>();

export const getVentilatorData = async (mode: VentilationMode): Promise<VentilatorData> => {
    if (dataCache.has(mode)) {
        return dataCache.get(mode)!;
    }

    let rawData: string;
    switch (mode) {
        case VentilationMode.VC:
            rawData = vcData;
            break;
        case VentilationMode.PC:
            rawData = pcData;
            break;
        case VentilationMode.PS:
        case VentilationMode.CPAP: // CPAP with spontaneous breaths can be modeled from PS
             rawData = psData;
             break;
        case VentilationMode.SIMV: // SIMV (PC) can use PC data as a base, will be overridden by math model if VC
            rawData = pcData;
            break;
        default:
             // Fallback to PC for any other unhandled modes for safety
            rawData = pcData;
            mode = VentilationMode.PC;
            break;
    }
    
    // In a real app, this would be an async fetch. Here, it's synchronous.
    const parsedData = parseVentilatorData(rawData, mode);
    dataCache.set(mode, parsedData);
    return parsedData;
};


export const generateWaveformPoint = (
    timeMs: number,
    uiCycleDurationMs: number,
    ventData: VentilatorData | null,
    currentParams: AllParameters,
    graphType: 'pressure' | 'volume' | 'flow',
    activeManeuver: ActiveManeuver | null,
    currentMode: VentilationMode // Use UI's current mode
): number => {

    // --- Handle Anesthesia Bag-Mask (Manual) ventilation ---
    // In this state, isMechanicalVentilation is 0. The waveforms should simulate
    // a continuous line with minor oscillations, not a controlled breath.
    if (Number(currentParams.isMechanicalVentilation) === 0) {
        const { peep, secretionsFactor } = currentParams;
        const numPeep = Number(peep) || 0; // In manual mode, PEEP represents the APL valve setting.
        const numSecretionsFactor = Number(secretionsFactor) || 0;

        let baseValue = 0;
        let noiseAmplitude = 0;

        if (graphType === 'pressure') {
            baseValue = numPeep;
            // Create small, random pressure fluctuations around the APL setting.
            // Increase fluctuations if secretions are present.
            noiseAmplitude = numSecretionsFactor > 0 ? 0.4 + Math.random() * 0.6 : 0.1 + Math.random() * 0.2;
        } else if (graphType === 'flow') {
            baseValue = 0;
            // Create minor flow oscillations.
            // Increase oscillations significantly if secretions are present.
            noiseAmplitude = numSecretionsFactor > 0 ? 2 + Math.random() * 3 : 0.5 + Math.random() * 0.5;
        } else if (graphType === 'volume') {
            // In manual mode without active bagging, net volume change is zero.
            return 0;
        }

        // Combine some sine waves for a more organic noise pattern
        const noise = noiseAmplitude * (
            0.6 * Math.sin(2 * Math.PI * 7 * (timeMs / 1000)) + // High frequency component
            0.4 * Math.sin(2 * Math.PI * 2.5 * (timeMs / 1000))   // Low frequency component
        );
        
        return baseValue + noise;
    }

    // --- MANEUVERS (override all other logic) ---
    if (activeManeuver) {
        const peep = Number(currentParams.peep) || 0;
        if (activeManeuver === 'insp_hold') {
            const pplat = Number(currentParams.pPlateau);
            const heldVolume = Number(currentParams.volumeInspired); // Should be held from before maneuver
            if (graphType === 'pressure') return !isNaN(pplat) ? pplat : peep;
            if (graphType === 'flow') return 0;
            if (graphType === 'volume') return heldVolume > 0 ? heldVolume : (pplat - peep) * (Number(currentParams.compliance) || 50);
        }
        if (activeManeuver === 'exp_hold') {
            if (graphType === 'pressure') return peep;
            if (graphType === 'flow' || graphType === 'volume') return 0;
        }
        return 0;
    }
    
    const timeInCycleS = (timeMs / 1000) % (uiCycleDurationMs / 1000);

    // --- PSV MATHEMATICAL MODEL (Corrected) ---
    if (currentMode === VentilationMode.PS || (currentMode === VentilationMode.SIMV && Number(currentParams.psLevel) > 0)) {
        const {
            psLevel, peep, triggerFlow, inspiratoryRiseTimeSeconds, flowCycleOffPercent,
            compliance, resistance, inspiratoryEffortStrength, secretionsFactor
        } = currentParams;

        const numPsLevel = Number(psLevel) || 10;
        const numPeep = Number(peep) || 5;
        const numTriggerFlow = Number(triggerFlow) || 2;
        const numRiseTime = Number(inspiratoryRiseTimeSeconds) || 0;
        const numFlowCyclePercent = Number(flowCycleOffPercent) || 25;
        const numCompliance = Number(compliance) || 50;
        const numResistance = Number(resistance) || 10;
        const numInspEffort = Number(inspiratoryEffortStrength) || 0;
        const numSecretionsFactor = Number(secretionsFactor) || 0;
        
        const TRIGGER_DURATION_S = 0.1;

        if (timeInCycleS < TRIGGER_DURATION_S) {
            const progress = timeInCycleS / TRIGGER_DURATION_S;
            if (graphType === 'pressure') return numPeep - (1 - progress);
            if (graphType === 'flow') return -numTriggerFlow * (1 - progress);
            if (graphType === 'volume') return 0;
        }

        const timeInInspS = timeInCycleS - TRIGGER_DURATION_S;
        
        const RC_insp = (numCompliance / 1000) * numResistance;
        const cycleOffRatio = numFlowCyclePercent / 100;
        const Ti_estimate = RC_insp > 0 ? -RC_insp * Math.log(cycleOffRatio) : 1.0; 

        const Pmusc_max = numInspEffort * 7;
        
        let paw = 0, flow = 0, volume = 0;
        
        if (timeInInspS >= 0 && timeInInspS < Ti_estimate) {
            // --- INSPIRATORY PHASE ---
            const riseTimeConstant = numRiseTime > 0.01 ? numRiseTime / 3 : 0.01;
            const Pvent_above_peep = numPsLevel * (1 - Math.exp(-timeInInspS / riseTimeConstant));
            
            const V_target_ml_approx = (numPsLevel + (Pmusc_max * 0.5)) * numCompliance;
            volume = V_target_ml_approx * (1 - Math.exp(-timeInInspS / RC_insp));
            const Palv_above_peep = numCompliance > 0 ? volume / numCompliance : 0;
            
            paw = numPeep + Pvent_above_peep;
            
            const flow_from_vent_lps = numResistance > 0 ? (Pvent_above_peep - Palv_above_peep) / numResistance : 0;
            
            const Pmusc_sustaining = Pmusc_max * Math.sin((Math.PI * timeInInspS) / Ti_estimate);
            const flow_effort_component = numResistance > 0 ? Pmusc_sustaining / numResistance : 0;
            
            const final_flow_lps = flow_from_vent_lps + flow_effort_component;
            flow = final_flow_lps * 60;
        } else if (timeInInspS >= Ti_estimate) {
            // --- EXPIRATORY PHASE ---
            const timeInExpirationS = timeInInspS - Ti_estimate;
            const RC_exp = RC_insp * 1.2;
            
            const V_at_end_insp_approx = ((numPsLevel + (Pmusc_max * 0.5)) * numCompliance) * (1 - Math.exp(-Ti_estimate / RC_insp));
            const startVolume = V_at_end_insp_approx;
            
            if (RC_exp > 0.01) {
                const startPressureAbovePeep = startVolume / numCompliance;
                const pressureAbovePeep = startPressureAbovePeep * Math.exp(-timeInExpirationS / RC_exp);
                paw = numPeep + pressureAbovePeep;
                flow = -(pressureAbovePeep / numResistance) * 60;
                volume = startVolume * Math.exp(-timeInExpirationS / RC_exp);
            } else {
                volume = 0; paw = numPeep; flow = 0;
            }
        } else {
            paw = numPeep; flow = 0; volume = 0;
        }

        if (numSecretionsFactor > 0 && (graphType === 'flow' || graphType === 'pressure')) {
            const freq1 = 15 + Math.random() * 5; const freq2 = 8 + Math.random() * 3;
            const amplitude = graphType === 'flow' ? numSecretionsFactor * 4 : numSecretionsFactor * 0.5;
            const noise = amplitude * (Math.sin(2 * Math.PI * freq1 * timeInCycleS) + 0.5 * Math.sin(2 * Math.PI * freq2 * timeInCycleS + Math.PI / 3));
            if (graphType === 'pressure') paw += noise;
            if (graphType === 'flow') flow += noise;
        }

        if (graphType === 'pressure') return paw;
        if (graphType === 'flow') return flow;
        if (graphType === 'volume') return volume;
        return 0;
    }


    // --- VCV MATHEMATICAL MODEL ---
    if (currentMode === VentilationMode.VC || (currentMode === VentilationMode.SIMV && Number(currentParams.psLevel) === 0)) {
        const {
            volume: tidalVolume,
            frequency,
            peep,
            ratio,
            inspiratoryPausePercent,
            compliance,
            resistance,
            secretionsFactor
        } = currentParams;

        const numFrequency = Number(frequency) || 12;
        const numTidalVolume = Number(tidalVolume) || 500;
        const numPeep = Number(peep) || 5;
        const numCompliance = Number(compliance) || 50;
        const numResistance = Number(resistance) || 10;
        const numInspPausePercent = Number(inspiratoryPausePercent) || 0;
        const numSecretionsFactor = Number(secretionsFactor) || 0;

        const cycleDurationS = 60 / numFrequency;
        
        const ratioParts = String(ratio).split(':').map(Number);
        const iPart = ratioParts[0] || 1;
        const ePart = ratioParts[1] || 2;
        const inspiratoryFraction = iPart / (iPart + ePart);

        const Ti = cycleDurationS * inspiratoryFraction;
        const inspPauseFraction = numInspPausePercent / 100;
        const Tip = Ti * inspPauseFraction;
        const Tif = Ti - Tip;

        const flowRateLPS = Tif > 0 ? (numTidalVolume / 1000) / Tif : 0;
        const flowRateLPM = flowRateLPS * 60;

        let paw = 0, flow = 0, volume = 0;

        if (timeInCycleS <= Tif) {
            flow = flowRateLPM;
            volume = flowRateLPS * timeInCycleS * 1000;
            const resistivePressure = flowRateLPS * numResistance;
            const elasticPressure = (numCompliance > 0) ? volume / numCompliance : 50;
            paw = numPeep + resistivePressure + elasticPressure;
        } else if (timeInCycleS <= Ti) {
            flow = 0;
            volume = numTidalVolume;
            const elasticPressure = (numCompliance > 0) ? volume / numCompliance : 50;
            paw = numPeep + elasticPressure;
        } else {
            const timeInExpirationS = timeInCycleS - Ti;
            const RC_exp = (numCompliance / 1000) * numResistance;
            
            const startVolume = numTidalVolume;
            const startPressure = (numCompliance > 0) ? startVolume / numCompliance : 50;

            if (RC_exp > 0.01) {
                volume = startVolume * Math.exp(-timeInExpirationS / RC_exp);
                const pressureAbovePeep = startPressure * Math.exp(-timeInExpirationS / RC_exp);
                paw = numPeep + pressureAbovePeep;
                flow = -((volume / 1000) / RC_exp) * 60;
            } else {
                volume = 0; paw = numPeep; flow = 0;
            }
        }

        if (numSecretionsFactor > 0 && (graphType === 'flow' || graphType === 'pressure')) {
            const freq1 = 15 + Math.random() * 5;
            const freq2 = 8 + Math.random() * 3;
            const amplitude = graphType === 'flow' ? numSecretionsFactor * 4 : numSecretionsFactor * 0.5;
            const noise = amplitude * (Math.sin(2 * Math.PI * freq1 * (timeMs / 1000)) + 0.5 * Math.sin(2 * Math.PI * freq2 * (timeMs / 1000) + Math.PI / 3));
            if (graphType === 'pressure') paw += noise;
            if (graphType === 'flow') flow += noise;
        }

        if (graphType === 'pressure') return paw;
        if (graphType === 'flow') return flow;
        if (graphType === 'volume') return volume;
        return 0;
    }


    // --- TEMPLATE-BASED MODEL for PC, etc. ---
    if (!ventData) return 0;
    const { waveforms, cycleDurationMs: baseCycleDurationMs, baseSettings, preCalculated } = ventData;
    if (waveforms.length < 2) return 0;

    const { 
        peep: peepInput,
        pressureTarget: pressureTargetInput,
        compliance: complianceInput,
        secretionsFactor
    } = currentParams;

    const timeInUICycle = timeMs % uiCycleDurationMs;
    const timeScaleFactor = baseCycleDurationMs > 0 ? uiCycleDurationMs / baseCycleDurationMs : 1;
    const timeInBaseDataCycle = timeInUICycle / timeScaleFactor;

    let p1_index = 0;
    for (let i = 0; i < waveforms.length; i++) {
        if (waveforms[i].time <= timeInBaseDataCycle) { p1_index = i; } else { break; }
    }
    const p1 = waveforms[p1_index];
    const p2 = waveforms[(p1_index + 1) % waveforms.length];
    const p1Time = p1.time;
    const p2Time = p2.time < p1Time ? p2.time + baseCycleDurationMs : p2.time;
    const timeDiff = p2Time - p1Time;
    let factor = (timeDiff > 0) ? (timeInBaseDataCycle - p1Time) / timeDiff : 0;
    factor = Math.max(0, Math.min(1, factor));

    const interpolatedPoint = {
        paw: p1.paw + factor * (p2.paw - p1.paw),
        flow: p1.flow + factor * (p2.flow - p1.flow),
        volume: p1.volume + factor * (p2.volume - p1.volume)
    };

    const currentPeep = Number(peepInput) || 0;
    const currentPressureTarget = Number(pressureTargetInput) || 15;
    const currentCompliance = Number(complianceInput) || 50;

    if (currentCompliance === 0) {
        if (graphType === 'pressure') return currentPeep;
        return 0;
    }

    const basePeep = baseSettings.peep ?? 5;
    const basePeakPressure = preCalculated.peakPressure;
    const basePeakVolume = preCalculated.peakVolume;
    
    let scaledValue = 0;

    if (graphType === 'pressure') {
        const baseDrivingPressure = basePeakPressure - basePeep;
        const targetDrivingPressure = currentPressureTarget;
        const scaleFactor = (baseDrivingPressure > 0 && isFinite(baseDrivingPressure)) ? targetDrivingPressure / baseDrivingPressure : 1.0;
        const baseWaveformComponent = interpolatedPoint.paw - basePeep;
        scaledValue = currentPeep + (baseWaveformComponent * scaleFactor);

    } else if (graphType === 'volume' || graphType === 'flow') {
        const targetPeakVolume = currentPressureTarget * currentCompliance;
        const scaleFactor = (basePeakVolume > 0 && isFinite(basePeakVolume)) ? targetPeakVolume / basePeakVolume : 1.0;
        if (graphType === 'volume') scaledValue = interpolatedPoint.volume * scaleFactor;
        else scaledValue = interpolatedPoint.flow * scaleFactor;
    }

    if (secretionsFactor && secretionsFactor > 0 && (graphType === 'flow' || graphType === 'pressure')) {
        const freq1 = 15 + Math.random() * 5;
        const freq2 = 8 + Math.random() * 3;
        const amplitude = graphType === 'flow' ? secretionsFactor * 4 : secretionsFactor * 0.5;
        scaledValue += amplitude * (Math.sin(2 * Math.PI * freq1 * (timeMs / 1000)) + 0.5 * Math.sin(2 * Math.PI * freq2 * (timeMs / 1000) + Math.PI / 3));
    }
    
    return isFinite(scaledValue) ? scaledValue : 0;
};