import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fetch } from 'undici';
import { SellingPartner } from 'amazon-sp-api';

// Usage:
//   tsx scripts/download-report.ts --type reimbursement [--since 2025-08-01] [--until 2025-10-30] [--out file.tsv]
//   tsx scripts/download-report.ts --all [--since ...] [--until ...]

type ReportKind =
	| 'reimbursement'
	| 'inventory-adjustment'
	| 'customer-returns'
	| 'inbound-shipments'
	| 'inventory-ledger'
	| 'returns'
	| 'unsuppressed-inventory';

const VALID_TYPES: Readonly<ReportKind[]> = [
	'reimbursement',
	'inventory-adjustment',
	'customer-returns',
	'inbound-shipments',
	'inventory-ledger',
	'returns',
	'unsuppressed-inventory'
];

function parseArgs(): {
	type: ReportKind;
	since?: string;
	until?: string;
	out?: string;
	all?: boolean;
} {
	const args = process.argv.slice(2);
	const getVal = (key: string) => {
		const idx = args.findIndex((a) => a === key || a.startsWith(`${key}=`));
		if (idx === -1) return undefined;
		const eq = args[idx].indexOf('=');
		if (eq > -1) return args[idx].slice(eq + 1);
		return args[idx + 1];
	};
	const hasFlag = (flag: string) => args.includes(flag);

	const typeArg = (getVal('--type') || '').trim() as ReportKind;
	if (!typeArg || !VALID_TYPES.includes(typeArg)) {
		console.error('Error: --type is required and must be one of:', VALID_TYPES.join(', '));
		process.exit(1);
	}

	const since = getVal('--since');
	const until = getVal('--until');
	const out = getVal('--out');
	const all = hasFlag('--all');

	return { type: typeArg, since, until, out, all };
}

function requireEnv(name: string): string {
	const val = process.env[name];
	if (!val) {
		console.error(`Missing environment variable: ${name}`);
		process.exit(1);
	}
	return val;
}

function extractReportId(resp: unknown): string | undefined {
	if (!resp || typeof resp !== 'object') return undefined;
	const top = resp as Record<string, unknown>;
	if (typeof top.reportId === 'string') return top.reportId;
	const payload = top.payload as Record<string, unknown> | undefined;
	if (payload && typeof payload.reportId === 'string') return payload.reportId as string;
	return undefined;
}

function extractReportDocumentId(report: unknown): string | undefined {
	if (!report || typeof report !== 'object') return undefined;
	const obj = report as Record<string, unknown>;
	if (typeof obj.reportDocumentId === 'string') return obj.reportDocumentId as string;
	const payload = obj.payload as Record<string, unknown> | undefined;
	if (payload && typeof payload.reportDocumentId === 'string')
		return payload.reportDocumentId as string;
	return undefined;
}

function extractDocumentUrlAndCompression(document: unknown): {
	url?: string;
	compression?: string;
} {
	if (!document || typeof document !== 'object') return {};
	const obj = document as Record<string, unknown>;
	const payload = obj.payload as Record<string, unknown> | undefined;
	const url =
		(typeof obj.url === 'string' ? obj.url : undefined) ||
		(payload && typeof payload.url === 'string' ? payload.url : undefined);
	const compression =
		(typeof obj.compressionAlgorithm === 'string' ? obj.compressionAlgorithm : undefined) ||
		(payload && typeof payload.compressionAlgorithm === 'string'
			? (payload.compressionAlgorithm as string)
			: undefined);
	return { url, compression };
}

type RegionCode = 'na' | 'eu' | 'fe';

function regionFromMarketplaceId(marketplaceId: string): RegionCode {
	switch (marketplaceId) {
		case 'ATVPDKIKX0DER':
			return 'na';
		default:
			return 'na';
	}
}

function resolveReportType(type: ReportKind): string | undefined {
	switch (type) {
		case 'inventory-ledger':
			return 'GET_LEDGER_DETAIL_VIEW_DATA';
		case 'customer-returns':
			return 'GET_FBA_FULFILLMENT_CUSTOMER_RETURNS_DATA';
		case 'reimbursement':
			return 'GET_FBA_REIMBURSEMENTS_DATA';
		case 'unsuppressed-inventory':
			return 'GET_FBA_MYI_UNSUPPRESSED_INVENTORY_DATA';
		case 'inbound-shipments':
			return 'GET_FBA_FULFILLMENT_INBOUND_NONCOMPLIANCE_DATA';
		case 'returns':
			return 'GET_FBA_FULFILLMENT_CUSTOMER_RETURNS_DATA';
		default:
			return undefined;
	}
}

function buildClient(): SellingPartner {
	const clientId = requireEnv('AMAZON_CLIENT_ID');
	const clientSecret = requireEnv('AMAZON_CLIENT_SECRET');
	const refreshToken = requireEnv('AMAZON_REFRESH_TOKEN');
	const marketplaceId = requireEnv('AMAZON_MARKETPLACE_ID');
	const region = regionFromMarketplaceId(marketplaceId);

	return new SellingPartner({
		region,
		refresh_token: refreshToken,
		credentials: {
			SELLING_PARTNER_APP_CLIENT_ID: clientId,
			SELLING_PARTNER_APP_CLIENT_SECRET: clientSecret
		},
		options: {
			auto_request_tokens: true,
			auto_request_throttled: true,
			version_fallback: true,
			use_sandbox: process.env.AMAZON_IS_TEST === 'true'
		}
	});
}

async function createReport(
	client: SellingPartner,
	reportType: string,
	marketplaceId: string,
	sinceIso: string,
	untilIso: string
) {
	return client.callAPI({
		operation: 'createReport',
		endpoint: 'reports',
		body: {
			reportType: reportType as any,
			marketplaceIds: [marketplaceId],
			dataStartTime: sinceIso,
			dataEndTime: untilIso
		}
	});
}

