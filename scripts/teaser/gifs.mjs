// README GIFs from the raw footage of record.mjs: a few seconds of each key
// feature, 1280 px wide, 12 fps, one palette per GIF.
// Usage: node scripts/teaser/gifs.mjs <raw-dir> <out-dir> <suffix>
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [, , RAW, OUT, SFX = ''] = process.argv;
fs.mkdirSync(OUT, { recursive: true });
// name: [scene, from, seconds]
const GIFS = {
  'g1-waves': ['waves', 0, 5],
  'g2-asynchrony': ['async-learner', 0, 5.5],
  'g3-cough-alarm': ['alarm', 0, 4.5],
  'g4-eit': ['eit', 0, 4.5],
  'g5-catheter': ['catheter-pull', 0, 6.5],
  'g6-neuro': ['neuro', 0, 5],
  'g7-niv-mask-off': ['niv-maskoff', 0, 4.5],
  'g8-highflow': ['hf-blocked', 0, 4],
  'g9-tour': ['tour', 0, 5.5],
};
for (const [name, [scene, from, secs]] of Object.entries(GIFS)) {
  const out = path.join(OUT, `${name}${SFX}.gif`);
  const chain = `fps=12,scale=1280:-1:flags=lanczos,trim=start=${from}:duration=${secs},setpts=PTS-STARTPTS`;
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', path.join(RAW, scene, 'frames.txt'),
    '-filter_complex', `[0:v]${chain},split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`,
    '-loop', '0', out]);
  console.log(name, `${(fs.statSync(out).size / 1e6).toFixed(1)} MB`);
}
