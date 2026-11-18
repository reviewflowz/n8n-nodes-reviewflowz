import type { INodeProperties } from 'n8n-workflow';

// What the Reviewflowz node shows: resources, their operations and fields.
// Labels and help text follow the Zapier app's (zapier/creates, zapier/searches).

const show = (resource: string, operation: string[]) => ({ show: { resource: [resource], operation } });

const campaignLocator = (resource: string, operation: string[], description: string): INodeProperties => ({
	displayName: 'Campaign',
	name: 'campaign',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	required: true,
	description,
	displayOptions: show(resource, operation),
	modes: [
		{
			displayName: 'From List',
			name: 'list',
			type: 'list',
			typeOptions: { searchListMethod: 'searchCampaigns', searchable: true },
		},
		{
			displayName: 'ID',
			name: 'id',
			type: 'string',
			placeholder: 'e.g. cmp_7',
			validation: [{ type: 'regex', properties: { regex: 'cmp_\\w+', errorMessage: 'A campaign ID starts with cmp_' } }],
		},
	],
});

const sourceLocator = (resource: string, operation: string[]): INodeProperties => ({
	displayName: 'Source',
	name: 'source',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	required: true,
	description: 'The source: a listing we collect reviews from',
	displayOptions: show(resource, operation),
	modes: [
		{
			displayName: 'From List',
			name: 'list',
			type: 'list',
			typeOptions: { searchListMethod: 'searchSources', searchable: true },
		},
		{ displayName: 'ID', name: 'id', type: 'string', placeholder: 'e.g. src_4812' },
	],
});

const reviewId = (resource: string, operation: string[]): INodeProperties => ({
	displayName: 'Review ID',
	name: 'review',
	type: 'string',
	required: true,
	default: '',
	placeholder: 'e.g. rev_918273',
	description: "The review's ID: map it from a Reviewflowz trigger or a 'Get Many' reviews step",
	displayOptions: show(resource, operation),
});

const returnAll = (resource: string, operation: string[]): INodeProperties[] => [
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: show(resource, operation),
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		default: 50,
		typeOptions: { minValue: 1 },
		description: 'Max number of results to return',
		displayOptions: { show: { resource: [resource], operation, returnAll: [false] } },
	},
];

const RESOURCE: INodeProperties = {
	displayName: 'Resource',
	name: 'resource',
	type: 'options',
	noDataExpression: true,
	options: [
		{ name: 'Business Listing', value: 'listing' },
		{ name: 'Campaign', value: 'campaign' },
		{ name: 'Contact', value: 'contact' },
		{ name: 'Location', value: 'location' },
		{ name: 'Reply', value: 'reply' },
		{ name: 'Review', value: 'review' },
		{ name: 'Review Request', value: 'reviewRequest' },
		{ name: 'Source', value: 'source' },
		{ name: 'Tag', value: 'tag' },
		{ name: 'Team Member', value: 'teamMember' },
	],
	default: 'reviewRequest',
};

const operations = (resource: string, list: Array<[string, string, string, string]>, fallback: string): INodeProperties => ({
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: { show: { resource: [resource] } },
	options: list.map(([name, value, description, action]) => ({ name, value, description, action })),
	default: fallback,
});

