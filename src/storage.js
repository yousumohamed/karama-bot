import dns from 'node:dns';
import fs from 'node:fs';
import path from 'node:path';
import { MongoClient } from 'mongodb';
import { DATA_DIR, IMAGES_DIR, MONGODB_DB, MONGODB_URI } from './config.js';

// Collections:
//   guilds: { _id: guildId, [section]: {...} }   — all loaded into memory at startup
//   images: { _id: fileName, contentType, data }  — uploaded welcome images, loaded on demand
let guildsCol;
let imagesCol;
const guilds = new Map();

// Writes run one at a time so quick successive changes land in the right order.
let writeTail = Promise.resolve();
function enqueue(op) {
  const run = writeTail.then(op);
  writeTail = run.catch((err) => console.error('[storage] write failed:', err.message));
  return run;
}

async function connectClient() {
  try {
    return await new MongoClient(MONGODB_URI).connect();
  } catch (err) {
    // Some Windows setups point Node at a local DNS proxy that refuses the SRV lookup
    // mongodb+srv:// needs. Retry once through public DNS.
    if (err.syscall !== 'querySrv') throw err;
    console.warn(`[storage] SRV lookup failed (${err.code}), retrying with public DNS`);
    dns.setServers(['1.1.1.1', '8.8.8.8']);
    return new MongoClient(MONGODB_URI).connect();
  }
}

export async function connectStorage() {
  const client = await connectClient();
  const db = client.db(MONGODB_DB);
  guildsCol = db.collection('guilds');
  imagesCol = db.collection('images');

  await importLocalData();

  for await (const { _id, ...sections } of guildsCol.find()) guilds.set(_id, sections);
  console.log(`🗄️ Connected to MongoDB (${guilds.size} server settings loaded)`);
}

// ─── Guild settings ──────────────────────────────────────────────────────────

export function getSection(guildId, key, defaults) {
  return structuredClone({ ...defaults, ...guilds.get(guildId)?.[key] });
}

export function setSection(guildId, key, value) {
  const sections = guilds.get(guildId) ?? {};
  sections[key] = structuredClone(value);
  guilds.set(guildId, sections);
  enqueue(() => guildsCol.updateOne({ _id: guildId }, { $set: { [key]: value } }, { upsert: true }));
}

export function deleteSection(guildId, key) {
  if (!guilds.get(guildId)?.[key]) return;
  delete guilds.get(guildId)[key];
  enqueue(() => guildsCol.updateOne({ _id: guildId }, { $unset: { [key]: '' } }));
}

// ─── Images ──────────────────────────────────────────────────────────────────

export function saveImage(name, contentType, buffer) {
  return enqueue(() =>
    imagesCol.replaceOne({ _id: name }, { contentType, data: buffer, updatedAt: new Date() }, { upsert: true }),
  );
}

export async function loadImage(name) {
  const doc = await imagesCol.findOne({ _id: name });
  return doc ? Buffer.from(doc.data.buffer) : null;
}

export function deleteImages(prefix) {
  const pattern = `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`;
  enqueue(() => imagesCol.deleteMany({ _id: { $regex: pattern } }));
}

// ─── One-time import of the old data/ folder ────────────────────────────────

const CONTENT_TYPES = { png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };

async function importLocalData() {
  const file = path.join(DATA_DIR, 'guilds.json');
  if (!fs.existsSync(file) || (await guildsCol.estimatedDocumentCount()) > 0) return;

  const local = JSON.parse(fs.readFileSync(file, 'utf8'));
  const docs = Object.entries(local).map(([_id, sections]) => ({ _id, ...sections }));
  if (docs.length) await guildsCol.insertMany(docs);

  let images = 0;
  if (fs.existsSync(IMAGES_DIR)) {
    for (const name of fs.readdirSync(IMAGES_DIR)) {
      const contentType = CONTENT_TYPES[path.extname(name).slice(1)];
      if (!contentType) continue;
      await saveImage(name, contentType, fs.readFileSync(path.join(IMAGES_DIR, name)));
      images++;
    }
  }
  console.log(`📦 Imported ${docs.length} server(s) and ${images} image(s) from the local data/ folder`);
}
