import type {
	IDataObject,
	ILoadOptionsFunctions,
	INodeListSearchResult,
	INodePropertyOptions,
} from 'n8n-workflow';

import { campaignLabel, ownerLabel, platformName, replyAgentLabel, segmentLabel, sourceLabel } from './format';
import { apiRequest, listAll, listPage } from './transport';

// The dropdowns: sources, locations, campaigns... Each row gets a name a
// person recognises (the source's name and platform, the campaign's channel
// and whether it's on), as in the Zapier app.

const options = (rows: IDataObject[], label: (row: IDataObject) => string): INodePropertyOptions[] =>
	rows.map((row) => ({ name: label(row), value: row.id as string }));

const searchable =
	(path: string, label: (row: IDataObject) => string) =>
	async function (this: ILoadOptionsFunctions, filter?: string, paginationToken?: string): Promise<INodeListSearchResult> {
		const { rows, next } = await listPage.call(this, path, paginationToken, filter ? { q: filter } : {});
		return { results: rows.map((row) => ({ name: label(row), value: row.id as string })), paginationToken: next };
	};

// Campaigns and segments have no name search on the API: read them all, keep
// the matches.
const filtered =
	(path: string, label: (row: IDataObject) => string) =>
	async function (this: ILoadOptionsFunctions, filter?: string): Promise<INodeListSearchResult> {
		const rows = await listAll.call(this, path, {}, 1000);
		const wanted = (filter ?? '').trim().toLowerCase();
		return {
			results: rows
				.filter((row) => !wanted || String(row.name).toLowerCase().includes(wanted))
				.map((row) => ({ name: label(row), value: row.id as string })),
		};
	};

export const listSearch = {
	searchCampaigns: filtered('/campaigns', campaignLabel),
	searchSegments: filtered('/segments', segmentLabel),
	searchSources: searchable('/sources', sourceLabel),
	searchLocations: searchable('/locations', (row) => row.name as string),
	searchTags: searchable('/tags', (row) => row.name as string),
};

export const loadOptions = {
	async getSources(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
		return options(await listAll.call(this, '/sources', {}, 1000), sourceLabel);
	},
	async getLocations(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
		return options(await listAll.call(this, '/locations', {}, 1000), (row) => row.name as string);
	},
	async getCampaigns(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
		return options(await listAll.call(this, '/campaigns', {}, 1000), campaignLabel);
	},
	async getTags(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
		return options(await listAll.call(this, '/tags', {}, 1000), (row) => row.name as string);
	},
	async getTeamMembers(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
		return options(await listAll.call(this, '/owners', {}, 1000), ownerLabel);
	},
	async getReplyAgents(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
		return options(await listAll.call(this, '/reply-agents', {}, 200), replyAgentLabel);
	},
	// Every platform we track reviews on, for filters and destinations.
	async getPlatforms(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
		const answer = await apiRequest.call(this, 'GET', '/platforms');
		return ((answer.data as IDataObject[]) ?? []).map((platform) => ({
			name: (platform.name as string) || platformName(platform.id),
			value: platform.id as string,
		}));
	},
	// Custom contact fields (staff name, visit type...), for the message's merge fields.
	async getContactFields(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
		const rows = await listAll.call(this, '/contact-attributes', {}, 200);
		return rows
			.filter(
				(row) =>
					!['first_name', 'last_name', 'email', 'phone', 'phone_number'].includes(
						String(row.name).toLowerCase().replace(/\s+/g, '_'),
					),
			)
			.map((row) => ({ name: row.name as string, value: row.name as string, description: `Fills {{${row.name as string}}} in the message` }));
	},
	// Where a campaign sends reviewers: platforms or sources, as the account
	// works (GET /v3/account campaign_destinations). Values carry their kind.
	async getDestinations(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
		const account = await apiRequest.call(this, 'GET', '/account');
		if (account.campaign_destinations === 'platform') {
			const platforms = await loadOptions.getPlatforms.call(this);
			return platforms.map((platform) => ({ ...platform, value: `platform:${platform.value as string}` }));
		}
		const sources = await listAll.call(this, '/sources', {}, 1000);
		return sources.map((source) => ({ name: sourceLabel(source), value: `source:${source.id as string}` }));
	},
};
