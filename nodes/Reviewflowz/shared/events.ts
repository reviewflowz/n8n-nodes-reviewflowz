import type { IDataObject } from 'n8n-workflow';
import { createHmac, timingSafeEqual } from 'crypto';

import catalog from './events.json';
import { EVENT_LABELS } from './eventLabels';
import { apiRequest, type ReviewflowzContext } from './transport';

// The webhook events (shared/events.json: our catalog, copied from the Zapier
// app's at build time), what each one can be filtered on, and how a delivery
// becomes the trigger's output. The same rules as zapier/triggers/events.js.

export type Envelope = { id?: string; type?: string; timestamp?: string; data?: IDataObject };
export type CatalogEvent = { type: string; group: string; description: string; sample: Envelope };

export const EVENTS = catalog as unknown as CatalogEvent[];

export const eventOptions = () =>
	EVENTS.map((event) => ({
		name: `${event.group}: ${EVENT_LABELS[event.type]?.label ?? event.type}`,
		value: event.type,
		description: EVENT_LABELS[event.type]?.description ?? event.description,
	})).sort((a, b) => a.name.localeCompare(b.name));

// The filters that make sense for each event, by what its object is.
export const filtersFor = (type: string): string[] => {
	if (type === 'review.tagged' || type === 'review.untagged') return ['sources', 'locations', 'platforms', 'tags'];
	if (type === 'review.owner_assigned' || type === 'review.owner_unassigned') return ['sources', 'locations', 'platforms', 'owners'];
	if (type === 'review.deleted') return ['sources'];
	if (type.startsWith('review.')) return ['sources', 'locations', 'platforms', 'ratingMin', 'ratingMax'];
	if (type.startsWith('reply.')) return ['sources'];
	if (type.startsWith('source.') || type.startsWith('rating.')) return ['sources', 'locations', 'platforms'];
	if (type.startsWith('invitation.')) return ['campaigns'];
	if (type === 'contact.reviewed') return ['campaigns', 'sources'];
	if (type === 'contact.opted_out') return ['channel'];
	if (type.startsWith('campaign.')) return ['campaigns'];
	return [];
};

const chosen = (value: unknown): string[] =>
	(Array.isArray(value) ? value : value ? String(value).split(',') : []).map((v) => String(v).trim()).filter(Boolean);

// Whether an event passes the trigger's filters. Only the filters its kind of
// event has apply: a campaign filter says nothing about a review event.
export const matches = (envelope: Envelope, filters: IDataObject): boolean => {
	const data = envelope.data ?? {};
	const object = (data.object as IDataObject) ?? {};
	const type = envelope.type ?? '';
	const sourceId = type.startsWith('source.') || type.startsWith('rating.') ? object.id : object.source ?? data.source;
	const campaignId = type.startsWith('campaign.') ? object.id : object.campaign ?? data.campaign;

	const checks: Array<[string, unknown]> = [
		['sources', sourceId],
		['locations', object.location],
		['platforms', object.platform],
		['campaigns', campaignId],
		['tags', data.tag],
		['owners', data.owner],
		['channel', data.channel],
	];
	const applies = filtersFor(type);
	for (const [key, value] of checks) {
		if (!applies.includes(key)) continue;
		const wanted = chosen(filters[key]);
		if (wanted.length && !wanted.includes(String(value))) return false;
	}
	const rating = typeof object.rating === 'number' ? object.rating : null;
	const min = applies.includes('ratingMin') && filters.ratingMin !== undefined ? Number(filters.ratingMin) : NaN;
	const max = applies.includes('ratingMax') && filters.ratingMax !== undefined ? Number(filters.ratingMax) : NaN;
	if (Number.isFinite(min) && (rating === null || rating < min)) return false;
	if (Number.isFinite(max) && (rating === null || rating > max)) return false;
	return true;
};

