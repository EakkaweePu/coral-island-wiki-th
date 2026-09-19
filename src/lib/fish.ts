import data from '../../data/processed/fish.json' with { type: 'json' };

export type Fish = (typeof data.fish)[number];
export type Spawn = Fish['spawns'][number];

export const { labels, fish } = data;

export const SEASONS = ['Spring', 'Summer', 'Fall', 'Winter'] as const;
export const TIMES = ['Morning', 'Afternoon', 'Evening', 'Night'] as const;
export const WEATHER = ['Sunny', 'Rain', 'Storm', 'Windy', 'Snow', 'Blizzard'] as const;

/** Thai label from the game's own localization, falling back to the English value. */
export function label(kind: keyof typeof labels, value: string): string {
	return (labels[kind] as Record<string, string>)[value] ?? value;
}

/** Labels for the values present, in canonical order, as a Thai list. */
export function labelList(all: readonly string[], have: string[], kind: keyof typeof labels): string {
	return all
		.filter((v) => have.includes(v))
		.map((v) => label(kind, v))
		.join(' ');
}

export const bySlug = new Map(fish.map((f) => [f.slug, f]));
export const displayName = (f: Fish): string => f.nameTh ?? f.nameEn;

/** Cheapest first, so a fish can be placed against the rest of the catalogue. */
const byPrice = [...fish].sort((a, b) => a.sellPrice - b.sellPrice);
export const priceRank = (f: Fish): number => byPrice.length - byPrice.indexOf(f);

/** Other fish sharing at least one spawn location — the basis for cross-links. */
export function sameLocation(f: Fish, limit = 8): Fish[] {
	return fish
		.filter((o) => o.slug !== f.slug && o.locations.some((l) => f.locations.includes(l)))
		.sort((a, b) => b.sellPrice - a.sellPrice)
		.slice(0, limit);
}

/** Other fish available in every season this one is, excluding itself. */
export function sameSeason(f: Fish, limit = 8): Fish[] {
	return fish
		.filter((o) => o.slug !== f.slug && f.seasons.every((s) => o.seasons.includes(s)))
		.sort((a, b) => b.sellPrice - a.sellPrice)
		.slice(0, limit);
}

const allOf = (all: readonly string[], have: string[]) => all.every((v) => have.includes(v));

/**
 * Prose describing one fish, built entirely from the game's own data.
 * Nothing here is invented: every number and name comes from data/processed/fish.json.
 */
export function describe(f: Fish): string[] {
	const name = displayName(f);
	const out: string[] = [];

	// Spawn rows can disagree, so an absolute claim would be wrong for fish that
	// are year-round at one location but single-season at another.
	const seasonsDiffer = new Set(f.spawns.map((s) => s.seasons.join())).size > 1;
	const seasonText = seasonsDiffer
		? `ตกได้ใน${labelList(SEASONS, f.seasons, 'season')} แต่แต่ละจุดเปิดไม่พร้อมกัน`
		: allOf(SEASONS, f.seasons)
			? 'ตกได้ตลอดทั้งปีไม่จำกัดฤดู'
			: `ตกได้ใน${labelList(SEASONS, f.seasons, 'season')}`;
	const timeText = allOf(TIMES, f.times)
		? 'ขึ้นตลอดทั้งวันไม่จำกัดเวลา'
		: `ขึ้นเฉพาะช่วง${labelList(TIMES, f.times, 'time')}`;
	out.push(
		`${name} เป็นปลาระดับความหายาก ${f.rarities.join(' และ ')} ` +
			`ขนาด${f.sizes.map((v) => label('size', v).replace('ปลาขนาด', '')).join('และ')} ` +
			`${seasonText} และ${timeText} ` +
			`พบได้ในแหล่งน้ำประเภท ${f.areas.join(' และ ')} รวม ${f.locations.length} จุดบนเกาะ`,
	);

	if (f.descriptionTh) {
		out.push(`คำอธิบายในเกมระบุไว้ว่า "${f.descriptionTh}"`);
	}

	out.push(
		`ขายได้ตัวละ ${f.sellPrice} เหรียญ ` +
			`นับเป็นปลาที่ขายได้แพงเป็นอันดับ ${priceRank(f)} จากปลาทั้งหมด ${fish.length} ชนิดในเกม ` +
			`ถ้าอยากซื้อคืนต้องจ่าย ${f.price} เหรียญ` +
			(f.sellAt.length ? ` ที่ร้าน ${f.sellAt.join(' และ ')}` : '') +
			` ตกได้แล้วจะได้รับค่าประสบการณ์การตกปลา ${f.experience} หน่วย ` +
			`ขนาดตัวที่จับได้อยู่ระหว่าง ${f.minCaughtSize} ถึง ${f.maxCaughtSize}`,
	);

	if (f.spawns.length > 1) {
		const varies = [
			f.rarities.length > 1 ? 'ความหายาก' : '',
			f.sizes.length > 1 ? 'ขนาด' : '',
		].filter(Boolean);
		out.push(
			`${name} มีเงื่อนไขการเกิดต่างกัน ${f.spawns.length} แบบตามสถานที่ ` +
				`หมายความว่าไปตกคนละจุดอาจเจอคนละฤดูหรือคนละเวลา ` +
				(varies.length ? `แม้แต่${varies.join('และ')}ก็ไม่เท่ากันทุกจุด ` : '') +
				`ตารางด้านล่างแยกเงื่อนไขของแต่ละจุดไว้แล้ว อย่าดูรวมกัน`,
		);
	}

	const restricted = f.spawns.filter((s) => !allOf(WEATHER, s.weather));
	if (restricted.length) {
		const w = [...new Set(restricted.flatMap((s) => s.weather))];
		out.push(
			`สภาพอากาศมีผลกับปลาตัวนี้ บางจุดขึ้นเฉพาะตอนอากาศเป็น${labelList(WEATHER, w, 'weather')} ` +
				`ถ้าไปตกแล้วไม่เจอ ลองเช็กพยากรณ์อากาศในเกมก่อนออกไป`,
		);
	}

	const dated = f.spawns.filter((s) => s.dateRanges.length);
	if (dated.length) {
		const ranges = dated
			.flatMap((s) => s.dateRanges)
			.map((d) => `วันที่ ${d.from.day} ถึง ${d.till.day} ของ${label('season', d.from.season)}`);
		out.push(
			`ปลาตัวนี้มีช่วงเวลาจำกัด เปิดให้ตกเฉพาะ${ranges.join(' และ ')} เท่านั้น ` +
				`พลาดแล้วต้องรอปีถัดไป ควรจดวันไว้ในปฏิทิน`,
		);
	}

	return out;
}

