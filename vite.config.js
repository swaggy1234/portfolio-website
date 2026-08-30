import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function isValidPdf(filePath) {
  try {
    if (!fs.existsSync(filePath) || fs.statSync(filePath).size < 10_000) return false;
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(5);
    fs.readSync(fd, buf, 0, 5, 0);
    fs.closeSync(fd);
    return buf.toString('utf8') === '%PDF-';
  } catch {
    return false;
  }
}

function ensureRoboticsPdf() {
  const root = path.resolve(process.cwd());
  const cacheDir = path.resolve(os.homedir(), '.cache/portfolio-website');
  const cacheFile = path.resolve(cacheDir, 'robotics-presentation.pdf');
  const publicFile = path.resolve(root, 'public/robotics-presentation.pdf');
  const publicStub = path.resolve(root, 'public/.robotics-presentation.pdf.icloud');
  const sources = [
    cacheFile,
    path.resolve(os.homedir(), 'Downloads/Presentation - Copy.pdf'),
    publicFile,
    path.resolve(root, 'public/docs/robotics-demonstration-retrieval.pdf'),
  ];

  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  if (!fs.existsSync(path.dirname(publicFile))) {
    fs.mkdirSync(path.dirname(publicFile), { recursive: true });
  }

  if (fs.existsSync(publicStub)) {
    try {
      fs.unlinkSync(publicStub);
    } catch {
      /* ignore */
    }
  }

  const source = sources.find((candidate) => isValidPdf(candidate));
  if (!source) {
    console.warn(
      '[ensure-robotics-pdf] Missing Presentation PDF. Put it at ~/Downloads/Presentation - Copy.pdf'
    );
    return cacheFile;
  }

  if (!isValidPdf(cacheFile) || fs.statSync(cacheFile).size !== fs.statSync(source).size) {
    if (source !== cacheFile) {
      fs.copyFileSync(source, cacheFile);
      console.log(`[ensure-robotics-pdf] Cached PDF at ${cacheFile}`);
    }
  }

  if (!isValidPdf(publicFile) || fs.statSync(publicFile).size !== fs.statSync(cacheFile).size) {
    fs.copyFileSync(cacheFile, publicFile);
    console.log('[ensure-robotics-pdf] Restored public/robotics-presentation.pdf');
  }

  return cacheFile;
}

function ensureRoboticsPdfPlugin() {
  return {
    name: 'ensure-robotics-pdf',
    buildStart() {
      ensureRoboticsPdf();
    },
    configureServer(server) {
      const cacheFile = ensureRoboticsPdf();

      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0];
        if (url !== '/robotics-presentation.pdf') {
          next();
          return;
        }

        const filePath = ensureRoboticsPdf();
        if (!isValidPdf(filePath)) {
          res.statusCode = 404;
          res.end('PDF not found');
          return;
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Length', fs.statSync(filePath).size);
        res.setHeader('Cache-Control', 'no-cache');
        fs.createReadStream(filePath).pipe(res);
      });

      console.log(`[ensure-robotics-pdf] Serving /robotics-presentation.pdf from ${cacheFile}`);
    },
  };
}

function ensureVispromPaper() {
  const root = path.resolve(process.cwd());
  const cacheDir = path.resolve(os.homedir(), '.cache/portfolio-website');
  const cacheFile = path.resolve(cacheDir, 'visprom-final-paper.pdf');
  const publicFile = path.resolve(root, 'public/visprom-final-paper.pdf');
  const fixScript = path.resolve(root, 'scripts/fix-visprom-paper-title.py');
  const paperTitle = 'Visprom++';
  const sources = [
    cacheFile,
    path.resolve(os.homedir(), 'Desktop/Visprom++ Final Paper.pdf'),
    publicFile,
  ];

  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

  const source = sources.find((candidate) => isValidPdf(candidate));
  if (!source) {
    console.warn(
      '[ensure-visprom-paper] Missing VisProm++ paper. Put it on Desktop as "Visprom++ Final Paper.pdf"'
    );
    return cacheFile;
  }

  function writeTitledCopy(fromFile, toFile) {
    if (fs.existsSync(fixScript)) {
      try {
        execSync(
          `python3 ${JSON.stringify(fixScript)} ${JSON.stringify(fromFile)} ${JSON.stringify(toFile)} ${JSON.stringify(paperTitle)}`,
          { stdio: 'pipe' }
        );
        return;
      } catch {
        /* fall back to raw copy */
      }
    }
    if (fromFile !== toFile) fs.copyFileSync(fromFile, toFile);
  }

  if (!isValidPdf(cacheFile) || fileSize(cacheFile) !== fileSize(source)) {
    if (source !== cacheFile) writeTitledCopy(source, cacheFile);
  }

  if (!isValidPdf(publicFile) || fileSize(publicFile) !== fileSize(cacheFile)) {
    writeTitledCopy(cacheFile, publicFile);
  } else if (fs.existsSync(fixScript) && process.env.VERCEL !== '1') {
    writeTitledCopy(publicFile, publicFile);
  }

  return cacheFile;
}