// The object at the top, as GET /v3/... returns it, and the event beside it:
// its id, type, time and the facts it carries (the tag added, the reason a
// request wasn't sent...). A gone object (review.deleted) is { id, deleted }.
export const toOutput = (envelope: Envelope): IDataObject => {
	const { object, ...facts } = envelope.data ?? {};
	return {
		...((object as IDataObject) ?? {}),
		event: { id: envelope.id, type: envelope.type, timestamp: envelope.timestamp, ...facts },
	};
};

// ---- signatures (Standard Webhooks) -------------------------------------------

const TOLERANCE_SECONDS = 30 * 60;

/**
 * Whether a delivery was signed with this endpoint's secret. Fails closed:
 * every endpoint the trigger subscribes gets a secret, so a delivery without
 * one, or without its raw body, can't be checked and isn't trusted.
 */
export const signed = (
	secret: unknown,
	rawBody: Buffer | string | undefined,
	headers: Record<string, string | string[] | undefined>,
	now = Date.now(),
): boolean => {
	if (typeof secret !== 'string' || !secret || rawBody === undefined) return false;
	const header = (name: string) => {
		const value = headers[name];
		return Array.isArray(value) ? value[0] : value;
	};
	const id = header('webhook-id');
	const timestamp = parseInt(header('webhook-timestamp') ?? '', 10);
	const signatures = String(header('webhook-signature') ?? '').split(' ');
	if (!id || !Number.isFinite(timestamp)) return false;
	if (Math.abs(now / 1000 - timestamp) > TOLERANCE_SECONDS) return false;

	const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
	const body = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody;
	const expected = `v1,${createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64')}`;
	return signatures.some(
		(signature) => signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected)),
	);
};

// ---- names beside ids ---------------------------------------------------------

const fetchOne = async (ctx: ReviewflowzContext, path: string): Promise<IDataObject | null> => {
	try {
		return await apiRequest.call(ctx, 'GET', path);
	} catch {
		return null;
	}
};

/**
 * Our payloads carry ids (src_12, loc_3, con_...). A workflow wants names:
 * adds source_name, location_name, campaign_name and the contact's details
 * beside the ids they explain. Never fails the trigger: a name we can't read
 * is left out.
 */
export const enrich = async (ctx: ReviewflowzContext, row: IDataObject): Promise<IDataObject> => {
	const out: IDataObject = { ...row };
	const event = (row.event as IDataObject) ?? {};
	const tasks: Array<Promise<void>> = [];
	const path = (kind: string, id: unknown) => `/${kind}/${encodeURIComponent(String(id))}`;

	if (typeof row.source === 'string') {
		tasks.push(
			fetchOne(ctx, path('sources', row.source)).then((s) => {
				if (s) Object.assign(out, { source_name: s.name, source_url: s.url });
			}),
		);
	} else if (typeof event.source === 'string') {
		tasks.push(
			fetchOne(ctx, path('sources', event.source)).then((s) => {
				if (s) out.event = { ...(out.event as IDataObject), source_name: s.name };
			}),
		);
	}
	if (typeof row.location === 'string') {
		tasks.push(
			fetchOne(ctx, path('locations', row.location)).then((l) => {
				if (l) out.location_name = l.name;
			}),
		);
	}
	if (typeof row.campaign === 'string') {
		tasks.push(
			fetchOne(ctx, path('campaigns', row.campaign)).then((c) => {
				if (c) out.campaign_name = c.name;
			}),
		);
	}
	if (typeof row.contact === 'string') {
		tasks.push(
			fetchOne(ctx, path('contacts', row.contact)).then((c) => {
				if (c) out.contact = c;
			}),
		);
	}
	if (typeof event.campaign === 'string') {
		tasks.push(
			fetchOne(ctx, path('campaigns', event.campaign)).then((c) => {
				if (c) out.event = { ...(out.event as IDataObject), campaign_name: c.name };
			}),
		);
	}
	await Promise.all(tasks);
	return out;
};
