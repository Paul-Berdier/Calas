import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { open, stat, unlink } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const magic = Buffer.from('CALASBKP1\n');
const headerSize = magic.length + 12 + 16;
export interface ArchiveRecord { kind: 'manifest' | 'postgres' | 'object'; size: number; sha256: string; key?: string; mimeType?: string; path: string }
export interface BackupManifest { format: 'calas-backup-v1'; createdAt: string; codeRevision: string; migrations: Array<{ name: string; sha256: string }>; postgresVersion: string; objectCount: number; objects: Array<{ key: string; size: number; sha256: string; mimeType: string }> }

export function backupKey(): Buffer {
  const key = Buffer.from(process.env.BACKUP_ENCRYPTION_KEY || '', 'base64');
  if (key.length !== 32) throw new Error('BACKUP_ENCRYPTION_KEY doit contenir une clé aléatoire de 32 octets encodée en base64.');
  return key;
}
export async function hashFile(path: string): Promise<string> { const hash = createHash('sha256'); for await (const chunk of createReadStream(path)) hash.update(chunk); return hash.digest('hex'); }

/** The archive has authenticated framing, so no source path can become a local extraction path. */
export async function encryptArchive(target: string, records: ArchiveRecord[], key = backupKey()): Promise<void> {
  if (records.reduce((total, record) => total + record.size + 16_384, headerSize) > 5 * 1024 ** 3) throw new Error('L’archive dépasse la limite prise en charge de 5 Gio.');
  for (const record of records) if (record.size < 1 || record.size > (record.kind === 'postgres' ? 2 * 1024 ** 3 : record.kind === 'manifest' ? 32 * 1024 ** 2 : 21 * 1024 ** 2)) throw new Error('Un fichier dépasse la limite du format de sauvegarde.');
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(magic);
  const handle = await open(target, 'wx', 0o600);
  await handle.write(Buffer.concat([magic, nonce, Buffer.alloc(16)]));
  await handle.close();
  async function* chunks() {
    for (const record of records) {
      const { path, ...metadata } = record;
      const json = Buffer.from(JSON.stringify(metadata));
      const length = Buffer.alloc(4); length.writeUInt32BE(json.length);
      yield length; yield json;
      let bytes = 0;
      for await (const chunk of createReadStream(path)) { bytes += (chunk as Buffer).length; yield chunk as Buffer; }
      if (bytes !== record.size) throw new Error('Un fichier a changé pendant la sauvegarde.');
    }
    yield Buffer.alloc(4);
  }
  try {
    await pipeline(Readable.from(chunks()), cipher, createWriteStream(target, { flags: 'r+', start: headerSize }));
    const final = await open(target, 'r+');
    try { await final.write(cipher.getAuthTag(), 0, 16, magic.length + 12); await final.sync(); } finally { await final.close(); }
  } catch (error) { await unlink(target).catch(() => undefined); throw error; }
}

/** Authentication finishes before any database or bucket mutation is allowed. */
export async function decryptArchive(source: string, target: string, key = backupKey()): Promise<void> {
  const size = (await stat(source)).size;
  if (size < headerSize + 4 || size > 5 * 1024 ** 3) throw new Error('La taille de l’archive est invalide.');
  const handle = await open(source, 'r');
  const header = Buffer.alloc(headerSize);
  try { await handle.read(header, 0, headerSize, 0); } finally { await handle.close(); }
  if (!header.subarray(0, magic.length).equals(magic)) throw new Error('Le format de sauvegarde est inconnu.');
  const decipher = createDecipheriv('aes-256-gcm', key, header.subarray(magic.length, magic.length + 12));
  decipher.setAAD(magic);
  decipher.setAuthTag(header.subarray(magic.length + 12));
  try { await pipeline(createReadStream(source, { start: headerSize }), decipher, createWriteStream(target, { flags: 'wx', mode: 0o600 })); }
  catch { await unlink(target).catch(() => undefined); throw new Error('L’archive est altérée ou sa clé de déchiffrement est incorrecte.'); }
}

