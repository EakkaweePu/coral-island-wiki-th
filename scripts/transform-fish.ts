/**
 * data/raw/{DT_Fish,DT_InventoryItems}.json + th.locres  ->  data/processed/fish.json
 *
 * DT_Fish has one row per spawn condition, so the same fish appears several times
 * (Salmon_Estuary, Salmon_LakeTemple, Salmon_Fall). Rows are grouped by itemID so
 * one fish becomes one entry with its spawn conditions kept separate.
 *
 * Run: node scripts/transform-fish.ts
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { z } from 'zod';
import { readLocres } from './locres.ts';

const RAW = 'data/raw';
const OUT = 'data/processed/fish.json';
const ITEM_NS = 'DT_InventoryItems';

// ---------------------------------------------------------------- input schema

const flags = z.record(z.string(), z.boolean());

const dateRange = z.object({
	startsFrom: z.object({ day: z.number(), season: z.string(), year: z.number() }),
	lastsTill: z.object({ day: z.number(), season: z.string(), year: z.number() }),
});

const fishRow = z.object({
	isEnabled: z.boolean(),
	FishSKU: z.object({ itemID: z.string() }),
	fishSize: z.string(),
	Rarity: z.string(),
	SpawnArea: flags,
	SpawnLocation: z.array(z.string()),
	SpawnTime: flags,
	SpawnWeather: flags,
	SpawnSeason: flags,
	minCaughtSize: z.number(),
	maxCaughtSize: z.number(),
	experienceGrantedWhenCaught: z.number(),
	dateRangeList: z.array(dateRange),
});

const itemRow = z.object({
	price: z.number(),
	sellPrice: z.number(),
	name: z.object({ SourceString: z.string() }),
	description: z.object({ SourceString: z.string() }).optional(),
	sellAt: z.array(z.string()).optional(),
	inventoryDisplayCategory: z.object({ SourceString: z.string() }).optional(),
});

const dataTable = z.object({ Name: z.string(), Rows: z.record(z.string(), z.unknown()) });

// ---------------------------------------------------------------- helpers

/** "EFishSize::Medium" -> "Medium" */
export function enumValue(raw: string): string {
	const i = raw.lastIndexOf('::');
	return i === -1 ? raw : raw.slice(i + 2);
}

/** Keys whose flag is true, in the object's own order. */
export function enabledFlags(o: Record<string, boolean>): string[] {
	return Object.keys(o).filter((k) => o[k]);
}

