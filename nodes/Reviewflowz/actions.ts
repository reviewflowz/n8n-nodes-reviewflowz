import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { platformName } from './shared/format';
import { apiCall, apiRequest, listAll } from './shared/transport';

// What each operation does, with the same calls and rules as the Zapier app
// (zapier/creates/requests.js, zapier/creates/reviews.js, zapier/searches).
// Every call is API v3's, so the app's own rules apply: the same send checks,
// credits and confirmation.

type Result = IDataObject | IDataObject[];
type Operation = (this: IExecuteFunctions, i: number) => Promise<Result>;

const param = <T>(ctx: IExecuteFunctions, name: string, i: number, fallback?: T): T =>
	ctx.getNodeParameter(name, i, fallback) as T;

const locator = (ctx: IExecuteFunctions, name: string, i: number): string =>
	String(ctx.getNodeParameter(name, i, '', { extractValue: true }) ?? '').trim();

const get = async (ctx: IExecuteFunctions, path: string, qs?: IDataObject) => apiRequest.call(ctx, 'GET', path, undefined, qs);

const many = async (ctx: IExecuteFunctions, i: number, path: string, qs: IDataObject = {}): Promise<IDataObject[]> => {
	const all = param<boolean>(ctx, 'returnAll', i, false);
	return listAll.call(ctx, path, qs, all ? 100000 : param<number>(ctx, 'limit', i, 50));
};

// Exact name matches first; when none, everything the search found.
const named = (rows: IDataObject[], name: string): IDataObject[] => {
	const wanted = name.trim().toLowerCase();
	if (!wanted) return rows;
	const exact = rows.filter((row) => String(row.name ?? '').toLowerCase() === wanted);
	return exact.length ? exact : rows;
};

const compact = (object: IDataObject): IDataObject => {
	for (const key of Object.keys(object)) {
		const value = object[key];
		if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) delete object[key];
	}
	return object;
};

const contactFieldsFrom = (ctx: IExecuteFunctions, i: number): IDataObject => {
	const fields = param<{ field?: Array<{ name: string; value: string }> }>(ctx, 'contactFields', i, {});
	const attributes: IDataObject = {};
	for (const field of fields.field ?? []) {
		if (field.name && field.value !== undefined && field.value !== '') attributes[field.name] = field.value;
	}
	return attributes;
};

// ---- Review requests ----------------------------------------------------------

// Why someone added to a campaign gets no request (CampaignManualAddPlan).
const REASONS: Record<string, string> = {
	invalid_email: 'Their email address failed our check.',
	already_invited: "They already had this campaign's request.",
	no_location: 'They have no location, and this campaign needs one to pick where to send them.',
	channel_unavailable: "This campaign's channel isn't set up on your account yet (Settings > Request sending).",
	no_email: 'They have no email address, and this campaign sends emails.',
	no_phone: 'They have no phone number, and this campaign sends texts.',
	unsubscribed: 'They unsubscribed from review requests on this channel.',
	low_reputation: 'Email sending is paused while your sender reputation recovers.',
	quota_exceeded: 'Your plan has no review requests left this month.',
	subscription_required: 'Review requests need a paid plan.',
	no_credit: 'Your account has no credits left for this channel. Buy credits in the app, or turn on auto-recharge.',
};

