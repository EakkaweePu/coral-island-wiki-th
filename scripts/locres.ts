/**
 * Minimal reader for Unreal Engine .locres (version 3, Optimized_CityHash64_UTF16).
 * Returns namespace -> key -> localized string.
 */
import { readFileSync } from 'node:fs';

const MAGIC = Buffer.from('0e147475674a03fc4a15909dc3377f1b', 'hex');

export type Locres = Map<string, Map<string, string>>;

/** Sequential cursor over the buffer. Plain closure: Node's strip-only TS has no class fields shortcuts. */
function reader(buf: Buffer, start: number) {
	let pos = start;
	return {
		int32(): number {
			const v = buf.readInt32LE(pos);
			pos += 4;
			return v;
		},
		int64(): number {
			const v = Number(buf.readBigInt64LE(pos));
			pos += 8;
			return v;
		},
		skip(n: number): void {
			pos += n;
		},
		/** FString: positive length = UTF-8, negative = UTF-16LE. Both include a trailing NUL. */
		str(): string {
			const n = this.int32();
			if (n === 0) return '';
			if (n < 0) {
				const bytes = -n * 2;
				const s = buf.toString('utf16le', pos, pos + bytes - 2);
				pos += bytes;
				return s;
			}
			const s = buf.toString('utf8', pos, pos + n - 1);
			pos += n;
			return s;
		},
	};
}

export function readLocres(path: string): Locres {
	const buf = readFileSync(path);
	if (!buf.subarray(0, 16).equals(MAGIC)) {
		throw new Error(`${path}: ไม่ใช่ไฟล์ .locres (magic ไม่ตรง)`);
	}

	const version = buf[16];
	if (version !== 3) {
		throw new Error(`${path}: รองรับเฉพาะ locres version 3 แต่ไฟล์นี้เป็น version ${version}`);
	}

	const r = reader(buf, 17);
	const stringTableOffset = r.int64();
	r.skip(4); // total entry count

	// String table sits at the end of the file: every localized value, deduplicated.
	const t = reader(buf, stringTableOffset);
	const stringCount = t.int32();
	const strings: string[] = [];
	for (let i = 0; i < stringCount; i++) {
		strings.push(t.str());
		t.skip(4); // reference count
	}

	const out: Locres = new Map();
	const namespaceCount = r.int32();
	for (let i = 0; i < namespaceCount; i++) {
		r.skip(4); // namespace hash
		const namespace = r.str();
		const keyCount = r.int32();
		const entries = new Map<string, string>();
		for (let j = 0; j < keyCount; j++) {
			r.skip(4); // key hash
			const key = r.str();
			r.skip(4); // source string hash
			const index = r.int32();
			const value = strings[index];
			if (value !== undefined) entries.set(key, value);
		}
		out.set(namespace, entries);
	}
	return out;
}
