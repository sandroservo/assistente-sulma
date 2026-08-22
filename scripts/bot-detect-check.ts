/**
 * Self-check da detecção de bot por timing. Roda: npx tsx scripts/bot-detect-check.ts
 */
import assert from "assert";
import { countRapidTurns } from "../src/lib/bot-detect";

const RAPID = 90_000;
const t = (base: number, s: number) => new Date(base + s * 1000);
const T0 = 1_700_000_000_000;

// Loop bot-vs-bot: out→in rápidos, 3 seguidos
const loop = [
  { direction: "out", createdAt: t(T0, 0) },
  { direction: "in", createdAt: t(T0, 20) },   // rápido (20s)
  { direction: "out", createdAt: t(T0, 30) },
  { direction: "in", createdAt: t(T0, 45) },   // rápido
  { direction: "out", createdAt: t(T0, 60) },
  { direction: "in", createdAt: t(T0, 80) },   // rápido -> streak 3
];
assert.strictEqual(countRapidTurns(loop, RAPID), 3, "loop bot deve dar 3 trocas rápidas");

// Humano: responde devagar (minutos) -> não conta
const humano = [
  { direction: "out", createdAt: t(T0, 0) },
  { direction: "in", createdAt: t(T0, 600) },  // 10 min depois
  { direction: "out", createdAt: t(T0, 660) },
  { direction: "in", createdAt: t(T0, 1200) }, // 9 min
];
assert.strictEqual(countRapidTurns(humano, RAPID), 0, "humano lento não dispara");

// Misto: 1 rápida, quebra, 2 rápidas -> maior streak 2 (não dispara com min 3)
const misto = [
  { direction: "out", createdAt: t(T0, 0) },
  { direction: "in", createdAt: t(T0, 10) },   // rápida (streak 1)
  { direction: "out", createdAt: t(T0, 20) },
  { direction: "in", createdAt: t(T0, 500) },  // lenta -> zera
  { direction: "out", createdAt: t(T0, 520) },
  { direction: "in", createdAt: t(T0, 530) },  // rápida (streak 1)
  { direction: "out", createdAt: t(T0, 540) },
  { direction: "in", createdAt: t(T0, 550) },  // rápida (streak 2)
];
assert.strictEqual(countRapidTurns(misto, RAPID), 2, "streak máximo 2 no misto");

console.log("OK — bot-detect self-check passou");