async function sendReviewRequest(this: IExecuteFunctions, i: number): Promise<IDataObject> {
	const campaignId = locator(this, 'campaign', i);
	const email = param<string>(this, 'email', i, '').trim();
	const phone = param<string>(this, 'phone', i, '').trim();
	const options = param<IDataObject>(this, 'options', i, {});
	const campaign = await get(this, `/campaigns/${encodeURIComponent(campaignId)}`);
	const name = campaign.name as string;

	const texting = campaign.channel === 'sms' || campaign.channel === 'whatsapp';
	if (texting ? !phone : !email) {
		throw new NodeOperationError(
			this.getNode(),
			texting
				? `${name} sends texts, and this customer has no phone number. Map the customer's phone into 'Phone Number'.`
				: `${name} sends emails, and this customer has no email. Map the customer's email into 'Email'.`,
			{ itemIndex: i },
		);
	}
	if (campaign.state !== 'active' && options.whenOff !== 'add') {
		throw new NodeOperationError(
			this.getNode(),
			`${name} is off, so ${email || phone || 'this customer'} would never get its request. Turn the campaign on in Reviewflowz, or set 'If the Campaign Is Off' to add them anyway.`,
			{ itemIndex: i },
		);
	}

	const contact = compact({
		email,
		phone,
		first_name: param<string>(this, 'firstName', i, ''),
		last_name: param<string>(this, 'lastName', i, ''),
		location: param<string>(this, 'location', i, ''),
	});
	const attributes = contactFieldsFrom(this, i);
	if (Object.keys(attributes).length) contact.attributes = attributes;

	const answer = await apiCall.call(
		this,
		'POST',
		`/campaigns/${encodeURIComponent(campaignId)}/contacts`,
		{ contacts: [contact], confirm: true },
		undefined,
		{ allow: options.whenAlreadyIn === 'error' ? [] : [422] },
	);
	if (answer.status === 422) {
		// Already in this campaign: by default that's fine, they had their request.
		const errors = (answer.body.errors as IDataObject[]) ?? [];
		if (errors.length && errors.every((e) => /already in this campaign/i.test(String(e.detail ?? '')))) {
			return {
				result: 'already_in_campaign',
				sent: false,
				message: "Already in this campaign: they don't get a second request.",
				campaign: campaign.id,
				campaign_name: name,
				email: email || null,
				phone: phone || null,
			};
		}
		throw new NodeOperationError(this.getNode(), answer.message, { itemIndex: i });
	}

	const row = ((answer.body.data as IDataObject[]) ?? [])[0] ?? {};
	const reason = row.unreachable as string | undefined;
	const off = campaign.state !== 'active';
	return {
		result: row.sends ? 'request_on_its_way' : 'added_without_request',
		sent: Boolean(row.sends),
		message: row.sends
			? `Added to ${name}. The request goes out on the campaign's schedule.`
			: `Added to ${name}, but no request goes out: ${(reason && REASONS[reason]) || (off ? 'the campaign is off.' : reason || 'see the contact in Reviewflowz.')}`,
		reason: reason || (row.sends ? null : off ? 'campaign_off' : null),
		contact_id: row.contact,
		campaign: campaign.id,
		campaign_name: name,
		channel: campaign.channel,
		email: email || null,
		phone: phone || null,
	};
}

async function getReviewRequests(this: IExecuteFunctions, i: number): Promise<IDataObject[]> {
	return many(this, i, '/invitations', compact({ contact: param<string>(this, 'contact', i, ''), campaign: param<string>(this, 'campaignFilter', i, '') }));
}

// ---- Campaigns ----------------------------------------------------------------

const campaignOutput = (campaign: IDataObject): IDataObject => ({
	...campaign,
	destinations_summary: ((campaign.destinations as IDataObject[]) ?? [])
		.map(
			(d) =>
				(d.platform ? platformName(d.platform) : (d.source as string)) +
				(d.goal !== 'most_reviews' && d.target ? ` (until ${d.target as number}${d.goal === 'rating' ? ' rating' : ' 5-star reviews'})` : ''),
		)
		.join(', '),
	blockers_summary: ((campaign.blockers as string[]) ?? []).join(' '),
});

// The campaign's body from its fields: name, delay, message, destinations.
const campaignBody = (fields: IDataObject): IDataObject => {
	const body: IDataObject = {};
	if (fields.name) body.name = fields.name;
	if (fields.sendDelayHours !== undefined && fields.sendDelayHours !== '') {
		body.send_delay_minutes = Math.round(Number(fields.sendDelayHours) * 60);
	}
	const message = compact({ subject: fields.subject, body: fields.body, cta_text: fields.ctaText });
	if (Object.keys(message).length) body.message = message;

	const goal = (fields.goal as string) || 'most_reviews';
	const target = fields.target !== undefined && fields.target !== '' && Number(fields.target) > 0 ? Number(fields.target) : undefined;
	const destinations = ((fields.destinations as string[]) ?? []).filter(Boolean).map((value, index) => {
		const [kind, ...rest] = String(value).split(':');
		const id = rest.join(':');
		const row: IDataObject = kind === 'platform' ? { platform: id } : kind === 'source' ? { source: id } : { source: value };
		if (index === 0 && goal !== 'most_reviews') Object.assign(row, { goal, target });
		return row;
	});
	if (destinations.length) body.destinations = destinations;
	return body;
};

const activate = async (ctx: IExecuteFunctions, id: string) =>
	apiRequest.call(ctx, 'POST', `/campaigns/${encodeURIComponent(id)}/activate`);