const OPERATIONS: INodeProperties[] = [
	operations('listing', [['Look Up', 'lookUp', "Find a business's listing on a platform, to add it as a source", 'Look up business listing']], 'lookUp'),
	operations(
		'campaign',
		[
			['Create', 'create', 'Create a review-request campaign, ready to go: its message, timing and where it sends reviewers', 'Create campaign'],
			['Get', 'get', 'Get a campaign', 'Get campaign'],
			['Get Many', 'getAll', 'Get campaigns, or find one by name', 'Get many campaigns'],
			['Pause', 'pause', 'Stop a campaign. Follow-ups already scheduled wait until it is turned back on.', 'Pause campaign'],
			['Turn On', 'turnOn', 'Start a campaign: customers added from now on get its request', 'Turn on campaign'],
			['Update', 'update', "Change a campaign's name, message, timing or where it sends reviewers", 'Update campaign'],
		],
		'create',
	),
	operations(
		'contact',
		[
			['Add to Segment', 'addToSegment', 'Save a customer and put them in one of your segments', 'Add contact to segment'],
			['Create or Update', 'upsert', 'Save a customer, found by email or phone, without sending them anything', 'Create or update contact'],
			['Get Many', 'getAll', 'Find a customer by email or phone number', 'Get many contacts'],
			['Unsubscribe', 'unsubscribe', 'Stop review requests to a customer, on email, texts or both, from every campaign', 'Unsubscribe contact'],
		],
		'upsert',
	),
	operations(
		'location',
		[
			['Create', 'create', 'Add a location (a store, office or property) to Reviewflowz', 'Create location'],
			['Get Many', 'getAll', 'Get locations, or find one by name', 'Get many locations'],
		],
		'create',
	),
	operations(
		'reply',
		[
			['Create', 'create', 'Post your reply on the platform, or save it as a draft to check in Reviewflowz', 'Reply to review'],
			['Write With AI', 'generate', 'Have your reply agent write a reply to a review. Nothing is posted.', 'Write reply with AI'],
		],
		'create',
	),
	operations(
		'review',
		[
			['Add Tag', 'addTag', "Add a tag to a review. A tag name we don't have yet is created.", 'Add tag to review'],
			['Credit Team Member', 'creditTeamMember', 'Credit a team member for a review, for your staff reports', 'Credit team member for review'],
			['Get', 'get', 'Get a review by its ID', 'Get review'],
			['Get Many', 'getAll', 'Get reviews matching words, a source or a rating', 'Get many reviews'],
			['Remove Tag', 'removeTag', 'Take a tag off a review', 'Remove tag from review'],
		],
		'getAll',
	),
	operations(
		'reviewRequest',
		[
			['Get Many', 'getAll', "Get a customer's review requests and what happened to them: sent, opened, clicked, failed", 'Get many review requests'],
			['Send', 'send', 'Add a customer to a review-request campaign, which sends them its request on its schedule', 'Send review request'],
		],
		'send',
	),
	operations(
		'source',
		[
			['Add', 'create', 'Start collecting reviews from a listing: a Google, Tripadvisor, Trustpilot... page', 'Add source'],
			['Check for New Reviews', 'sync', 'Check a source for new reviews now, instead of waiting for its next scheduled check', 'Check source for new reviews'],
			['Get Many', 'getAll', 'Find sources by name or website', 'Get many sources'],
			['Get Rating', 'getRating', "Get a source's current rating and review count", 'Get rating of source'],
			['Set Dimension', 'setDimension', "Set a source's value for one of your dimensions, like its region or brand", 'Set dimension of source'],
		],
		'create',
	),
	operations('tag', [['Get Many', 'getAll', 'Get tags, or find one by name', 'Get many tags']], 'getAll'),
	operations('teamMember', [['Get Many', 'getAll', 'Find team members by name, to credit them for reviews', 'Get many team members']], 'getAll'),
];

// ---- Review Request -----------------------------------------------------------

