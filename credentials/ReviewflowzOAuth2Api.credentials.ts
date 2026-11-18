import type { Icon, ICredentialType, INodeProperties } from 'n8n-workflow';

// Sign in with Reviewflowz (OAuth 2: authorization code with PKCE, refresh
// tokens). Every n8n instance has its own callback URL
// (<instance>/rest/oauth2-credential/callback), so there is no client to set
// up: n8n registers itself with our authorization server (Dynamic Client
// Registration, RFC 7591), found from the API's own metadata
// (https://api.reviewflowz.com/.well-known/oauth-protected-resource/v3).
// The consent screen asks which account to connect when the person belongs to
// several; the token reads and writes that account only.
export class ReviewflowzOAuth2Api implements ICredentialType {
	name = 'reviewflowzOAuth2Api';

	extends = ['oAuth2Api'];

	displayName = 'Reviewflowz OAuth2 API';

	icon: Icon = { light: 'file:../nodes/Reviewflowz/reviewflowz.svg', dark: 'file:../nodes/Reviewflowz/reviewflowz.dark.svg' };

	documentationUrl = 'https://api.reviewflowz.com/v3/docs/guides/oauth';

	properties: INodeProperties[] = [
		{
			displayName: 'Use Dynamic Client Registration',
			name: 'useDynamicClientRegistration',
			type: 'hidden',
			default: true,
		},
		{
			displayName: 'Server URL',
			name: 'serverUrl',
			type: 'hidden',
			default: 'https://api.reviewflowz.com/v3',
		},
		{
			displayName: 'API URL',
			name: 'baseUrl',
			type: 'hidden',
			default: 'https://api.reviewflowz.com/v3',
		},
		// Every API v3 permission: the actions and the trigger span all of them.
		// The consent screen lists them for the person.
		{
			displayName: 'Scope',
			name: 'scope',
			type: 'hidden',
			default:
				'sources:read sources:write reviews:read replies:read replies:write organize:read organize:write analytics:read analytics:write requests:read requests:write widgets:read widgets:write webhooks:read webhooks:write',
		},
	];
}