async function createCampaign(this: IExecuteFunctions, i: number): Promise<IDataObject> {
	const body = {
		...campaignBody(param<IDataObject>(this, 'additionalFields', i, {})),
		name: param<string>(this, 'name', i),
		channel: param<string>(this, 'channel', i, 'email'),
	};
	let campaign = await apiRequest.call(this, 'POST', '/campaigns', body);
	if (param<boolean>(this, 'turnOn', i, false)) campaign = await activate(this, campaign.id as string);
	return campaignOutput(campaign);
}

async function updateCampaign(this: IExecuteFunctions, i: number): Promise<IDataObject> {
	const id = locator(this, 'campaign', i);
	const body = campaignBody(param<IDataObject>(this, 'updateFields', i, {}));
	const current = await get(this, `/campaigns/${encodeURIComponent(id)}`);
	const wasOn = current.state === 'active';
	if (wasOn && param<string>(this, 'whenOn', i, 'pause_and_resume') === 'error') {
		throw new NodeOperationError(
			this.getNode(),
			`${current.name as string} is on. Pause it first, or set 'If the Campaign Is On' to pause and resume it.`,
			{ itemIndex: i },
		);
	}
	// One call: a campaign that is on is changed in place, still sending, in
	// the same request, so a failed or retried step can't leave it off.
	const campaign = await apiRequest.call(this, 'PATCH', `/campaigns/${encodeURIComponent(id)}`, wasOn ? { ...body, while_on: 'pause_and_resume' } : body);
	return campaignOutput(campaign);
}

async function pauseCampaign(this: IExecuteFunctions, i: number): Promise<IDataObject> {
	const id = locator(this, 'campaign', i);
	const answer = await apiCall.call(this, 'POST', `/campaigns/${encodeURIComponent(id)}/pause`, undefined, undefined, { allow: [409] });
	// Already off: nothing to do, which is what the workflow wanted.
	if (answer.status === 409) return campaignOutput(await get(this, `/campaigns/${encodeURIComponent(id)}`));
	return campaignOutput(answer.body);
}

async function getCampaigns(this: IExecuteFunctions, i: number): Promise<IDataObject[]> {
	const name = param<string>(this, 'nameFilter', i, '').trim().toLowerCase();
	if (!name) return (await many(this, i, '/campaigns')).map(campaignOutput);
	const rows = await listAll.call(this, '/campaigns', {}, 100000);
	const hits = rows.filter((c) => String(c.name).toLowerCase() === name);
	const found = hits.length ? hits : rows.filter((c) => String(c.name).toLowerCase().includes(name));
	const all = param<boolean>(this, 'returnAll', i, false);
	return (all ? found : found.slice(0, param<number>(this, 'limit', i, 50))).map(campaignOutput);
}

// ---- Contacts -----------------------------------------------------------------

const upsertContact = async (ctx: IExecuteFunctions, i: number, withFields: boolean): Promise<IDataObject> => {
	const row = compact({
		email: param<string>(ctx, 'email', i, '').trim(),
		phone: param<string>(ctx, 'phone', i, '').trim(),
		first_name: param<string>(ctx, 'firstName', i, ''),
		last_name: param<string>(ctx, 'lastName', i, ''),
	});
	if (!row.email && !row.phone) {
		throw new NodeOperationError(ctx.getNode(), "Fill 'Email' or 'Phone Number': a contact is found and saved by one of them.", { itemIndex: i });
	}
	if (withFields) {
		const attributes = contactFieldsFrom(ctx, i);
		if (Object.keys(attributes).length) row.attributes = attributes;
	}
	const answer = await apiRequest.call(ctx, 'POST', '/contacts/batch', { contacts: [row] });
	const result = ((answer.data as IDataObject[]) ?? [])[0] ?? {};
	if (result.status === 'failed') {
		const detail = ((result.errors as IDataObject[]) ?? [])
			.map((e) => (e.field ? `${e.field as string}: ${e.detail as string}` : (e.detail as string)))
			.join(' ');
		throw new NodeOperationError(ctx.getNode(), detail || 'Reviewflowz could not save this contact.', { itemIndex: i });
	}
	// The batch answers with the id; the contact itself is read back whole.
	const contact = await get(ctx, `/contacts/${encodeURIComponent(result.id as string)}`);
	return { ...contact, status: result.status };
};

async function addToSegment(this: IExecuteFunctions, i: number): Promise<IDataObject> {
	const segment = locator(this, 'segment', i);
	const contact = await upsertContact(this, i, false);
	await apiRequest.call(this, 'POST', `/segments/${encodeURIComponent(segment)}/members`, { add: [contact.id] });
	return { ...contact, segment };
}

