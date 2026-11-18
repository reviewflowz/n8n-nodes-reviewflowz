import type {
	IDataObject,
	IHookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import { AUTHENTICATION } from './descriptions';
import { enrich, eventOptions, matches, signed, toOutput, type Envelope } from './shared/events';
import { loadOptions } from './shared/methods';
import { apiCall, apiRequest, listAll } from './shared/transport';

// Starts a workflow on the Reviewflowz events picked: reviews, replies,
// sources, ratings, review requests, contacts, campaigns. Activating the
// workflow subscribes its own webhook endpoint (POST /v3/webhook-endpoints)
// to those events; deactivating deletes it. Every delivery is signed
// (Standard Webhooks): the trigger checks the signature with the secret its
// endpoint got and turns away anything that doesn't match. Filters (sources,
// locations, platforms, ratings, campaigns, tags, team members) are applied
// here: an event that doesn't match never starts the workflow.

const multi = (displayName: string, name: string, method: string, description: string) => ({
	displayName,
	name,
	type: 'multiOptions' as const,
	typeOptions: { loadOptionsMethod: method },
	default: [],
	description: `${description} Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>`,
});

export class ReviewflowzTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Reviewflowz Trigger',
		name: 'reviewflowzTrigger',
		icon: { light: 'file:reviewflowz.svg', dark: 'file:reviewflowz.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["events"].join(", ")}}',
		description: 'Starts the workflow on new reviews, replies, rating changes, review requests and more in Reviewflowz',
		defaults: { name: 'Reviewflowz Trigger' },
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{ name: 'reviewflowzApi', required: true, displayOptions: { show: { authentication: ['apiKey'] } } },
			{ name: 'reviewflowzOAuth2Api', required: true, displayOptions: { show: { authentication: ['oAuth2'] } } },
		],
		webhooks: [{ name: 'default', httpMethod: 'POST', responseMode: 'onReceived', path: 'webhook' }],
		properties: [
			AUTHENTICATION,
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				required: true,
				options: eventOptions(),
				default: ['review.created'],
				description: 'The events that start this workflow',
			},
			{
				displayName: 'Filters',
				name: 'filters',
				type: 'collection',
				placeholder: 'Add Filter',
				default: {},
				description: 'Each filter applies to the events it makes sense for, and is ignored for the others',
				options: [
					multi('Campaign Names or IDs', 'campaigns', 'getCampaigns', 'Review request, contact and campaign events: only these campaigns.'),
					{
						displayName: 'Channel',
						name: 'channel',
						type: 'options',
						options: [
							{ name: 'Email', value: 'email' },
							{ name: 'Text Message', value: 'sms' },
						],
						default: 'email',
						description: 'Contact Unsubscribed: only unsubscribes from this channel',
					},
					multi('Location Names or IDs', 'locations', 'getLocations', 'Review and source events: only sources at these locations.'),
					{
						displayName: 'Maximum Rating',
						name: 'ratingMax',
						type: 'number',
						default: 3,
						description: 'Review events: only reviews rated this or lower, like 3 for unhappy customers',
					},
					{
						displayName: 'Minimum Rating',
						name: 'ratingMin',
						type: 'number',
						default: 4,
						description: 'Review events: only reviews rated this or higher, like 4',
					},
					multi('Platform Names or IDs', 'platforms', 'getPlatforms', 'Review and source events: only these platforms.'),
					multi('Source Names or IDs', 'sources', 'getSources', 'Review, reply, source and rating events: only these sources.'),
					multi('Tag Names or IDs', 'tags', 'getTags', 'Review Tagged and Review Untagged: only when one of these tags is added or taken off.'),
					multi('Team Member Names or IDs', 'owners', 'getTeamMembers', 'Team Member Credited and Credit Removed: only these team members.'),
				],
			},
		],
	};

	methods = { loadOptions };

	webhookMethods = {
		default: {
			// Ours when this workflow made it (its id and secret are kept), it still
			// exists with this URL and listens to the events picked now.
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const data = this.getWorkflowStaticData('node');
				const url = this.getNodeWebhookUrl('default') as string;
				const events = [...(this.getNodeParameter('events', []) as string[])].sort();
				if (data.endpointId && data.secret) {
					const answer = await apiCall.call(this, 'GET', `/webhook-endpoints/${encodeURIComponent(data.endpointId as string)}`, undefined, undefined, {
						allow: [404],
					});
					const endpoint = answer.body;
					const current = [...((endpoint.events as string[]) ?? [])].sort();
					if (answer.status === 200 && endpoint.url === url && endpoint.status === 'active' && current.join(',') === events.join(',')) {
						return true;
					}
				}
				// An endpoint for this URL whose secret we no longer have can't be
				// checked: delete it, so create() makes a fresh one.
				const endpoints = await listAll.call(this, '/webhook-endpoints', {}, 100);
				for (const endpoint of endpoints.filter((e) => e.url === url)) {
					await deleteEndpoint(this, endpoint.id as string);
				}
				delete data.endpointId;
				delete data.secret;
				return false;
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const data = this.getWorkflowStaticData('node');
				const events = this.getNodeParameter('events', []) as string[];
				const workflow = this.getWorkflow();
				const endpoint = await apiRequest.call(this, 'POST', '/webhook-endpoints', {
					url: this.getNodeWebhookUrl('default'),
					events,
					description: `n8n: ${workflow.name ?? workflow.id ?? 'workflow'}`.slice(0, 200),
				});
				if (!endpoint.id || !endpoint.secret) return false;
				// The secret checks every delivery's signature.
				data.endpointId = endpoint.id;
				data.secret = endpoint.secret;
				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const data = this.getWorkflowStaticData('node');
				if (data.endpointId) await deleteEndpoint(this, data.endpointId as string);
				delete data.endpointId;
				delete data.secret;
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const request = this.getRequestObject();
		const data = this.getWorkflowStaticData('node');
		if (!signed(data.secret, request.rawBody, request.headers)) {
			this.getResponseObject().status(401).json({ message: 'Not signed by this workflow\'s Reviewflowz webhook endpoint.' }).end();
			return { noWebhookResponse: true };
		}

		// Not for this workflow (filtered out, or not an event): answer 200 so we
		// don't retry it, and start nothing (no workflowData, no execution).
		const ignore = { webhookResponse: { received: true, started: false } };
		const envelope = this.getBodyData() as Envelope;
		if (!envelope.type || !envelope.data) return ignore;
		const events = this.getNodeParameter('events', []) as string[];
		const filters = this.getNodeParameter('filters', {}) as IDataObject;
		if (!events.includes(envelope.type) || !matches(envelope, filters)) return ignore;

		const row = await enrich(this, toOutput(envelope));
		return { workflowData: [this.helpers.returnJsonArray([row])] };
	}
}

// Already gone (deleted in the app, or switched off and removed): nothing to undo.
async function deleteEndpoint(ctx: IHookFunctions, id: string): Promise<void> {
	await apiCall.call(ctx, 'DELETE', `/webhook-endpoints/${encodeURIComponent(id)}`, undefined, undefined, { allow: [404] });
}