const SEND = ['send'];
const REVIEW_REQUEST: INodeProperties[] = [
	campaignLocator('reviewRequest', SEND, "The campaign that asks this customer for a review. Its channel, message, timing and review page apply."),
	{
		displayName: 'Email',
		name: 'email',
		type: 'string',
		placeholder: 'e.g. nathan@example.com',
		default: '',
		description: 'Where the request goes for email campaigns. Email or phone is needed.',
		displayOptions: show('reviewRequest', SEND),
	},
	{
		displayName: 'Phone Number',
		name: 'phone',
		type: 'string',
		placeholder: 'e.g. +14155550100',
		default: '',
		description: 'Where the request goes for text campaigns. International format is safest.',
		displayOptions: show('reviewRequest', SEND),
	},
	{
		displayName: 'First Name',
		name: 'firstName',
		type: 'string',
		default: '',
		description: 'Fills {{first_name}} in the message',
		displayOptions: show('reviewRequest', SEND),
	},
	{
		displayName: 'Last Name',
		name: 'lastName',
		type: 'string',
		default: '',
		displayOptions: show('reviewRequest', SEND),
	},
	{
		displayName: 'Location Name or ID',
		name: 'location',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getLocations' },
		default: '',
		description:
			'Where the customer came in: it decides which listing they are asked to review. Needed when your account has several locations. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		displayOptions: show('reviewRequest', SEND),
	},
	{
		displayName: 'Contact Fields',
		name: 'contactFields',
		placeholder: 'Add Contact Field',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true },
		default: {},
		description: 'Your own contact fields (staff name, visit type...), for the merge fields in the message',
		displayOptions: show('reviewRequest', SEND),
		options: [
			{
				displayName: 'Field',
				name: 'field',
				values: [
					{
						displayName: 'Field Name or ID',
						name: 'name',
						type: 'options',
						typeOptions: { loadOptionsMethod: 'getContactFields' },
						default: '',
						description: 'Choose from the list, or specify a name using an <a href="https://docs.n8n.io/code/expressions/">expression</a>. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
					},
					{ displayName: 'Value', name: 'value', type: 'string', default: '' },
				],
			},
		],
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: show('reviewRequest', SEND),
		options: [
			{
				displayName: 'If the Campaign Is Off',
				name: 'whenOff',
				type: 'options',
				options: [
					{ name: 'Add Them Anyway (No Request Is Sent)', value: 'add' },
					{ name: 'Stop With an Error', value: 'error' },
				],
				default: 'error',
				description: 'People added while a campaign is off never get its request',
			},
			{
				displayName: 'If They Are Already in This Campaign',
				name: 'whenAlreadyIn',
				type: 'options',
				options: [
					{ name: 'Carry On (They Had Their Request)', value: 'skip' },
					{ name: 'Stop With an Error', value: 'error' },
				],
				default: 'skip',
			},
		],
	},
	// Get Many review requests
	{
		displayName: 'Contact ID',
		name: 'contact',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. con_00000000-0000-4000-8000-000000000001',
		description: "From a 'Get Many' contacts step or 'Send' review request",
		displayOptions: show('reviewRequest', ['getAll']),
	},
	{
		displayName: 'Campaign Name or ID',
		name: 'campaignFilter',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getCampaigns' },
		default: '',
		description:
			'Only this campaign\'s requests. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		displayOptions: show('reviewRequest', ['getAll']),
	},
	...returnAll('reviewRequest', ['getAll']),
];

// ---- Campaign -----------------------------------------------------------------

