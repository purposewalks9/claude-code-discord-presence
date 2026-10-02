// Finding the active model and turning its id into a display name ("claude-opus-5-5" -> "Opus 5.5").
const fs = require('fs');

const TRANSCRIPT_TAIL_BYTES = 256 * 1024;
const DATE_SUFFIX = /^\d{8}$/; // e.g. 20251001

/**
 * Display name for a model id, or null for ids that aren't real models (like "<synthetic>").
 *   claude-opus-5-5[1m]         -> Opus 5.5
 *   claude-haiku-4-5-20251001   -> Haiku 4.5
 *   claude-3-5-sonnet-20241022  -> Sonnet 3.5
 * Ids without a family name are returned unchanged.
 * @param {unknown} modelId
 * @returns {string | null}
 */
function formatModelName(modelId) {
  if (!modelId || typeof modelId !== 'string' || modelId.startsWith('<')) return null;
  const parts = modelId
    .replace(/\[.*\]$/, '') // context-window suffix like [1m]
    .replace(/^claude-/, '')
    .split('-')
    .filter((part) => !DATE_SUFFIX.test(part));

  const family = parts.find((part) => /^[a-z]+$/i.test(part));
  if (!family) return modelId;
  const version = parts.filter((part) => /^\d+$/.test(part)).join('.');
  const name = family[0].toUpperCase() + family.slice(1);
  return version ? `${name} ${version}` : name;
}

/**
 * Id of the latest model used in a session, read from the tail of its transcript (JSONL).
 * @param {string | undefined} transcriptPath
 * @returns {string | null}
 */
function readModelFromTranscript(transcriptPath) {
  if (!transcriptPath) return null;
  try {
    const tail = readFileTail(transcriptPath, TRANSCRIPT_TAIL_BYTES);
    const matches = [...tail.matchAll(/"model":"(claude-[^"]+)"/g)];
    return matches.length ? matches[matches.length - 1][1] : null;
  } catch {
    return null;
  }
}

function readFileTail(file, maxBytes) {
  const fd = fs.openSync(file, 'r');
  try {
    const size = fs.fstatSync(fd).size;
    const length = Math.min(size, maxBytes);
    const buffer = Buffer.alloc(length);
    fs.readSync(fd, buffer, 0, length, size - length);
    return buffer.toString();
  } finally {
    fs.closeSync(fd);
  }
}

module.exports = { formatModelName, readModelFromTranscript };