export type SpawnRow = {
	location: string;
	seasons: string;
	times: string;
	weather: string;
	rarity: string;
	size: string;
};
export type Stat = { label: string; value: string };

/**
 * Everything one fish page renders. The page renders exactly this, and
 * `pageWords` counts exactly this, so the length gate matches what ships.
 */
export function buildPage(f: Fish) {
	const paragraphs = describe(f);

	const spawnRows: SpawnRow[] = f.spawns.flatMap((s) =>
		(s.locations.length ? s.locations : ['—']).map((location) => ({
			location,
			seasons: s.dateRanges.length
				? s.dateRanges
						.map((d) => `${label('season', d.from.season)} วันที่ ${d.from.day}–${d.till.day}`)
						.join(' และ ')
				: allOf(SEASONS, s.seasons)
					? 'ทุกฤดู'
					: labelList(SEASONS, s.seasons, 'season'),
			times: allOf(TIMES, s.times) ? 'ทั้งวัน' : labelList(TIMES, s.times, 'time'),
			weather: allOf(WEATHER, s.weather) ? 'ทุกสภาพอากาศ' : labelList(WEATHER, s.weather, 'weather'),
			rarity: s.rarity,
			size: label('size', s.size).replace('ปลาขนาด', ''),
		})),
	);

	const stats: Stat[] = [
		{ label: 'ความหายาก', value: f.rarities.join(' และ ') },
		{ label: 'ขนาด', value: f.sizes.map((v) => label('size', v)).join('และ') },
		{ label: 'ราคาขาย', value: `${f.sellPrice} เหรียญ` },
		{ label: 'ราคาซื้อ', value: `${f.price} เหรียญ` },
		{ label: 'ค่าประสบการณ์', value: `${f.experience}` },
		{ label: 'ขนาดที่จับได้', value: `${f.minCaughtSize} – ${f.maxCaughtSize}` },
		{ label: 'แหล่งน้ำ', value: f.areas.join(' และ ') },
		{ label: 'ร้านที่ขาย', value: f.sellAt.join(' และ ') || '—' },
	];

	return { paragraphs, spawnRows, stats, nearby: sameLocation(f), seasonMates: sameSeason(f) };
}

const segmenter = new Intl.Segmenter('th', { granularity: 'word' });

/** Thai has no spaces, so word count needs a segmenter rather than splitting. */
export function countWords(text: string): number {
	let n = 0;
	for (const s of segmenter.segment(text)) if (s.isWordLike) n++;
	return n;
}

/** Word count of the whole rendered page body, used to skip thin pages. */
export function pageWords(f: Fish): number {
	const p = buildPage(f);
	return countWords(
		[
			displayName(f),
			f.nameEn,
			...p.paragraphs,
			...p.spawnRows.flatMap((r) => [r.location, r.seasons, r.times, r.weather, r.rarity, r.size]),
			...p.stats.flatMap((s) => [s.label, s.value]),
			...p.nearby.map(displayName),
			...p.seasonMates.map(displayName),
		].join(' '),
	);
}