const messageFields: INodeProperties[] = [
	{
		displayName: 'Button Text',
		name: 'ctaText',
		type: 'string',
		default: '',
		placeholder: 'e.g. Leave a review',
		description: 'Emails only',
	},
	{
		displayName: 'Email Subject',
		name: 'subject',
		type: 'string',
		default: '',
		description: 'Emails only. Leave empty to keep ours ("Did you love your experience with ...?").',
	},
	{
		displayName: 'Goal',
		name: 'goal',
		type: 'options',
		options: [
			{ name: 'Get as Many Reviews as Possible', value: 'most_reviews' },
			{ name: 'Reach a Number of 5-Star Reviews', value: 'five_star_reviews' },
			{ name: 'Reach a Rating', value: 'rating' },
		],
		default: 'most_reviews',
		description: 'With a rating or a number to reach, customers go there until it is reached, then to the next destination',
	},
	{
		displayName: 'Message',
		name: 'body',
		type: 'string',
		typeOptions: { rows: 4 },
		default: '',
		description: 'Leave empty to keep ours. Merge fields: {{first_name}}, {{location_name}}, and your contact fields by name.',
	},
	{
		displayName: 'Send Reviewers To',
		name: 'destinations',
		type: 'multiOptions',
		typeOptions: { loadOptionsMethod: 'getDestinations' },
		default: [],
		description:
			'Platforms or sources, as your account works, first choice first. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	},
	{
		displayName: 'Target',
		name: 'target',
		type: 'number',
		default: 0,
		description: "The rating (like 4.8) or the number of 5-star reviews (like 50) to reach, with that 'Goal'",
	},
	{
		displayName: 'Wait Before Sending (Hours)',
		name: 'sendDelayHours',
		type: 'number',
		default: 0,
		description: 'From the moment a customer is added. 0 sends right away.',
	},
];

const CAMPAIGN: INodeProperties[] = [
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. Jobs completed in ServiceTitan',
		description: 'Name it after what puts customers in it',
		displayOptions: show('campaign', ['create']),
	},
	{
		displayName: 'Channel',
		name: 'channel',
		type: 'options',
		options: [
			{ name: 'Email', value: 'email' },
			{ name: 'Text Message', value: 'sms' },
			{ name: 'WhatsApp', value: 'whatsapp' },
		],
		default: 'email',
		displayOptions: show('campaign', ['create']),
	},
	{
		displayName: 'Turn It On',
		name: 'turnOn',
		type: 'boolean',
		default: false,
		description: 'Whether to start sending now. Requests use credits.',
		displayOptions: show('campaign', ['create']),
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: show('campaign', ['create']),
		options: messageFields,
	},
	campaignLocator('campaign', ['get', 'pause', 'turnOn', 'update'], 'The campaign'),
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: show('campaign', ['update']),
		options: [{ displayName: 'New Name', name: 'name', type: 'string', default: '' }, ...messageFields],
	},
	{
		displayName: 'If the Campaign Is On',
		name: 'whenOn',
		type: 'options',
		options: [
			{ name: 'Change It While It Stays On', value: 'pause_and_resume' },
			{ name: 'Stop With an Error', value: 'error' },
		],
		default: 'pause_and_resume',
		description: 'A campaign that is on keeps sending while it changes: no one waiting for a request loses their place.',
		displayOptions: show('campaign', ['update']),
	},
	{
		displayName: 'Name',
		name: 'nameFilter',
		type: 'string',
		default: '',
		description: 'Only campaigns with this name (an exact match first, else names that contain it). Leave empty for all.',
		displayOptions: show('campaign', ['getAll']),
	},
	...returnAll('campaign', ['getAll']),
];

// ---- Contact ------------------------------------------------------------------

const contactBasics = (operation: string[]): INodeProperties[] => [
	{
		displayName: 'Email',
		name: 'email',
		type: 'string',
		placeholder: 'e.g. nathan@example.com',
		default: '',
		description: 'Email or phone is needed. An email or phone we know updates that contact.',
		displayOptions: show('contact', operation),
	},
	{
		displayName: 'Phone Number',
		name: 'phone',
		type: 'string',
		placeholder: 'e.g. +14155550100',
		default: '',
		description: 'International format',
		displayOptions: show('contact', operation),
	},
];

