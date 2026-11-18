import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { OPERATIONS } from './actions';
import { PROPERTIES } from './descriptions';
import { listSearch, loadOptions } from './shared/methods';

// Programmatic, not declarative: several operations make dependent calls
// (Send Review Request reads the campaign to check its channel and state
// first; Update Campaign changes a live campaign in place; tagging finds
// or creates the tag, then reads the review back).
export class Reviewflowz implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Reviewflowz',
		name: 'reviewflowz',
		icon: { light: 'file:reviewflowz.svg', dark: 'file:reviewflowz.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Send review requests, run campaigns, reply to reviews and manage sources in Reviewflowz',
		defaults: { name: 'Reviewflowz' },
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{ name: 'reviewflowzApi', required: true, displayOptions: { show: { authentication: ['apiKey'] } } },
			{ name: 'reviewflowzOAuth2Api', required: true, displayOptions: { show: { authentication: ['oAuth2'] } } },
		],
		properties: PROPERTIES,
	};

	methods = { loadOptions, listSearch };

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;
				const run = OPERATIONS[resource]?.[operation];
				if (!run) {
					throw new NodeOperationError(this.getNode(), `The operation '${operation}' isn't one Reviewflowz has for '${resource}'.`, {
						itemIndex: i,
					});
				}
				const result = await run.call(this, i);
				const rows: IDataObject[] = Array.isArray(result) ? result : [result];
				for (const row of rows) returnData.push({ json: row, pairedItem: { item: i } });
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				// Our helpers already made it a NodeApiError (the API's own words)
				// or a NodeOperationError: re-wrapping hands the same error back.
				if (error instanceof NodeApiError) throw new NodeApiError(this.getNode(), error as unknown as JsonObject, { itemIndex: i });
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
