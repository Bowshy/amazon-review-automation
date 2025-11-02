import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { parse } from 'csv-parse';
import { stringify } from 'csv-stringify';

// Usage:
//   tsx scripts/tsv-to-csv.ts --in file.tsv [--out file.csv]
//   tsx scripts/tsv-to-csv.ts --dir ./path-with-tsv

function parseArgs(): { inPath?: string; outPath?: string; dir?: string } {
	const args = process.argv.slice(2);
	const getVal = (key: string) => {
		const idx = args.findIndex((a) => a === key || a.startsWith(`${key}=`));
		if (idx === -1) return undefined;
		const eq = args[idx].indexOf('=');
		if (eq > -1) return args[idx].slice(eq + 1);
		return args[idx + 1];
	};

	return {
		inPath: getVal('--in'),
		outPath: getVal('--out'),
		dir: getVal('--dir')
	};
}

function defaultOutPath(inputPath: string): string {
	const { dir, name } = path.parse(inputPath);
	return path.join(dir, `${name}.csv`);
}

async function convertFile(tsvPath: string, csvPath?: string): Promise<void> {
	if (!fs.existsSync(tsvPath)) {
		throw new Error(`Input not found: ${tsvPath}`);
	}
	const out = csvPath || defaultOutPath(tsvPath);
	await pipeline(
		fs.createReadStream(tsvPath),
		parse({ delimiter: '\t', relax_column_count: true, relax_quotes: true, bom: true }),
		stringify({ delimiter: ',', quoted_match: /[",\n]/ }),
		fs.createWriteStream(out)
	);
	console.log(`Converted: ${tsvPath} -> ${out}`);
}

async function convertDir(dirPath: string): Promise<void> {
	if (!fs.existsSync(dirPath)) throw new Error(`Directory not found: ${dirPath}`);
	const entries = fs.readdirSync(dirPath).filter((f) => f.toLowerCase().endsWith('.tsv'));
	if (entries.length === 0) {
		console.log('No .tsv files found.');
		return;
	}
	for (const f of entries) {
		await convertFile(path.join(dirPath, f));
	}
}

async function main() {
	const { inPath, outPath, dir } = parseArgs();
	if (!inPath && !dir) {
		console.error('Usage: --in file.tsv [--out file.csv] OR --dir ./dir-with-tsv');
		process.exit(1);
	}
	if (dir) {
		await convertDir(dir);
		return;
	}
	await convertFile(inPath as string, outPath);
}

main().catch((err) => {
	console.error(err instanceof Error ? err.message : String(err));
	process.exit(1);
});
