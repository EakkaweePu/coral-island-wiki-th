/**
 * Self-check for transform-fish.ts. Run: node scripts/transform-fish.test.ts
 * Needs data/raw/ present and `node scripts/transform-fish.ts` already run.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { enumValue, enabledFlags, slugify } from './transform-fish.ts';

assert.equal(enumValue('EFishSize::Medium'), 'Medium');
assert.equal(enumValue('Plain'), 'Plain');

assert.deepEqual(enabledFlags({ a: true, b: false, c: true }), ['a', 'c']);

assert.equal(slugify('Giant snakehead'), 'giant-snakehead');
assert.equal(slugify('Black phantom ghost fish'), 'black-phantom-ghost-fish');
assert.equal(slugify('ปลาแซลมอน Salmon'), 'salmon'); // URLs stay ASCII

const { labels, fish } = JSON.parse(readFileSync('data/processed/fish.json', 'utf8'));

assert.ok(fish.length > 0, 'ไม่มีปลาเลย');
assert.equal(new Set(fish.map((f: { slug: string }) => f.slug)).size, fish.length, 'slug ซ้ำ');
assert.equal(labels.season.Spring, 'ฤดูใบไม้ผลิ', 'คำไทยของฤดูหาย');

for (const f of fish) {
	assert.ok(f.nameEn, `${f.itemId}: ไม่มีชื่ออังกฤษ`);
	assert.ok(f.spawns.length > 0, `${f.itemId}: ไม่มี spawn`);
	assert.ok(f.sellPrice > 0, `${f.itemId}: sellPrice ผิด`);
	// Top-level arrays must be the union of the spawn rows, or filtering the
	// index table would silently miss fish.
	for (const key of ['seasons', 'times', 'weather', 'areas', 'locations'] as const) {
		const fromSpawns = new Set(f.spawns.flatMap((s: Record<string, string[]>) => s[key]!));
		assert.deepEqual(
			new Set(f[key]),
			fromSpawns,
			`${f.itemId}: ${key} ไม่ตรงกับผลรวมของ spawns`,
		);
	}
}

// A fish caught in several places must keep them as separate spawn rows.
const salmon = fish.find((f: { slug: string }) => f.slug === 'salmon');
assert.ok(salmon, 'ไม่เจอ salmon');
assert.ok(salmon.spawns.length >= 2, 'salmon ควรมีมากกว่าหนึ่ง spawn');
assert.ok(
	salmon.spawns.some((s: { seasons: string[] }) => !s.seasons.includes('Fall')),
	'spawn ของ salmon ถูกยุบรวมกันหมด',
);

console.log(`ผ่านทั้งหมด — ปลา ${fish.length} ตัว`);