const CONTACT: INodeProperties[] = [
	{
		displayName: 'Segment',
		name: 'segment',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: true,
		displayOptions: show('contact', ['addToSegment']),
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				typeOptions: { searchListMethod: 'searchSegments', searchable: true },
			},
			{ displayName: 'ID', name: 'id', type: 'string', placeholder: 'e.g. seg_4' },
		],
	},
	...contactBasics(['addToSegment', 'upsert', 'unsubscribe', 'getAll']),
	{
		displayName: 'First Name',
		name: 'firstName',
		type: 'string',
		default: '',
		displayOptions: show('contact', ['addToSegment', 'upsert']),
	},
	{
		displayName: 'Last Name',
		name: 'lastName',
		type: 'string',
		default: '',
		displayOptions: show('contact', ['addToSegment', 'upsert']),
	},
	{
		displayName: 'Contact Fields',
		name: 'contactFields',
		placeholder: 'Add Contact Field',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true },
		default: {},
		description: 'Your own contact fields (staff name, visit type...)',
		displayOptions: show('contact', ['upsert']),
		options: [
			{
				displayName: 'Field',
				name: 'field',
				values: [
					{
						displayName: 'Field Name or ID',
						name: 'name',
						type: 'options',
						typeOptions: { loadOptionsMethod: 'getContactFields' },
						default: '',
						description: 'Choose from the list, or specify a name using an <a href="https://docs.n8n.io/code/expressions/">expression</a>. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
					},
					{ displayName: 'Value', name: 'value', type: 'string', default: '' },
				],
			},
		],
	},
	{
		displayName: 'Channels',
		name: 'channels',
		type: 'multiOptions',
		options: [
			{ name: 'Email', value: 'email' },
			{ name: 'Text Messages', value: 'sms' },
		],
		default: [],
		description: 'Leave empty for both',
		displayOptions: show('contact', ['unsubscribe']),
	},
	...returnAll('contact', ['getAll']),
];

// ---- Reply --------------------------------------------------------------------

const REPLY: INodeProperties[] = [
	reviewId('reply', ['create', 'generate']),
	{
		displayName: 'Reply',
		name: 'text',
		type: 'string',
		typeOptions: { rows: 4 },
		required: true,
		default: '',
		displayOptions: show('reply', ['create']),
	},
	{
		displayName: 'Post It Now',
		name: 'publish',
		type: 'boolean',
		default: true,
		description: 'Whether to post it on the platform now. Off saves it as a draft in the reply queue instead.',
		displayOptions: show('reply', ['create']),
	},
	{
		displayName: 'Reply Agent Name or ID',
		name: 'agent',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getReplyAgents' },
		default: '',
		description:
			'Leave empty for your default agent. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		displayOptions: show('reply', ['generate']),
	},
	{
		displayName: "Save It as the Review's Draft",
		name: 'save',
		type: 'boolean',
		default: true,
		description: 'Whether to put it in the reply queue for someone to approve. Off only returns the text, for the workflow to use.',
		displayOptions: show('reply', ['generate']),
	},
];

// ---- Review -------------------------------------------------------------------

const tagLocator = (operation: string[]): INodeProperties => ({
	displayName: 'Tag',
	name: 'tag',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	required: true,
	description: 'Pick one, or type a name (one we don\'t have yet is created when adding)',
	displayOptions: show('review', operation),
	modes: [
		{
			displayName: 'From List',
			name: 'list',
			type: 'list',
			typeOptions: { searchListMethod: 'searchTags', searchable: true },
		},
		{ displayName: 'Name', name: 'name', type: 'string', placeholder: 'e.g. Staff' },
		{ displayName: 'ID', name: 'id', type: 'string', placeholder: 'e.g. tag_3' },
	],
});

const REVIEW: INodeProperties[] = [
	reviewId('review', ['addTag', 'creditTeamMember', 'get', 'removeTag']),
	tagLocator(['addTag', 'removeTag']),
	{
		displayName: 'Team Member Name or ID',
		name: 'owner',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getTeamMembers' },
		required: true,
		default: '',
		description:
			'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
		displayOptions: show('review', ['creditTeamMember']),
	},
	...returnAll('review', ['getAll']),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: show('review', ['getAll']),
		options: [
			{
				displayName: 'Location Names or IDs',
				name: 'location',
				type: 'multiOptions',
				typeOptions: { loadOptionsMethod: 'getLocations' },
				default: [],
				description:
					'Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
			},
			{ displayName: 'Maximum Rating', name: 'rating_max', type: 'number', default: 5, description: 'Like 3 for unhappy customers' },
			{ displayName: 'Minimum Rating', name: 'rating_min', type: 'number', default: 1, description: 'Like 4' },
			{
				displayName: 'Platform Names or IDs',
				name: 'platform',
				type: 'multiOptions',
				typeOptions: { loadOptionsMethod: 'getPlatforms' },
				default: [],
				description:
					'Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
			},
			{
				displayName: 'Source Names or IDs',
				name: 'source',
				type: 'multiOptions',
				typeOptions: { loadOptionsMethod: 'getSources' },
				default: [],
				description:
					'Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
			},
			{ displayName: 'Words in the Review', name: 'q', type: 'string', default: '' },
		],
	},
];

