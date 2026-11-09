import { createReadStream, createWriteStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { dailyName } from './backup-retention';

export interface CloudBackupStatus {
  status: 'ok';
  archive: string;
  capturedAt: string;
  finishedAt: string;
  sha256: string;
  bytes: number;
  objects: number;
  reused: boolean;
}

export interface ArchiveStore {
  download(key: string, path: string): Promise<boolean>;
  uploadNew(key: string, path: string): Promise<boolean>;
  dailyFiles(): Promise<string[]>;
  removeDaily(filename: string): Promise<void>;
  markSuccess(status: CloudBackupStatus): Promise<void>;
}

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error('Configuration du stockage des archives incomplète.');
  return value;
}

function backupBucket(prefix: 'BACKUP_S3' | 'STATUS_S3') {
  const endpoint = new URL(required(prefix + '_ENDPOINT'));
  const bucket = required(prefix + '_BUCKET');
  if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash ||
      !(endpoint.protocol === 'https:' || (process.env.SITE_ENV === 'test' && endpoint.protocol === 'http:' &&
        ['localhost', '127.0.0.1', 'minio'].includes(endpoint.hostname)))) throw new Error('Destination de sauvegarde inattendue.');
  const otherBucket = prefix === 'STATUS_S3' ? process.env.BACKUP_S3_BUCKET : process.env.STATUS_S3_BUCKET;
  if (bucket === process.env.S3_BUCKET || bucket === otherBucket) {
    throw new Error('Les médias, archives et états doivent être stockés dans trois buckets distincts.');
  }
  const client = new S3Client({
    endpoint: endpoint.href, region: process.env[prefix + '_REGION'] || 'auto',
    credentials: { accessKeyId: required(prefix + '_ACCESS_KEY_ID'), secretAccessKey: required(prefix + '_SECRET_ACCESS_KEY') },
    forcePathStyle: process.env[prefix + '_FORCE_PATH_STYLE'] === 'true',
    requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED', maxAttempts: 3,
  });
  return { client, bucket };
}

export type BackupStage = 'configuration' | 'connexion-base' | 'capture-distante' | 'signalement' | 'delai';
export type MonitorStatus =
  | {version: 1; day: string; capturedAt: string; verifiedAt: string}
  | {version: 1; failedAt: string; stage: BackupStage};

/** A separate credential can read these monitoring markers without access to any archive. */
export async function writeBackupMonitorStatus(status: MonitorStatus) {
  const { client, bucket } = backupBucket('STATUS_S3');
  const key = 'failedAt' in status ? 'backup/failure.json' : 'backup/success.json';
  try {
    await client.send(new PutObjectCommand({Bucket: bucket, Key: key, ContentType: 'application/json',
      CacheControl:'private, no-store', Body: JSON.stringify(status) + '\n'}), {abortSignal: AbortSignal.timeout(15_000)});
  } finally { client.destroy(); }
}

export function archiveDestination(): ArchiveStore {
  const { client, bucket } = backupBucket('BACKUP_S3');
  const options = () => ({ abortSignal: AbortSignal.timeout(15 * 60_000) });
  return {
    async download(key, path) {
      let object;
      try { object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }), options()); }
      catch (error) { if ((error as Error).name === 'NoSuchKey') return false; throw error; }
      const stream = object.Body as Readable | undefined;
      if (!stream || !object.ContentLength || object.ContentLength > 5 * 1024 ** 3) {
        stream?.destroy();
        throw new Error('Taille de sauvegarde inattendue.');
      }
      await pipeline(stream, createWriteStream(path, { flags: 'wx', mode: 0o600 }));
      if ((await stat(path)).size !== object.ContentLength) throw new Error('Archive distante incomplète.');
      return true;
    },
    async uploadNew(key, path) {
      const stream = createReadStream(path);
      try {
        await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: stream, ContentLength: (await stat(path)).size,
          ContentType: 'application/octet-stream', IfNoneMatch: '*', CacheControl: 'private, no-store' }), options());
        return true;
      } catch (error) {
        if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 412) return false;
        throw error;
      } finally { stream.destroy(); }
    },
    async dailyFiles() {
      const files: string[] = [];
      let token: string | undefined;
      do {
        const page = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: 'daily/', ContinuationToken: token }), options());
        for (const object of page.Contents ?? []) {
          const filename = object.Key?.slice('daily/'.length);
          if (filename && dailyName.test(filename)) files.push(filename);
        }
        const next = page.NextContinuationToken;
        if (page.IsTruncated && (!next || next === token)) throw new Error('Inventaire incomplet.');
        token = page.IsTruncated ? next : undefined;
      } while (token);
      return files;
    },
    async removeDaily(filename) {
      if (!dailyName.test(filename)) throw new Error('Nom d’archive inattendu.');
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: 'daily/' + filename }), options());
    },
    async markSuccess(status) {
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: 'status/latest.json', Body: JSON.stringify(status) + '\n',
        ContentType: 'application/json', CacheControl: 'private, no-store' }), options());
    },
  };
}
