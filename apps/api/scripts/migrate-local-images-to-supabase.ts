import 'dotenv/config';
import { createHash } from 'node:crypto';
import { opendir, readFile, stat } from 'node:fs/promises';
import { extname, join, relative, resolve, sep } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const source = process.argv.slice(2).find((argument) => argument !== '--');
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'medical-records';

if (!source || !url || !key) {
  throw new Error(
    'Cần truyền thư mục ảnh cũ và đặt SUPABASE_URL, SUPABASE_SECRET_KEY trong môi trường.',
  );
}

const sourceRoot = resolve(source);
if (!(await stat(sourceRoot)).isDirectory()) throw new Error('Đường dẫn nguồn phải là thư mục.');

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const contentTypes: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

async function* filesIn(directory: string): AsyncGenerator<string> {
  for await (const entry of await opendir(directory)) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) yield* filesIn(path);
    else if (entry.isFile()) yield path;
  }
}

let uploaded = 0;
let verifiedExisting = 0;
let failed = 0;

for await (const path of filesIn(sourceRoot)) {
  const storageKey = relative(sourceRoot, path).split(sep).join('/');
  const contentType = contentTypes[extname(path).toLowerCase()];
  if (!contentType || !/^[^/]+\/[^/]+$/.test(storageKey)) {
    console.error(`Bỏ qua đường dẫn không đúng định dạng ảnh đính kèm: ${storageKey}`);
    failed++;
    continue;
  }

  try {
    const bytes = await readFile(path);
    const upload = await supabase.storage.from(bucket).upload(storageKey, bytes, {
      contentType,
      upsert: false,
    });
    if (upload.error && upload.error.statusCode !== '409') throw upload.error;

    const downloaded = await supabase.storage.from(bucket).download(storageKey);
    if (downloaded.error || !downloaded.data) {
      throw downloaded.error ?? new Error('Không thể kiểm tra ảnh vừa tải lên.');
    }
    const remoteBytes = Buffer.from(await downloaded.data.arrayBuffer());
    const sha = (value: Buffer) => createHash('sha256').update(value).digest('hex');
    if (sha(bytes) !== sha(remoteBytes))
      throw new Error('Checksum không khớp; không ghi đè file trên Storage.');

    if (upload.error) verifiedExisting++;
    else uploaded++;
    console.log(`OK ${storageKey}`);
  } catch (error) {
    failed++;
    console.error(`LỖI ${storageKey}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.log(`Hoàn tất: tải mới ${uploaded}, đã có và khớp ${verifiedExisting}, lỗi ${failed}.`);
if (failed) process.exitCode = 1;