/** "Giant snakehead" -> "giant-snakehead". ASCII only, per the SEO rule on URLs. */
export function slugify(name: string): string {
	return name
		.normalize('NFKD')
		.replace(/[^\x20-\x7E]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

function loadTable(file: string): Record<string, unknown> {
	const parsed = z.array(dataTable).min(1).safeParse(JSON.parse(readFileSync(`${RAW}/${file}`, 'utf8')));
	if (!parsed.success) {
		throw new Error(`${file}: ไม่ใช่ FModel DataTable export\n${z.prettifyError(parsed.error)}`);
	}
	return parsed.data[0]!.Rows;
}

/** Parses every row, collecting all failures so one run reports every bad row. */
function parseRows<T>(rows: Record<string, unknown>, schema: z.ZodType<T>, file: string): Map<string, T> {
	const out = new Map<string, T>();
	const errors: string[] = [];
	for (const [rowName, value] of Object.entries(rows)) {
		const r = schema.safeParse(value);
		if (r.success) out.set(rowName, r.data);
		else errors.push(`  ${file} แถว "${rowName}":\n${z.prettifyError(r.error).replace(/^/gm, '    ')}`);
	}
	if (errors.length) {
		throw new Error(`โครงสร้างข้อมูลไม่ตรง schema ${errors.length} แถว:\n${errors.join('\n')}`);
	}
	return out;
}

// ---------------------------------------------------------------- transform

const locres = readLocres(`${RAW}/th.locres`);
const items = locres.get(ITEM_NS);
if (!items) throw new Error(`th.locres: ไม่มี namespace ${ITEM_NS}`);

const thai = (key: string): string | null => {
	const v = items.get(key);
	return v === undefined || v === '' || v === '???' ? null : v;
};

const fishRows = parseRows(loadTable('DT_Fish.json'), fishRow, 'DT_Fish.json');
const itemRows = parseRows(loadTable('DT_InventoryItems.json'), itemRow, 'DT_InventoryItems.json');

// Group spawn rows by the item they award.
const byItem = new Map<string, Array<{ rowName: string; row: z.infer<typeof fishRow> }>>();
for (const [rowName, row] of fishRows) {
	if (!row.isEnabled) continue;
	const list = byItem.get(row.FishSKU.itemID) ?? [];
	list.push({ rowName, row });
	byItem.set(row.FishSKU.itemID, list);
}

const union = (lists: string[][]): string[] => [...new Set(lists.flat())];

const missingThaiName: string[] = [];
const slugs = new Map<string, string>();

const fish = [...byItem].map(([itemId, rows]) => {
	const item = itemRows.get(itemId);
	if (!item) throw new Error(`${itemId}: มีใน DT_Fish แต่ไม่มีใน DT_InventoryItems`);

	const nameEn = item.name.SourceString;
	const nameTh = thai(`${itemId}_name`);
	if (nameTh === null) missingThaiName.push(`${itemId} (${nameEn})`);

	// Slug comes from the English name: URLs must stay ASCII.
	let slug = slugify(nameEn);
	const taken = slugs.get(slug);
	if (taken !== undefined && taken !== itemId) slug = `${slug}-${itemId.replace('item_', '')}`;
	slugs.set(slug, itemId);

	// Each raw row is one spawn condition; keeping them apart preserves which
	// season/time combination actually applies at which location.
	const spawns = rows.map(({ rowName, row }) => ({
		rowName,
		locations: row.SpawnLocation.map(enumValue),
		areas: enabledFlags(row.SpawnArea).map((k) => k.replace(/^CanBeCatchOn/, '')),
		seasons: enabledFlags(row.SpawnSeason),
		times: enabledFlags(row.SpawnTime),
		weather: enabledFlags(row.SpawnWeather),
		dateRanges: row.dateRangeList.map((d) => ({
			from: { day: d.startsFrom.day, season: enumValue(d.startsFrom.season) },
			till: { day: d.lastsTill.day, season: enumValue(d.lastsTill.season) },
			year: d.startsFrom.year,
		})),
	}));

	const first = rows[0]!.row;
	return {
		slug,
		itemId,
		nameTh,
		nameEn,
		descriptionTh: thai(`${itemId}_description`),
		descriptionEn: item.description?.SourceString ?? null,
		rarity: enumValue(first.Rarity),
		size: enumValue(first.fishSize),
		price: item.price,
		sellPrice: item.sellPrice,
		sellAt: item.sellAt ?? [],
		minCaughtSize: Math.min(...rows.map((r) => r.row.minCaughtSize)),
		maxCaughtSize: Math.max(...rows.map((r) => r.row.maxCaughtSize)),
		experience: first.experienceGrantedWhenCaught,
		// Unions across every spawn row, for filtering the index table.
		seasons: union(spawns.map((s) => s.seasons)),
		times: union(spawns.map((s) => s.times)),
		weather: union(spawns.map((s) => s.weather)),
		areas: union(spawns.map((s) => s.areas)),
		locations: union(spawns.map((s) => s.locations)),
		spawns,
	};
});

fish.sort((a, b) => a.slug.localeCompare(b.slug));

// ---------------------------------------------------------------- Thai labels

/**
 * Display labels for enum values, taken from the game's own localization.
 * Anything the game has no Thai string for is left out on purpose — never invent
 * a translation; the page falls back to the English value.
 */
function labelsFrom(namespace: string, keys: string[]): Record<string, string> {
	const ns = locres.get(namespace);
	const out: Record<string, string> = {};
	for (const k of keys) {
		const v = ns?.get(k);
		if (v) out[k] = v;
	}
	return out;
}

const labels = {
	season: labelsFrom('Time', ['Spring', 'Summer', 'Fall', 'Winter']),
	time: labelsFrom('Time', ['Morning', 'Afternoon', 'Evening', 'Night']),
	weather: labelsFrom('Weather', ['Sunny', 'Rain', 'Storm', 'Windy', 'Snow', 'Blizzard']),
	size: labelsFrom('Fishing', ['Small', 'Medium', 'Large']),
	category: labelsFrom('ItemCategory', ['Fish']),
};

const untranslated = {
	time: union([fish.flatMap((f) => f.times)]).filter((v) => !(v in labels.time)),
	rarity: [...new Set(fish.map((f) => f.rarity))],
	area: union([fish.flatMap((f) => f.areas)]),
	location: union([fish.flatMap((f) => f.locations)]),
};

// ---------------------------------------------------------------- output

mkdirSync('data/processed', { recursive: true });
writeFileSync(OUT, `${JSON.stringify({ labels, fish }, null, '\t')}\n`);

const pct = (n: number) => `${((n / fish.length) * 100).toFixed(0)}%`;
console.log(`เขียน ${OUT}`);
console.log(`  ปลา ${fish.length} ตัว จาก ${fishRows.size} แถวใน DT_Fish`);
console.log(`  มีชื่อไทย ${fish.length - missingThaiName.length}/${fish.length} (${pct(fish.length - missingThaiName.length)})`);
console.log(`  มีคำอธิบายไทย ${fish.filter((f) => f.descriptionTh).length}/${fish.length}`);

if (missingThaiName.length) {
	console.log(`\n  ไม่มีชื่อไทยในไฟล์เกม ${missingThaiName.length} ตัว (ใส่ null ไว้ ไม่แปลเอง):`);
	for (const m of missingThaiName) console.log(`    ${m}`);
}

const noLabel = Object.entries(untranslated).filter(([, v]) => v.length);
if (noLabel.length) {
	console.log(`\n  ค่าที่ไม่มีคำไทยใน locres (หน้าเว็บจะแสดงเป็นอังกฤษ):`);
	for (const [kind, values] of noLabel) console.log(`    ${kind}: ${values.join(', ')}`);
}