function fileSize(filePath) {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
}

/** Serve the VisProm++ paper PDF in dev. */
function vispromPaperPlugin() {
  return {
    name: 'visprom-paper',
    buildStart() {
      ensureVispromPaper();
    },
    configureServer(server) {
      const paperFile = ensureVispromPaper();

      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0];

        if (url === '/visprom-final-paper.pdf') {
          const filePath = ensureVispromPaper();
          if (!isValidPdf(filePath)) {
            res.statusCode = 404;
            res.end('PDF not found');
            return;
          }
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Length', fs.statSync(filePath).size);
          res.setHeader('Cache-Control', 'no-cache');
          fs.createReadStream(filePath).pipe(res);
          return;
        }

        next();
      });

      console.log(`[visprom-paper] Serving /visprom-final-paper.pdf from ${paperFile}`);
    },
  };
}

/** Proxy Yahoo Finance APIs (same backend yfinance uses) for the stock demo. */
function yahooFinanceProxyPlugin() {
  return {
    name: 'yahoo-finance-proxy',
    configureServer(server) {
      server.middlewares.use('/api/yahoo', async (req, res, next) => {
        try {
          const incoming = new URL(req.url || '', 'http://localhost');

          // /api/yahoo/search?q=apple
          if (incoming.pathname === '/search' || incoming.pathname === '/search/') {
            const q = incoming.searchParams.get('q') || '';
            const target = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
              q
            )}&quotesCount=12&newsCount=0&listsCount=0`;
            const upstream = await fetch(target, {
              headers: {
                'User-Agent': 'Mozilla/5.0',
                Accept: 'application/json',
              },
            });
            const text = await upstream.text();
            res.statusCode = upstream.status;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Cache-Control', 'public, max-age=30');
            res.end(text);
            return;
          }

          // /api/yahoo/quote?symbols=AAPL,MSFT,GOOGL
          if (incoming.pathname === '/quote' || incoming.pathname === '/quote/') {
            const symbols = (incoming.searchParams.get('symbols') || 'AAPL').toUpperCase();
            const target = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(
              symbols
            )}`;
            const upstream = await fetch(target, {
              headers: {
                'User-Agent': 'Mozilla/5.0',
                Accept: 'application/json',
              },
            });
            const text = await upstream.text();
            res.statusCode = upstream.status;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Cache-Control', 'no-store');
            res.end(text);
            return;
          }

          // /api/yahoo/chart/AAPL?range=1y&interval=1d
          const match = incoming.pathname.match(/^\/chart\/([A-Za-z0-9.^=-]+)$/);
          if (!match) {
            next();
            return;
          }

          const ticker = match[1].toUpperCase();
          const range = incoming.searchParams.get('range') || '1y';
          const interval = incoming.searchParams.get('interval') || '1d';
          const target = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
            ticker
          )}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}&includePrePost=true`;

          const upstream = await fetch(target, {
            headers: {
              'User-Agent': 'Mozilla/5.0',
              Accept: 'application/json',
            },
          });

          const text = await upstream.text();
          res.statusCode = upstream.status;
          res.setHeader('Content-Type', 'application/json');
          // Intraday must not be cached or the line freezes
          res.setHeader(
            'Cache-Control',
            interval.includes('m') || range === '1d' ? 'no-store' : 'public, max-age=30'
          );
          res.end(text);
        } catch (error) {
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: String(error) }));
        }
      });
    },
  };
}

function restoreVideosPlugin() {
  const VIDEO_FILES = [
    'public/videos/hero-koi.mp4',
    'public/videos/hero-pour.mp4',
    'public/videos/intro-pour.mp4',
    'public/gallery/process.mp4',
    'public/gallery/pierrot-process.mp4',
  ];

  function restore() {
    const root = path.resolve(process.cwd());
    let restored = 0;
    for (const f of VIDEO_FILES) {
      const full = path.resolve(root, f);
      let needsRestore = false;
      try {
        if (!fs.existsSync(full)) needsRestore = true;
        else if (fs.statSync(full).size < 1024) needsRestore = true;
      } catch { needsRestore = true; }
      if (needsRestore) {
        try {
          execSync(`git checkout HEAD -- "${f}"`, { cwd: root, stdio: 'pipe' });
          console.log(`[restore-videos] Restored ${f}`);
          restored++;
        } catch {
          console.warn(`[restore-videos] Could not restore ${f}`);
        }
      }
    }
    if (restored > 0) console.log(`[restore-videos] Restored ${restored} video(s).`);
  }

  return {
    name: 'restore-videos',
    buildStart() { restore(); },
    configureServer() { restore(); },
  };
}

function lockLayoutPlugin() {
  return {
    name: 'lock-layout',
    configureServer(server) {
      server.middlewares.use('/__lock-layout', (req, res, next) => {
        if (req.method !== 'POST') {
          next();
          return;
        }

        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', () => {
          try {
            const payload = JSON.parse(body);
            const { stickers, layouts } = payload;

            if (!Array.isArray(stickers) || !layouts || typeof layouts !== 'object') {
              throw new Error('Invalid payload — expected { stickers, layouts }');
            }

            const filePath = path.resolve(server.config.root, 'src/data/layoutEdit.js');

            const formatLayoutEntry = (id, box) => {
              const key = /^[a-zA-Z_$][\w$]*$/.test(id) ? id : `'${id}'`;
              const flip = box.flipX ? 'true' : 'false';
              const aspect = Number(box.aspectRatio);
              const aspectExpr = Number.isFinite(aspect)
                ? aspect.toFixed(6).replace(/\.?0+$/, '')
                : '1';

              return `  ${key}: {
    xPercent: ${Number(box.xPercent).toFixed(2)},
    yPercent: ${Number(box.yPercent).toFixed(2)},
    widthPercent: ${Number(box.widthPercent).toFixed(2)},
    rotation: ${Math.round(box.rotation || 0)},
    flipX: ${flip},
    aspectRatio: ${aspectExpr},
  },`;
            };

            const stickerEntries = stickers
              .map(({ id, type }) => `  { id: '${id}', type: '${type}' },`)
              .join('\n');

            const layoutEntries = Object.entries(layouts)
              .map(([id, box]) => formatLayoutEntry(id, box))
              .join('\n');

            const contents = `/**
 * LAYOUT EDIT MODE
 * Set LAYOUT_EDIT_MODE to true to drag/resize/rotate stickers in the browser.
 * Set to false to lock final positions (no handles, no panel).
 *
 * Values are PERCENTAGES of the hero size so the layout keeps the same
 * ratio on every screen.
 */

export const LAYOUT_EDIT_MODE = false;

export const HERO_BACKGROUND = '/images/hero-background.png';

/** Sticker type templates — used when adding new flowers in edit mode */
export const STICKER_TEMPLATES = {
  tiger: {
    src: '/images/Firefly.png',
    className: 'hero__sticker hero__sticker--tiger',
    aspectRatio: 736 / 1104,
    motionDepth: 1,
  },
  flower: {
    src: '/images/flower.png',
    className: 'hero__sticker hero__sticker--flower',
    aspectRatio: 426 / 589,
    motionDepth: 0.55,
  },
  flower2: {
    src: '/images/flower-2.png',
    className: 'hero__sticker hero__sticker--flower',
    aspectRatio: 360 / 393,
    motionDepth: 0.5,
  },
};

/**
 * All stickers on the hero (tigers + flowers).
 * type → key in STICKER_TEMPLATES
 */
export const STICKERS = [
${stickerEntries}
];

export const STICKER_LAYOUTS = {
${layoutEntries}
};

/** Resolve a sticker entry into render props */
export function resolveSticker(sticker) {
  const template = STICKER_TEMPLATES[sticker.type];
  if (!template) return null;
  return {
    id: sticker.id,
    type: sticker.type,
    src: template.src,
    className: template.className,
    motionDepth: template.motionDepth,
    layout: STICKER_LAYOUTS[sticker.id] || {
      xPercent: 40,
      yPercent: 40,
      widthPercent: 12,
      rotation: 0,
      flipX: false,
      aspectRatio: template.aspectRatio,
    },
  };
}
`;

            fs.writeFileSync(filePath, contents, 'utf8');
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true }));
          } catch (error) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: false, error: String(error) }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    restoreVideosPlugin(),
    ensureRoboticsPdfPlugin(),
    vispromPaperPlugin(),
    yahooFinanceProxyPlugin(),
    lockLayoutPlugin(),
  ],
  assetsInclude: ['**/*.pdf'],
  server: {
    watch: {
      usePolling: true,
      interval: 400,
    },
  },
});
