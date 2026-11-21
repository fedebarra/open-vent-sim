// Turns the raw footage of record.mjs into the teaser.
//
// * Every length is a whole number of beats of the music, and every transition
//   lasts one beat: the cuts fall on the beat.
// * Motion graphics are HTML/CSS animations rendered frame by frame (the Web
//   Animations clock is set for each frame), so they are exact and repeatable:
//   an animated intro and outro, a card for each section, captions that reveal
//   and leave before the cut.
// * Scenes push in slowly towards what matters (the leads, the set flow, the
//   alarm badge). Transitions are ffmpeg's xfade.
// * Audio: the music, with the device's own alarm on top where an alarm really
//   goes off, the music dipping a little under it.
//
// Usage: node scripts/teaser/assemble.mjs <raw-dir> <out.mp4> <music.mp3> [bpm]
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const RAW = path.resolve(process.argv[2]);
const OUT = path.resolve(process.argv[3] || 'open-vent-sim-teaser.mp4');
const MUSIC = process.argv[4] ? path.resolve(process.argv[4]) : null;
const BPM = Number(process.argv[5] || 143.55);
const BEAT = 60 / BPM;
const FPS = 30;
const WORK = path.join(RAW, '_work');
fs.rmSync(WORK, { recursive: true, force: true });
fs.mkdirSync(WORK, { recursive: true });
const ff = (...args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit', maxBuffer: 1 << 26 });
const ICON = 'data:image/png;base64,' + fs.readFileSync(path.resolve('public/icon.png')).toString('base64');

// ---------------------------------------------------------------- the film --
// beats: length; z/fx/fy: push-in target and where to; sound: the alarm is heard
const S = (n, title, sub) => ({ card: 'section', beats: 7, n, title, sub });
const PLAN = [
  { card: 'intro', beats: 8 },
  S('01', 'Three machines', 'one free app'),
  { id: 'machines', beats: 8, tag: '01 · The machines', caption: 'Anaesthesia, ICU ventilator, high flow', z: 1.06, fx: 0.5, fy: 0.45 },
  { id: 'waves', beats: 11, tag: '01 · The machines', caption: 'Waveforms from a real breathing engine', z: 1.1, fx: 0.35, fy: 0.3 },
  { id: 'anaesthesia', beats: 10, tag: '01 · The machines', caption: 'Gases, MAC, bag or ventilator', z: 1.12, fx: 0.5, fy: 0.2 },
  S('02', 'The instructor console', 'you run the case, they read the patient'),
  { id: 'console-live', beats: 9, tag: '02 · The console', caption: 'Every learner’s ventilator, live', z: 1.18, fx: 0.42, fy: 0.25 },
  { id: 'async-pick', beats: 9, tag: '02 · The console', caption: 'One click loads a published case…', z: 1.25, fx: 0.4, fy: 0.62 },
  { id: 'async-learner', beats: 12, tag: '02 · The console', caption: '…learners see the asynchrony, never its name', z: 1.12, fx: 0.3, fy: 0.35 },
  { id: 'alarm', beats: 11, tag: '02 · The console', caption: 'A cough hits the limit: the alarm sounds', z: 1.15, fx: 0.62, fy: 0.08, sound: true },
  { id: 'eit', beats: 10, tag: '02 · The console', caption: 'EIT, loops, oesophageal pressure', z: 1.1, fx: 0.4, fy: 0.45 },
  S('03', 'Neural assist', 'new in 3.8 · NEURO and the EAdi'),
  { id: 'catheter-console', beats: 9, tag: '03 · Neural assist', caption: 'The console mounts the EAdi catheter… too deep', z: 1.22, fx: 0.62, fy: 0.48, accent: true },
  { id: 'catheter-deep', beats: 10, tag: '03 · Neural assist', caption: 'Four oesophageal ECG leads tell where it sits', z: 1.25, fx: 0.25, fy: 0.3, accent: true },
  { id: 'catheter-pull', beats: 14, tag: '03 · Neural assist', caption: 'Pull it into place, one electrode step at a time', z: 1.25, fx: 0.4, fy: 0.3, accent: true },
  { id: 'neuro', beats: 12, tag: '03 · Neural assist', caption: 'Now the pressure follows the diaphragm', z: 1.15, fx: 0.3, fy: 0.85, accent: true },
  S('04', 'NIV & high flow', 'leaks, masks and cannulas'),
  { id: 'niv', beats: 9, tag: '04 · NIV & high flow', caption: 'NIV with a real mask leak', z: 1.08, fx: 0.4, fy: 0.3 },
  { id: 'niv-maskoff', beats: 11, tag: '04 · NIV & high flow', caption: 'Mask off: the machine pauses and alarms', z: 1.22, fx: 0.15, fy: 0.05, sound: true },
  { id: 'hf', beats: 9, tag: '04 · NIV & high flow', caption: 'High flow, with the flow it really delivers', z: 1.1, fx: 0.4, fy: 0.5 },
  { id: 'hf-console', beats: 9, tag: '04 · NIV & high flow', caption: 'The instructor blocks the cannula…', z: 1.25, fx: 0.25, fy: 0.62 },
  { id: 'hf-blocked', beats: 9, tag: '04 · NIV & high flow', caption: '…and the device says so', z: 1.25, fx: 0.1, fy: 0.55, sound: true },
  S('05', 'Built for the classroom', 'on your own network, no install for learners'),
  { id: 'tour', beats: 12, tag: '05 · The classroom', caption: 'A guided tour on every screen', z: 1.12, fx: 0.4, fy: 0.3 },
  { id: 'log', beats: 10, tag: '05 · The classroom', caption: 'A session log for the debriefing', z: 1.12, fx: 0.35, fy: 0.4 },
  { card: 'outro', beats: 12 },
];
const XFADE = BEAT;
// The footage sits in a frame, with a band under it for the captions: a caption
// over the app covered exactly the waveforms people were meant to read.
const FW = 1664, FH = 936, FX = Math.round((1920 - FW) / 2), FY = 24, BAND = 1080 - FY - FH;
const NAVY = '0x0b1220';
// transitions: into a card an iris closes, out of it it opens; between scenes a slide
const transition = (a, b) => (b.card === 'outro' ? 'fadeblack' : b.card ? 'circleclose' : a.card ? 'circleopen' : 'smoothleft');

// ---------------------------------------------------------- motion design --
const CSS = `
  * { margin: 0; box-sizing: border-box; }
  body { width: 1920px; height: 1080px; overflow: hidden; background: transparent;
         font-family: -apple-system, 'SF Pro Display', 'Helvetica Neue', sans-serif; color: #f8fafc; }
  :root { --teal: #2dd4bf; --lime: #d9f99d; --navy: #0b1220; --ease: cubic-bezier(.2,.8,.2,1); }
  .acc { --hi: var(--lime); } .def { --hi: var(--teal); }

  /* caption: in its own band under the footage — never over the waveforms.
     The tag, then a box revealed from the left, words rising one by one. */
  .cap { position: absolute; left: ${FX}px; right: ${FX}px; bottom: ${Math.round((BAND - 76) / 2)}px; display: flex; align-items: center; gap: 18px;
         animation: out .35s ease-in both; animation-delay: calc(var(--d) - .4s); }
  .tag { flex: none; display: inline-block; padding: 8px 18px; border-radius: 999px; font-size: 24px; font-weight: 700;
         letter-spacing: 2px; text-transform: uppercase; color: var(--navy); background: var(--hi);
         animation: pop .35s var(--ease) both .05s; }
  .box { display: flex; align-items: center; gap: 20px; padding: 14px 32px 14px 22px; border-radius: 18px;
         background: #111a2b; border: 1px solid rgba(255,255,255,.08);
         animation: reveal .5s var(--ease) both .15s; }
  .box i { width: 8px; align-self: stretch; border-radius: 4px; background: var(--hi); transform-origin: top; animation: grow .35s var(--ease) both .25s; }
  .box b { font-size: 44px; font-weight: 750; letter-spacing: -.5px; white-space: nowrap; }
  .w { display: inline-block; animation: rise .45s var(--ease) both; }

  /* full-frame cards */
  .card { position: absolute; inset: 0; background: var(--navy); overflow: hidden; }
  .grid { position: absolute; inset: -200px; background-image: linear-gradient(rgba(45,212,191,.07) 1px, transparent 1px),
          linear-gradient(90deg, rgba(45,212,191,.07) 1px, transparent 1px); background-size: 80px 80px; animation: drift 4s linear both; }
  .blob { position: absolute; width: 900px; height: 900px; border-radius: 50%; filter: blur(140px); opacity: .55;
          background: var(--hi); animation: float 4s ease-in-out both; }
  .wave { position: absolute; left: 0; right: 0; bottom: 70px; height: 160px; opacity: .5; }
  .wave path { fill: none; stroke: var(--hi); stroke-width: 4; stroke-dasharray: 2600; stroke-dashoffset: 2600; animation: draw 1.6s var(--ease) both .2s; }
  .center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 26px; text-align: center; }
  .sec { position: absolute; left: 160px; top: 0; bottom: 0; display: flex; flex-direction: column; justify-content: center; gap: 22px; }
  .num { font-size: 220px; font-weight: 900; line-height: .9; color: transparent; -webkit-text-stroke: 3px var(--hi);
         animation: slide .6s var(--ease) both; }
  .title { font-size: 120px; font-weight: 850; letter-spacing: -3px; line-height: 1; }
  .line { height: 8px; width: 520px; border-radius: 4px; background: var(--hi); transform-origin: left; animation: sweep .6s var(--ease) both .35s; }
  .sub { font-size: 44px; color: #cbd5e1; animation: fade .5s ease both .6s; }
  .leave { animation: away .4s ease-in both; animation-delay: calc(var(--d) - .45s); }
  .logo { width: 190px; height: 190px; border-radius: 40px; box-shadow: 0 30px 80px rgba(45,212,191,.35); animation: popin .7s cubic-bezier(.3,1.6,.5,1) both; }
  .brand { font-size: 136px; font-weight: 850; letter-spacing: -4px; }
  .badge { display: inline-block; margin-left: 18px; padding: 4px 26px; border-radius: 24px; background: var(--teal); color: var(--navy);
           animation: popin .5s cubic-bezier(.3,1.6,.5,1) both .9s; }
  .ch { display: inline-block; animation: rise .5s var(--ease) both; }
  .pills { display: flex; gap: 20px; }
  .pills span { font-size: 38px; font-weight: 600; padding: 14px 32px; border-radius: 999px; border: 2px solid var(--teal); animation: popin .45s cubic-bezier(.3,1.6,.5,1) both; }
  .link { font-size: 54px; font-weight: 800; color: var(--teal); animation: reveal .7s var(--ease) both 1.3s; }
  .small { font-size: 32px; color: #94a3b8; animation: fade .5s ease both 1.9s; }

  @keyframes out { to { opacity: 0; transform: translateY(24px); } }
  @keyframes away { to { opacity: 0; transform: translateY(-40px); } }
  @keyframes pop { from { opacity: 0; transform: translateY(16px) scale(.9); } }
  @keyframes popin { from { opacity: 0; transform: scale(.4); } }
  @keyframes reveal { from { clip-path: inset(0 100% 0 0 round 20px); } to { clip-path: inset(0 0 0 0 round 20px); } }
  @keyframes grow { from { transform: scaleY(0); } }
  @keyframes rise { from { opacity: 0; transform: translateY(46px); } }
  @keyframes slide { from { opacity: 0; transform: translateX(-120px); } }
  @keyframes sweep { from { transform: scaleX(0); } }
  @keyframes fade { from { opacity: 0; } }
  @keyframes drift { to { transform: translate(80px, 80px); } }
  @keyframes float { from { transform: translate(-200px, -100px) scale(.8); } to { transform: translate(150px, 60px) scale(1.1); } }
  @keyframes draw { to { stroke-dashoffset: 0; } }
`;
const words = (t, d0, step) => t.split(' ').map((w, k) => `<span class="w" style="animation-delay:${(d0 + k * step).toFixed(2)}s">${w}</span>`).join(' ');
const chars = (t, d0, step) => [...t].map((c, k) => (c === ' ' ? ' ' : `<span class="ch" style="animation-delay:${(d0 + k * step).toFixed(2)}s">${c}</span>`)).join('');
// a breath, drawn: the Paw of one pressure-supported breath
const WAVE = `<svg class="wave" viewBox="0 0 1920 160" preserveAspectRatio="none"><path d="M0 130 L180 130 C220 130 230 30 280 30 L620 30 C660 30 680 130 760 130 L1140 130 C1180 130 1190 30 1240 30 L1580 30 C1620 30 1640 130 1720 130 L1920 130"/></svg>`;
function html(s, d) {
  const theme = s.accent || s.n === '03' ? 'acc' : 'def';
  if (s.card === 'intro') {
    return `<div class="card def" style="--d:${d}s"><div class="grid"></div><div class="blob" style="left:520px;top:-200px"></div>${WAVE}
      <div class="center leave"><img class="logo" src="${ICON}"><div class="brand">${chars('Open Vent Sim', 0.35, 0.04)}<span class="badge">3.8</span></div>
      <div class="sub" style="animation-delay:1.2s">Realistic, Interactive Ventilator Simulator for VEMS and High-Fidelity Simulation</div></div></div>`;
  }
  if (s.card === 'outro') {
    const pills = ['Free', 'Open source', 'Runs on your classroom network'].map((p, k) => `<span style="animation-delay:${(0.5 + k * 0.2).toFixed(2)}s">${p}</span>`).join('');
    return `<div class="card def" style="--d:${d}s"><div class="grid"></div><div class="blob" style="left:500px;top:300px"></div>
      <div class="center"><img class="logo" src="${ICON}"><div class="pills">${pills}</div>
      <div class="link">github.com/fedebarra/open-vent-sim</div><div class="small">For teaching only — not a medical device</div></div></div>`;
  }
  if (s.card === 'section') {
    return `<div class="card ${theme}" style="--d:${d}s"><div class="grid"></div><div class="blob" style="left:900px;top:100px"></div>${WAVE}
      <div class="sec leave"><div class="num">${s.n}</div><div class="title">${words(s.title, 0.2, 0.08)}</div><div class="line"></div><div class="sub">${s.sub}</div></div></div>`;
  }
  return `<div class="cap ${theme}" style="--d:${d}s"><div class="tag">${s.tag}</div>
    <div class="box"><i></i><b>${words(s.caption, 0.3, 0.06)}</b></div></div>`;
}

// ---------------------------------------------- render the motion graphics --
const b = await chromium.launch();
const pg = await (await b.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
for (const [i, s] of PLAN.entries()) {
  const d = s.beats * BEAT;
  const dir = path.join(WORK, `mg-${String(i).padStart(2, '0')}`);
  fs.mkdirSync(dir);
  await pg.setContent(`<html><head><style>${CSS}</style></head><body>${html(s, d.toFixed(3))}</body></html>`);
  await pg.evaluate(() => document.fonts.ready);
  const n = Math.round(d * FPS);
  for (let f = 0; f < n; f++) {
    await pg.evaluate((ms) => document.getAnimations().forEach((a) => { a.pause(); a.currentTime = ms; }), (f / FPS) * 1000);
    await pg.screenshot({ path: path.join(dir, `${String(f).padStart(4, '0')}.png`), omitBackground: !s.card });
  }
  process.stdout.write(`mg ${i + 1}/${PLAN.length}\r`);
}
await b.close();
console.log();

// ------------------------------------------------- one clip per step, alike --
const clips = [];
for (const [i, s] of PLAN.entries()) {
  const d = s.beats * BEAT;
  const k = String(i).padStart(2, '0');
  const clip = path.join(WORK, `clip-${k}.mp4`);
  const mg = path.join(WORK, `mg-${k}`, '%04d.png');
  if (s.card) {
    ff('-framerate', String(FPS), '-i', mg, '-vf', 'format=yuv420p,settb=1/30', '-t', d.toFixed(3), '-c:v', 'libx264', '-crf', '15', '-preset', 'slow', '-r', String(FPS), clip);
  } else {
    // the push-in: from 1 to z in a second and a half, eased, towards (fx, fy)
    const ramp = `min(1,on/${Math.round(1.5 * FPS)})`;
    const zoom = `1+${(s.z - 1).toFixed(3)}*(${ramp}*${ramp}*(3-2*${ramp}))`;
    ff('-f', 'concat', '-safe', '0', '-i', path.join(RAW, s.id, 'frames.txt'), '-framerate', String(FPS), '-i', mg,
      '-filter_complex',
      `[0:v]fps=${FPS},scale=3840:2160:flags=lanczos,zoompan=z='${zoom}':x='(iw-iw/zoom)*${s.fx}':y='(ih-ih/zoom)*${s.fy}':d=1:s=${FW}x${FH}:fps=${FPS},` +
      `trim=duration=${d.toFixed(3)},setpts=PTS-STARTPTS,pad=1920:1080:${FX}:${FY}:color=${NAVY}[v];[v][1:v]overlay=0:0:shortest=1,format=yuv420p,settb=1/30[out]`,
      '-map', '[out]', '-t', d.toFixed(3), '-c:v', 'libx264', '-crf', '15', '-preset', 'slow', '-r', String(FPS), clip);
  }
  clips.push({ clip, d, s });
  process.stdout.write(`clip ${i + 1}/${PLAN.length}\r`);
}
console.log();

// ---------------------------------------------- transitions on the beat --
const inputs = clips.flatMap((c) => ['-i', c.clip]);
const chain = [];
let prev = '[0:v]';
let acc = clips[0].d;
const starts = [0];
for (let i = 1; i < clips.length; i++) {
  const offset = acc - XFADE;
  starts.push(offset);
  const out = i === clips.length - 1 ? '[vout]' : `[x${i}]`;
  chain.push(`${prev}[${i}:v]xfade=transition=${transition(clips[i - 1].s, clips[i].s)}:duration=${XFADE.toFixed(3)}:offset=${offset.toFixed(3)}${out}`);
  prev = out;
  acc = offset + clips[i].d;
}
const total = acc;
const video = path.join(WORK, 'video.mp4');
ff(...inputs, '-filter_complex', chain.join(';'), '-map', '[vout]', '-c:v', 'libx264', '-crf', '17', '-preset', 'slow', '-pix_fmt', 'yuv420p', video);

// ---------------------------------------------- music and the device's alarm --
const alarms = clips.map((c, i) => ({ c, at: starts[i] })).filter((x) => x.c.s.sound).map((x) => ({ at: x.at + XFADE, len: x.c.d - 2 * XFADE }));
const ain = [];
const parts = [];
let n = 0;
let musicLabel = null;
if (MUSIC) {
  ain.push('-i', MUSIC);
  const dips = alarms.map((a) => `between(t,${a.at.toFixed(2)},${(a.at + a.len).toFixed(2)})`).join('+') || '0';
  parts.push(`[${n + 1}:a]atrim=0:${total.toFixed(3)},volume='if(${dips},0.55,0.9)':eval=frame,afade=t=out:st=${(total - 2.5).toFixed(2)}:d=2.5[m]`);
  musicLabel = '[m]';
  n++;
}
alarms.forEach((a, k) => {
  ain.push('-i', path.resolve('public/alarm.mp3'));
  const ms = Math.round(a.at * 1000);
  parts.push(`[${n + 1}:a]atrim=0:${a.len.toFixed(2)},afade=t=in:d=0.1,afade=t=out:st=${(a.len - 0.4).toFixed(2)}:d=0.4,volume=0.8,adelay=${ms}|${ms}[a${k}]`);
  n++;
});
const labels = [musicLabel, ...alarms.map((_, k) => `[a${k}]`)].filter(Boolean);
parts.push(`${labels.join('')}amix=inputs=${labels.length}:normalize=0:duration=longest,atrim=0:${total.toFixed(3)}[aout]`);
ff('-i', video, ...ain, '-filter_complex', parts.join(';'), '-map', '0:v', '-map', '[aout]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', OUT);
console.log(OUT, `${total.toFixed(1)} s`);