async function unsubscribe(this: IExecuteFunctions, i: number): Promise<IDataObject> {
	const body = compact({
		email: param<string>(this, 'email', i, '').trim(),
		phone: param<string>(this, 'phone', i, '').trim(),
		channels: param<string[]>(this, 'channels', i, []),
	});
	if (!body.email && !body.phone) {
		throw new NodeOperationError(this.getNode(), "Fill 'Email' or 'Phone Number' to unsubscribe.", { itemIndex: i });
	}
	return apiRequest.call(this, 'POST', '/opt-outs', body);
}

async function getContacts(this: IExecuteFunctions, i: number): Promise<IDataObject[]> {
	const email = param<string>(this, 'email', i, '').trim();
	const phone = param<string>(this, 'phone', i, '').trim();
	return many(this, i, '/contacts', email ? { email } : phone ? { phone } : {});
}

// ---- Replies ------------------------------------------------------------------

async function replyToReview(this: IExecuteFunctions, i: number): Promise<IDataObject> {
	const review = param<string>(this, 'review', i).trim();
	return apiRequest.call(this, 'POST', `/reviews/${encodeURIComponent(review)}/reply`, {
		text: param<string>(this, 'text', i),
		publish: param<boolean>(this, 'publish', i, true),
	});
}

async function writeReplyWithAi(this: IExecuteFunctions, i: number): Promise<IDataObject> {
	const review = param<string>(this, 'review', i).trim();
	const body: IDataObject = { save: param<boolean>(this, 'save', i, true) };
	const agent = param<string>(this, 'agent', i, '');
	if (agent) body.agent = agent;
	return apiRequest.call(this, 'POST', `/reviews/${encodeURIComponent(review)}/reply/draft`, body);
}

// ---- Reviews ------------------------------------------------------------------

const getReview = async (ctx: IExecuteFunctions, i: number, id: string): Promise<IDataObject> => {
	const answer = await get(ctx, '/reviews', { id, include: 'reply' });
	const review = ((answer.data as IDataObject[]) ?? [])[0];
	if (!review) throw new NodeOperationError(ctx.getNode(), `No review ${id} on this account. Check 'Review ID'.`, { itemIndex: i });
	return review;
};

// A tag picked from the list or typed by ID, or by name (made when adding and
// it doesn't exist yet).
const tagId = async (ctx: IExecuteFunctions, i: number, create: boolean): Promise<string> => {
	const value = locator(ctx, 'tag', i);
	if (/^tag_\d+$/.test(value)) return value;
	const answer = await get(ctx, '/tags', { q: value });
	const found = ((answer.data as IDataObject[]) ?? []).find((tag) => String(tag.name).toLowerCase() === value.toLowerCase());
	if (found) return found.id as string;
	if (!create) throw new NodeOperationError(ctx.getNode(), `No tag named ${value}. Check 'Tag'.`, { itemIndex: i });
	return (await apiRequest.call(ctx, 'POST', '/tags', { name: value })).id as string;
};

async function addTag(this: IExecuteFunctions, i: number): Promise<IDataObject> {
	const review = param<string>(this, 'review', i).trim();
	const tag = await tagId(this, i, true);
	await apiRequest.call(this, 'PUT', `/reviews/${encodeURIComponent(review)}/tags/${encodeURIComponent(tag)}`);
	return getReview(this, i, review);
}

async function removeTag(this: IExecuteFunctions, i: number): Promise<IDataObject> {
	const review = param<string>(this, 'review', i).trim();
	const tag = await tagId(this, i, false);
	// A 404 is a tag that wasn't on the review: nothing to take off.
	await apiCall.call(this, 'DELETE', `/reviews/${encodeURIComponent(review)}/tags/${encodeURIComponent(tag)}`, undefined, undefined, { allow: [404] });
	return getReview(this, i, review);
}

async function creditTeamMember(this: IExecuteFunctions, i: number): Promise<IDataObject> {
	const review = param<string>(this, 'review', i).trim();
	const owner = param<string>(this, 'owner', i);
	await apiRequest.call(this, 'PUT', `/reviews/${encodeURIComponent(review)}/owners/${encodeURIComponent(owner)}`);
	return getReview(this, i, review);
}

