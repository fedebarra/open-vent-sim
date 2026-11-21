// The animated preview at the top of the README: a few seconds of the teaser's
// strongest moments, cut from the finished video on its beat grid.
// Usage: node scripts/teaser/preview.mjs <teaser.mp4> <out.gif> [bpm]
import { execFileSync } from 'node:child_process';
const [, , VIDEO, OUT, bpmArg] = process.argv;
const B = 60 / Number(bpmArg || 143.55);
// the plan's beats, as in assemble.mjs
const beats = [8, 7, 8, 11, 10, 7, 9, 9, 12, 11, 10, 7, 9, 10, 14, 12, 7, 9, 11, 9, 9, 9, 7, 12, 10, 12];
const starts = [0];
let acc = beats[0] * B;
for (const b of beats.slice(1)) { const off = acc - B; starts.push(off); acc = off + b * B; }
// [clip index, from (s into the clip), length (s)]
const PICK = [[0, 0.8, 2.2], [3, 1.6, 1.8], [8, 1.6, 2.2], [9, 1.2, 1.8], [14, 1.6, 2.8], [15, 1.4, 1.8], [18, 1.6, 2], [21, 1.3, 1.7], [23, 1.4, 1.8], [25, 1.2, 2.6]];
const parts = PICK.map(([i, from, len], k) => `[0:v]trim=start=${(starts[i] + from).toFixed(3)}:duration=${len},setpts=PTS-STARTPTS[s${k}]`);
const concat = `${PICK.map((_, k) => `[s${k}]`).join('')}concat=n=${PICK.length}:v=1:a=0,fps=12,scale=820:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=160:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`;
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', VIDEO, '-filter_complex', [...parts, concat].join(';'), '-loop', '0', OUT], { stdio: 'inherit' });
console.log(OUT);