export async function inspectArchive(plainPath: string, destination: (index: number) => string): Promise<{ records: ArchiveRecord[]; manifest: BackupManifest }> {
  const file = await open(plainPath, 'r');
  const total = (await file.stat()).size;
  const records: ArchiveRecord[] = [];
  const keys = new Set<string>();
  let offset = 0;
  try {
    while (true) {
      const length = Buffer.alloc(4);
      if ((await file.read(length, 0, 4, offset)).bytesRead !== 4) throw new Error('Archive incomplète.');
      offset += 4;
      const headerLength = length.readUInt32BE();
      if (!headerLength) { if (offset !== total) throw new Error('Données supplémentaires après la fin de l’archive.'); break; }
      if (headerLength > 16_384 || records.length >= 100_002 || offset + headerLength > total) throw new Error('En-tête d’archive invalide.');
      const bytes = Buffer.alloc(headerLength);
      await file.read(bytes, 0, headerLength, offset); offset += headerLength;
      const header = JSON.parse(bytes.toString('utf8')) as Omit<ArchiveRecord, 'path'>;
      if (!['manifest', 'postgres', 'object'].includes(header.kind) || !Number.isSafeInteger(header.size) || header.size < 1 || header.size > (header.kind === 'postgres' ? 2 * 1024 ** 3 : header.kind === 'manifest' ? 32 * 1024 ** 2 : 21 * 1024 ** 2) || !/^[a-f0-9]{64}$/.test(header.sha256) || offset + header.size > total) throw new Error('Métadonnées d’archive invalides.');
      if (header.kind === 'manifest' && records.length !== 0 || header.kind === 'postgres' && records.length !== 1 || header.kind === 'object' && records.length < 2) throw new Error('Ordre de sauvegarde invalide.');
      if (header.kind === 'object') {
        if (typeof header.key !== 'string' || !/^media\/[a-f0-9-]{36}\/[a-f0-9-]{36}\/(original\.(jpg|png|pdf)|(320|960|1920)\.webp)$/.test(header.key) || keys.has(header.key)) throw new Error('Une clé média de l’archive est invalide ou dupliquée.');
        keys.add(header.key);
        if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(header.mimeType || '')) throw new Error('Le type d’un objet de sauvegarde est invalide.');
      }
      const path = destination(records.length);
      await pipeline(createReadStream(plainPath, { start: offset, end: offset + header.size - 1 }), createWriteStream(path, { flags: 'wx', mode: 0o600 }));
      if (await hashFile(path) !== header.sha256) throw new Error('L’empreinte d’un fichier ne correspond pas à l’archive.');
      records.push({ ...header, path }); offset += header.size;
    }
    if (records[0]?.kind !== 'manifest' || records[1]?.kind !== 'postgres') throw new Error('La sauvegarde ne contient pas la base attendue.');
    const manifestFile = await open(records[0].path, 'r');
    let manifest: BackupManifest;
    try { manifest = JSON.parse(await manifestFile.readFile({ encoding: 'utf8' })) as BackupManifest; } finally { await manifestFile.close(); }
    if (manifest.format !== 'calas-backup-v1' || !Array.isArray(manifest.objects) || manifest.objectCount !== records.length - 2 || manifest.objects.length !== manifest.objectCount || new Set(manifest.objects.map(object => object.key)).size !== manifest.objectCount) throw new Error('Le manifeste de sauvegarde est invalide.');
    for (const object of manifest.objects) { const record = records.find(item => item.kind === 'object' && item.key === object.key); if (!record || record.size !== object.size || record.sha256 !== object.sha256 || record.mimeType !== object.mimeType) throw new Error('L’inventaire des médias est incohérent.'); }
    return { records, manifest };
  } finally { await file.close(); }
}
