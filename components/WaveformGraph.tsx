import React from 'react';

// This component is now a simple, forward-ref-enabled canvas container.
// All drawing logic has been moved to the parent GraphsPanel to ensure
// perfect synchronization between the three waveforms.
const WaveformGraph = React.forwardRef<HTMLCanvasElement, {}>((props, ref) => {
  return (
    <div className="bg-gray-800 border-2 border-gray-700/50 rounded-lg relative overflow-hidden h-full shadow-inner flex flex-col">
      <canvas ref={ref} className="w-full h-full block" />
    </div>
  );
});

export { WaveformGraph };
