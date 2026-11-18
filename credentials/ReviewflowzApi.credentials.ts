import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

// An account API key (rfz_live_...), made in Reviewflowz under Settings > API.
// It reads and writes the one account it was made in, with the permissions
// picked when it was made.
export class ReviewflowzApi implements ICredentialType {
	name = 'reviewflowzApi';

	displayName = 'Reviewflowz API';

	icon: Icon = { light: 'file:../nodes/Reviewflowz/reviewflowz.svg', dark: 'file:../nodes/Reviewflowz/reviewflowz.dark.svg' };

	documentationUrl = 'https://api.reviewflowz.com/v3/docs/guides/authentication';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			placeholder: 'e.g. rfz_live_...',
			description:
				'Create one in Reviewflowz under Settings > API. Pick Full access to use the actions and the trigger: a Read only key can only read.',
		},
		{
			displayName: 'API URL',
			name: 'baseUrl',
			type: 'hidden',
			default: 'https://api.reviewflowz.com/v3',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/account',
		},
	};
}