async function getReviews(this: IExecuteFunctions, i: number): Promise<IDataObject[]> {
	const filters = param<IDataObject>(this, 'filters', i, {});
	const join = (value: unknown): string => (Array.isArray(value) ? value.join(',') : String(value ?? ''));
	return many(
		this,
		i,
		'/reviews',
		compact({
			include: 'reply',
			q: filters.q,
			source: join(filters.source),
			location: join(filters.location),
			platform: join(filters.platform),
			rating_min: filters.rating_min,
			rating_max: filters.rating_max,
		}),
	);
}

// ---- Sources ------------------------------------------------------------------

async function addSource(this: IExecuteFunctions, i: number): Promise<IDataObject> {
	const body = compact({ urls: [param<string>(this, 'url', i).trim()], location: param<string>(this, 'location', i, '') });
	const answer = await apiRequest.call(this, 'POST', '/sources', body, undefined, { headers: { Prefer: 'wait=20' } });
	const added = ((answer.data as IDataObject[]) ?? [])[0];
	const rejected = ((answer.rejected as IDataObject[]) ?? [])[0];
	if (!added && rejected) {
		throw new NodeOperationError(this.getNode(), (rejected.detail as string) || (rejected.reason as string) || 'We could not add that listing. Check \'Listing URL\'.', {
			itemIndex: i,
		});
	}
	return added ?? answer;
}

async function getSources(this: IExecuteFunctions, i: number): Promise<IDataObject[]> {
	const filters = param<IDataObject>(this, 'filters', i, {});
	const rows = await many(this, i, '/sources', compact({ q: filters.q, domain: filters.domain, platform: filters.platform }));
	return rows.map((source) => ({ ...source, platform_name: platformName(source.platform) }));
}

// ---- Locations, tags, team members, listings ----------------------------------

const searchByName = (path: string): Operation =>
	async function (this: IExecuteFunctions, i: number) {
		const name = param<string>(this, 'nameFilter', i, '').trim();
		return named(await many(this, i, path, name ? { q: name } : {}), name);
	};

async function createLocation(this: IExecuteFunctions, i: number): Promise<IDataObject> {
	return apiRequest.call(
		this,
		'POST',
		'/locations',
		compact({ name: param<string>(this, 'name', i), address: param<string>(this, 'address', i, ''), url: param<string>(this, 'url', i) }),
	);
}

export const OPERATIONS: Record<string, Record<string, Operation>> = {
	reviewRequest: { send: sendReviewRequest, getAll: getReviewRequests },
	campaign: {
		create: createCampaign,
		update: updateCampaign,
		turnOn: async function (i) {
			return campaignOutput(await activate(this, locator(this, 'campaign', i)));
		},
		pause: pauseCampaign,
		get: async function (i) {
			return campaignOutput(await get(this, `/campaigns/${encodeURIComponent(locator(this, 'campaign', i))}`));
		},
		getAll: getCampaigns,
	},
	contact: {
		upsert: async function (i) {
			return upsertContact(this, i, true);
		},
		addToSegment,
		unsubscribe,
		getAll: getContacts,
	},
	reply: { create: replyToReview, generate: writeReplyWithAi },
	review: {
		get: async function (i) {
			return getReview(this, i, param<string>(this, 'review', i).trim());
		},
		getAll: getReviews,
		addTag,
		removeTag,
		creditTeamMember,
	},
	source: {
		create: addSource,
		sync: async function (i) {
			return apiRequest.call(this, 'POST', `/sources/${encodeURIComponent(locator(this, 'source', i))}/sync`);
		},
		setDimension: async function (i) {
			const source = locator(this, 'source', i);
			const key = param<string>(this, 'dimension', i).trim();
			return apiRequest.call(this, 'PUT', `/sources/${encodeURIComponent(source)}/dimensions/${encodeURIComponent(key)}`, {
				value: param<string>(this, 'value', i),
			});
		},
		getAll: getSources,
		getRating: async function (i) {
			const answer = await get(this, '/ratings', { source: locator(this, 'source', i), limit: 1 });
			return (answer.data as IDataObject[]) ?? [];
		},
	},
	location: { create: createLocation, getAll: searchByName('/locations') },
	tag: { getAll: searchByName('/tags') },
	teamMember: { getAll: searchByName('/owners') },
	listing: {
		lookUp: async function (i) {
			const answer = await get(this, '/lookup', { q: param<string>(this, 'q', i), platform: param<string>(this, 'platform', i) });
			return (answer.data as IDataObject[]) ?? [];
		},
	},
};
