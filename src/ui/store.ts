/**
 * Saves live in IndexedDB as gzip (a year's state is megabytes of JSON; localStorage would not hold it).
 * Every access is wrapped: a private window or blocked storage gives "no save", never a broken page.
 */
import { lab } from './lab';

function captureStored(key: string, text: string): void {
  // Departure prefixes are local recovery data; the active run owns its gated uploads.
  if (key.startsWith('persona-departure:')) return;
  try {
    lab.captureSave({ key, value: JSON.parse(text) });
  } catch {}
}

const DB = 'hearsay';
const STORE = 'pages';
let connection: IDBDatabase | null = null;
const revisions = new Map<string, number>();
type Row = { blob?: Blob; plain?: string; at: number };

function open(): Promise<IDBDatabase> {
  if (connection) return Promise.resolve(connection);
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => {
      connection = r.result;
      connection.onversionchange = () => {
        connection?.close();
        connection = null;
      };
      res(r.result);
    };
    r.onerror = () => rej(r.error);
  });
}

async function gzip(text: string): Promise<Blob> {
  const cs = new CompressionStream('gzip');
  return new Response(new Blob([text]).stream().pipeThrough(cs)).blob();
}

async function gunzip(b: Blob): Promise<string> {
  const ds = new DecompressionStream('gzip');
  return new Response(b.stream().pipeThrough(ds)).text();
}

export async function put(key: string, value: unknown): Promise<boolean> {
  try {
    const revision = (revisions.get(key) ?? 0) + 1;
    revisions.set(key, revision);
    const text = JSON.stringify(value);
    const db = await open();
    const write = async (row: Row): Promise<void> => {
      if (revisions.get(key) !== revision) return;
      await new Promise<void>((res, rej) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(row, key);
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
        tx.onabort = () => rej(tx.error);
      });
    };
    try {
      await write({ blob: await gzip(text), at: Date.now() });
    } catch {
      // Some WebKit storage contexts reject Blob transactions. The reader already
      // supports plain JSON. Keep the same revision guard and atomic transaction.
      await write({ plain: text, at: Date.now() });
    }
    if (revisions.get(key) !== revision) return true;
    captureStored(key, text);
    return true;
  } catch {
    return false;
  }
}

export async function get<T>(key: string): Promise<{ value: T; at: number } | null> {
  try {
    const db = await open();
    const row = await new Promise<Row | undefined>((res, rej) => {
      const r = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      r.onsuccess = () => res(r.result as Row | undefined);
      r.onerror = () => rej(r.error);
    });
    if (!row) return null;
    return { value: JSON.parse(row.plain ?? (row.blob ? await gunzip(row.blob) : 'null')) as T, at: row.at };
  } catch {
    return null;
  }
}

export async function drop(key: string): Promise<void> {
  try {
    const db = await open();
    await new Promise<void>((res) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => res();
      tx.onerror = () => res();
    });
  } catch {}
}

/** Queue the latest JSON transaction synchronously while pagehide still owns a live database connection. */
export function putNow(key: string, value: unknown): boolean {
  try {
    if (!connection) return false;
    revisions.set(key, (revisions.get(key) ?? 0) + 1);
    const text = JSON.stringify(value);
    const tx = connection.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ plain: text, at: Date.now() }, key);
    tx.oncomplete = () => captureStored(key, text);
    return true;
  } catch {
    return false;
  }
}

/** Small journal writes complete before their clock is shown; no compression is needed. */
export function putImmediate(key: string, value: unknown): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      if (!connection) {
        resolve(false);
        return;
      }
      revisions.set(key, (revisions.get(key) ?? 0) + 1);
      const text = JSON.stringify(value);
      const tx = connection.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ plain: text, at: Date.now() }, key);
      tx.oncomplete = () => {
        captureStored(key, text);
        resolve(true);
      };
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}
