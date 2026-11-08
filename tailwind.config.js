/** @type {import('tailwindcss').Config} */
// Some components build class names at runtime from the theme (e.g. `ring-${accent}`).
// The old CDN build generated them on the fly; the offline build needs them listed here.
const HEX = ['#9b59b6', '#ffc107', '#2196f3', '#9e9e9e', '#4caf50', '#ff9800', '#9c27b0', '#00bcd4', '#ffeb3b', '#000000', '#ffffff'];
const arbitrary = HEX.flatMap((h) => [
  `ring-[${h}]`, `bg-[${h}]/30`, `text-[${h}]`, `text-[${h}]/70`, `bg-[${h}20]`, `hover:bg-[${h}30]`, `border-[${h}]`, `bg-[${h}]`,
]);

export default {
  content: ['./index.html', './*.tsx', './components/**/*.tsx', './src/**/*.{ts,tsx}', './remote/**/*.{ts,tsx}', './constants.ts'],
  future: { hoverOnlyWhenSupported: true },
  safelist: [
    ...arbitrary,
    { pattern: /^(bg|text|border|ring|from|to)-(amber|neutral|sky|teal|gray|yellow)-(300|400|500|600|700)$/, variants: ['hover', 'focus'] },
    { pattern: /^(bg|border|shadow)-(amber|neutral|sky|teal)-(500|600|700)\/(10|20|30|50|60|70|80)$/ },
    { pattern: /^text-(black|white)$/ },
  ],
  theme: { extend: {} },
  plugins: [],
};
