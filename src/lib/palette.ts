/**
 * Album-art colour extraction: when a song plays, the whole room takes its colours.
 * Falls back to the song's generated cover colours when there is no artwork or the image host
 * does not allow cross-origin pixel access.
 */
import { useEffect, useState } from 'react';
import { coverColors, hexToRgbTriplet } from './utils';

/** Two colours as "r g b" triplets (ready for `rgb(var / alpha)` and canvas). */
export type Palette = [string, string];

const cache = new Map<string, Palette | null>();

export function seedPalette(seed: string): Palette {
  const [a, b] = coverColors(seed);
  return [hexToRgbTriplet(a), hexToRgbTriplet(b)];
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, max ? d / max : 0, max];
}

function hsvToTriplet(h: number, s: number, v: number): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return `${Math.round((r + m) * 255)} ${Math.round((g + m) * 255)} ${Math.round((b + m) * 255)}`;
}

const hueDist = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

function extract(url: string): Promise<Palette | null> {
  if (cache.has(url)) return Promise.resolve(cache.get(url)!);
  return new Promise((resolve) => {
    const done = (p: Palette | null) => {
      cache.set(url, p);
      resolve(p);
    };
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onerror = () => done(null);
    img.onload = () => {
      try {
        const S = 16;
        const c = document.createElement('canvas');
        c.width = c.height = S;
        const ctx = c.getContext('2d', { willReadFrequently: true })!;
        ctx.drawImage(img, 0, 0, S, S);
        const d = ctx.getImageData(0, 0, S, S).data;
        const px: Array<{ h: number; s: number; v: number; score: number }> = [];
        for (let i = 0; i < d.length; i += 4) {
          const [h, s, v] = rgbToHsv(d[i], d[i + 1], d[i + 2]);
          px.push({ h, s, v, score: s * (0.35 + v * 0.65) });
        }
        px.sort((a, b) => b.score - a.score);
        const first = px[0];
        if (!first || first.score < 0.18) return done(null); // greyscale cover → keep the generated colours
        const second = px.find((p) => hueDist(p.h, first.h) > 40 && p.score > first.score * 0.35);
        // lift to a vivid, screen-friendly range so dark covers still light the room
        const vivid = (p: { h: number; s: number; v: number }) => hsvToTriplet(p.h, Math.max(0.6, p.s), Math.max(0.85, p.v));
        done([vivid(first), second ? vivid(second) : hsvToTriplet((first.h + 45) % 360, Math.max(0.6, first.s), 0.9)]);
      } catch {
        done(null); // tainted canvas
      }
    };
    // a tiny rendition is plenty for colour sampling
    img.src = url.replace(/\/\d+x\d+bb\./, '/60x60bb.');
  });
}

/** Colours for a song: from its artwork when possible, otherwise from its generated cover. */
export function usePalette(song: { artworkUrl: string | null; songTitle: string } | null | undefined): Palette | null {
  const url = song?.artworkUrl ?? null;
  const seed = song?.songTitle ?? null;
  const [palette, setPalette] = useState<Palette | null>(() => (seed ? seedPalette(seed) : null));
  useEffect(() => {
    if (!seed) return setPalette(null);
    setPalette(seedPalette(seed));
    if (!url) return;
    let alive = true;
    extract(url).then((p) => alive && p && setPalette(p));
    return () => {
      alive = false;
    };
  }, [url, seed]);
  return palette;
}