// ---- Source -------------------------------------------------------------------

const SOURCE: INodeProperties[] = [
	{
		displayName: 'Listing URL',
		name: 'url',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. https://www.trustpilot.com/review/example.com',
		description: 'The page that shows the reviews, like a Google Maps or Trustpilot link',
		displayOptions: show('source', ['create']),
	},
	{
		displayName: 'Location Name or ID',
		name: 'location',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getLocations' },
		default: '',
		description:
			'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
		displayOptions: show('source', ['create']),
	},
	sourceLocator('source', ['getRating', 'setDimension', 'sync']),
	{
		displayName: 'Dimension',
		name: 'dimension',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. region',
		description: "The dimension's key",
		displayOptions: show('source', ['setDimension']),
	},
	{
		displayName: 'Value',
		name: 'value',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. Europe',
		displayOptions: show('source', ['setDimension']),
	},
	...returnAll('source', ['getAll']),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: show('source', ['getAll']),
		options: [
			{ displayName: 'Name', name: 'q', type: 'string', default: '' },
			{
				displayName: 'Platform Name or ID',
				name: 'platform',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getPlatforms' },
				default: '',
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
			},
			{ displayName: 'Website Domain', name: 'domain', type: 'string', default: '', placeholder: 'e.g. example.com' },
		],
	},
];

// ---- Location, tag, team member, listing --------------------------------------

const nameFilter = (resource: string): INodeProperties => ({
	displayName: 'Name',
	name: 'nameFilter',
	type: 'string',
	default: '',
	description: 'Only the ones with this name. Leave empty for all.',
	displayOptions: show(resource, ['getAll']),
});

const OTHERS: INodeProperties[] = [
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		displayOptions: show('location', ['create']),
	},
	{
		displayName: 'Google Maps Link',
		name: 'url',
		type: 'string',
		required: true,
		default: '',
		description: "The location's Google Maps link: it finds the place and its address",
		displayOptions: show('location', ['create']),
	},
	{
		displayName: 'Address',
		name: 'address',
		type: 'string',
		default: '',
		displayOptions: show('location', ['create']),
	},
	nameFilter('location'),
	...returnAll('location', ['getAll']),
	nameFilter('tag'),
	...returnAll('tag', ['getAll']),
	nameFilter('teamMember'),
	...returnAll('teamMember', ['getAll']),
	{
		displayName: 'Business Name and City',
		name: 'q',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. Tour Eiffel Paris',
		displayOptions: show('listing', ['lookUp']),
	},
	{
		displayName: 'Platform Name or ID',
		name: 'platform',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getPlatforms' },
		required: true,
		default: '',
		description:
			'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
		displayOptions: show('listing', ['lookUp']),
	},
];

export const AUTHENTICATION: INodeProperties = {
	displayName: 'Authentication',
	name: 'authentication',
	type: 'options',
	options: [
		{ name: 'API Key', value: 'apiKey' },
		{ name: 'OAuth2', value: 'oAuth2' },
	],
	default: 'oAuth2',
};

export const PROPERTIES: INodeProperties[] = [
	AUTHENTICATION,
	RESOURCE,
	...OPERATIONS,
	...REVIEW_REQUEST,
	...CAMPAIGN,
	...CONTACT,
	...REPLY,
	...REVIEW,
	...SOURCE,
	...OTHERS,
];