async function getReport(client: SellingPartner, reportId: string) {
	return client.callAPI({
		operation: 'getReport',
		endpoint: 'reports',
		path: { reportId }
	});
}

function extractProcessingStatus(resp: unknown): string | undefined {
	if (!resp || typeof resp !== 'object') return undefined;
	const obj = resp as Record<string, unknown>;

	function scan(node: unknown, depth: number): string | undefined {
		if (!node || typeof node !== 'object' || depth > 4) return undefined;
		const rec = node as Record<string, unknown>;
		const direct = (rec.processingStatus || rec.reportProcessingStatus || rec.status) as
			| string
			| undefined;
		if (typeof direct === 'string') return direct;
		for (const key of Object.keys(rec)) {
			const val = rec[key];
			const found = scan(val, depth + 1);
			if (found) return found;
		}
		return undefined;
	}

	return scan(obj, 0);
}

async function waitForReportReady(
	client: SellingPartner,
	reportId: string,
	maxMs = 300000,
	intervalMs = 5000
) {
	const start = Date.now();
	let attempt = 0;
	while (Date.now() - start < maxMs) {
		attempt++;
		const resp = await getReport(client, reportId);
		const status = extractProcessingStatus(resp);
		const elapsed = Math.round((Date.now() - start) / 1000);
		if (!status && attempt <= 2) {
			// Show keys once when status couldn't be derived, to help diagnose shapes
			try {
				const r = resp as Record<string, unknown>;
				const keys = Object.keys(r);
				const snapshot = JSON.stringify({
					keys,
					errors: r.errors ?? (r.payload as any)?.errors,
					payloadKeys:
						r.payload && typeof r.payload === 'object'
							? Object.keys(r.payload as Record<string, unknown>)
							: undefined
				}).slice(0, 500);
				console.log(
					`[poll ${attempt}] reportId=${reportId} status=unknown elapsed=${elapsed}s snapshot=${snapshot}`
				);
			} catch {
				console.log(`[poll ${attempt}] reportId=${reportId} status=unknown elapsed=${elapsed}s`);
			}
		} else {
			console.log(`[poll ${attempt}] reportId=${reportId} status=${status} elapsed=${elapsed}s`);
		}
		if (status === 'DONE') return resp;
		if (status === 'FATAL' || status === 'CANCELLED')
			throw new Error(`Report ${reportId} failed with status ${status}`);
		await new Promise((r) => setTimeout(r, intervalMs));
	}
	throw new Error(`Timed out waiting for report ${reportId}`);
}

async function getReportDocument(client: SellingPartner, reportDocumentId: string) {
	return client.callAPI({
		operation: 'getReportDocument',
		endpoint: 'reports',
		path: { reportDocumentId }
	});
}

async function downloadReportToFile(url: string, compression: string | undefined, outPath: string) {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
	const arrayBuf = (await res.arrayBuffer()) as ArrayBuffer;
	const u8 = new Uint8Array(arrayBuf);
	let data: Buffer | Uint8Array = u8;
	if (compression && compression.toUpperCase() === 'GZIP') {
		data = zlib.gunzipSync(u8);
	}
	fs.writeFileSync(outPath, data);
}

async function runForType(
	client: SellingPartner,
	type: ReportKind,
	sinceIso: string,
	untilIso: string,
	out?: string
) {
	const marketplaceId = requireEnv('AMAZON_MARKETPLACE_ID');
	const reportType = resolveReportType(type);
	if (!reportType) {
		console.error(`Unknown report type: ${type}`);
		return;
	}

	const createResp = await createReport(client, reportType, marketplaceId, sinceIso, untilIso);
	const reportId = extractReportId(createResp);
	if (!reportId) {
		console.error(`[${type}] Failed to create report: no reportId returned`);
		return;
	}
	console.log(`[${type}] Created report: ${reportId}`);

	const report = await waitForReportReady(client, reportId);
	const reportDocumentId = extractReportDocumentId(report);
	if (!reportDocumentId) {
		console.error(`[${type}] Report ready but no reportDocumentId found`);
		return;
	}
	console.log(`[${type}] Report ready. documentId=${reportDocumentId}`);

	const document = await getReportDocument(client, reportDocumentId);
	const { url, compression } = extractDocumentUrlAndCompression(document);
	if (!url) {
		console.error(`[${type}] No URL in report document`);
		return;
	}

	const defaultName = `${type}-${sinceIso.slice(0, 10)}_${untilIso.slice(0, 10)}.tsv`;
	const outFile = path.resolve(process.cwd(), out || defaultName);
	await downloadReportToFile(url, compression, outFile);
	console.log(`[${type}] Saved report to ${outFile}`);
}

async function main() {
	const { type, since, until, out, all } = parseArgs();

	const client = buildClient();

	const now = new Date();
	const untilDate = until ? new Date(until) : now;
	const sinceDate = since ? new Date(since) : new Date(untilDate);
	if (!since) {
		// default to last 3 calendar months
		sinceDate.setMonth(sinceDate.getMonth() - 3);
	}
	const sinceIso = sinceDate.toISOString();
	const untilIso = untilDate.toISOString();

	if (all) {
		const sequence: ReportKind[] = [
			'inventory-ledger',
			'customer-returns',
			'reimbursement',
			'unsuppressed-inventory',
			'inbound-shipments'
		];
		for (const t of sequence) {
			await runForType(client, t, sinceIso, untilIso);
		}
	} else {
		await runForType(client, type, sinceIso, untilIso, out);
	}
}

main().catch((err) => {
	console.error(err instanceof Error ? err.message : String(err));
	process.exit(1);
});
