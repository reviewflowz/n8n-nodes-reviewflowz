import type {
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	IWebhookFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

// Every call goes to API v3 with the connection's API key or OAuth token. Our
// errors are RFC 9457 problems ({ title, detail, code, errors: [{ field,
// detail }] }); they reach the user as we wrote them, the field named,
// because ours already say what to do next.

export type ReviewflowzContext = IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions | IWebhookFunctions;

const DEFAULT_BASE_URL = 'https://api.reviewflowz.com/v3';

/** An answer whose status the caller handles itself (see apiCall). */
export type Answer = { status: number; body: IDataObject; message: string };

const credentialType = (context: ReviewflowzContext): string => {
	const authentication = (context as IExecuteFunctions).getNodeParameter('authentication', 0, 'apiKey') as string;
	return authentication === 'oAuth2' ? 'reviewflowzOAuth2Api' : 'reviewflowzApi';
};

export const problemMessage = (problem: IDataObject | undefined, status: number): string => {
	if (!problem || typeof problem !== 'object') return `Reviewflowz answered ${status}.`;
	const errors = Array.isArray(problem.errors) ? (problem.errors as IDataObject[]) : [];
	const fields = errors
		.map((error) => (error.field ? `${error.field as string}: ${error.detail as string}` : (error.detail as string)))
		.filter(Boolean);
	const detail = (problem.detail as string) || (problem.title as string) || `Reviewflowz answered ${status}.`;
	if (fields.length === 0 || fields.some((line) => detail.includes(line))) return detail;
	return `${detail} ${fields.join(' ')}`;
};

// The answer body an n8n HTTP error carries, wherever this n8n version keeps it.
const errorBody = (error: IDataObject): IDataObject | undefined => {
	const candidates = [
		(error.response as IDataObject | undefined)?.body,
		(error.response as IDataObject | undefined)?.data,
		((error.cause as IDataObject | undefined)?.response as IDataObject | undefined)?.data,
		((error.cause as IDataObject | undefined)?.response as IDataObject | undefined)?.body,
		(error.context as IDataObject | undefined)?.data,
	];
	for (const candidate of candidates) {
		if (candidate && typeof candidate === 'object') return candidate as IDataObject;
		if (typeof candidate === 'string') {
			try {
				return JSON.parse(candidate) as IDataObject;
			} catch {
				// not JSON
			}
		}
	}
	return undefined;
};

const errorStatus = (error: IDataObject): number => {
	const candidates = [
		error.httpCode,
		(error.response as IDataObject | undefined)?.status,
		(error.response as IDataObject | undefined)?.statusCode,
		((error.cause as IDataObject | undefined)?.response as IDataObject | undefined)?.status,
		error.statusCode,
	];
	for (const candidate of candidates) {
		const status = Number(candidate);
		if (Number.isFinite(status) && status > 0) return status;
	}
	return 0;
};

/**
 * One call to API v3. `allow` lists statuses the caller handles itself (a 404
 * on a delete that was already gone): those come back as the answer, with
 * their status, instead of failing the node. Anything else 4xx/5xx fails the
 * node with our own words.
 */
export async function apiCall(
	this: ReviewflowzContext,
	method: IHttpRequestMethods,
	path: string,
	body?: IDataObject,
	qs?: IDataObject,
	options: { allow?: number[]; headers?: IDataObject } = {},
): Promise<Answer> {
	const type = credentialType(this);
	const credentials = await this.getCredentials(type);
	const baseUrl = String(credentials.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');

	const request: IHttpRequestOptions = {
		method,
		url: `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`,
		headers: { Accept: 'application/json', 'User-Agent': 'Reviewflowz-n8n/0.1', ...(options.headers ?? {}) },
		json: true,
	};
	if (body !== undefined) request.body = body;
	if (qs !== undefined) request.qs = qs;

	try {
		const answer = (await this.helpers.httpRequestWithAuthentication.call(this, type, request)) as unknown;
		return { status: 200, body: (answer && typeof answer === 'object' ? answer : {}) as IDataObject, message: '' };
	} catch (caught) {
		const error = caught as IDataObject;
		const status = errorStatus(error);
		const problem = errorBody(error);
		const message = problemMessage(problem, status);
		if (options.allow?.includes(status)) return { status, body: problem ?? {}, message };
		throw new NodeApiError(this.getNode(), (problem ?? error) as JsonObject, {
			message: status === 429 ? `Reviewflowz asks to slow down: ${message} Turn on 'Retry On Fail' in the node's settings to wait and try again.` : message,
			httpCode: status ? String(status) : undefined,
		});
	}
}

/** One call to API v3 that must succeed: its answer's body. */
export async function apiRequest(
	this: ReviewflowzContext,
	method: IHttpRequestMethods,
	path: string,
	body?: IDataObject,
	qs?: IDataObject,
	options: { headers?: IDataObject } = {},
): Promise<IDataObject> {
	return (await apiCall.call(this, method, path, body, qs, options)).body;
}

/** GET a list page by page (cursor pagination), up to `max` rows. */
export async function listAll(
	this: ReviewflowzContext,
	path: string,
	qs: IDataObject = {},
	max = 500,
): Promise<IDataObject[]> {
	const rows: IDataObject[] = [];
	let cursor: string | undefined;
	do {
		const page = await apiRequest.call(this, 'GET', path, undefined, {
			limit: Math.min(100, max),
			...qs,
			...(cursor ? { cursor } : {}),
		});
		rows.push(...((page.data as IDataObject[]) ?? []));
		cursor = page.has_more ? (page.next_cursor as string) : undefined;
	} while (cursor && rows.length < max);
	return rows.slice(0, max);
}

/** One page of a list, for searchable dropdowns. */
export async function listPage(
	this: ReviewflowzContext,
	path: string,
	cursor?: string,
	qs: IDataObject = {},
): Promise<{ rows: IDataObject[]; next?: string }> {
	const page = await apiRequest.call(this, 'GET', path, undefined, { limit: 100, ...qs, ...(cursor ? { cursor } : {}) });
	return {
		rows: (page.data as IDataObject[]) ?? [],
		next: page.has_more ? (page.next_cursor as string) : undefined,
	};
}
