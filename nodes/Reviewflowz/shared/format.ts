import type { IDataObject } from 'n8n-workflow';

// "google_maps" -> "Google Maps", for labels. The API's platform ids are the
// catalog names made into slugs; the few whose casing a slug loses are named.
const NAMED: Record<string, string> = {
	google_maps: 'Google Maps',
	app_store: 'App Store',
	g2: 'G2',
	bbb: 'BBB',
	better_business_bureau: 'Better Business Bureau',
	tripadvisor: 'Tripadvisor',
	trustpilot: 'Trustpilot',
	yelp: 'Yelp',
	capterra: 'Capterra',
	facebook: 'Facebook',
	booking_com: 'Booking.com',
	airbnb: 'Airbnb',
	expedia: 'Expedia',
	glassdoor: 'Glassdoor',
	google_play: 'Google Play',
};

export const platformName = (slug: unknown): string => {
	if (!slug || typeof slug !== 'string') return '';
	return NAMED[slug] || slug.split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

const CHANNEL_NAMES: Record<string, string> = { email: 'Email', sms: 'Text', whatsapp: 'WhatsApp' };
const STATE_NAMES: Record<string, string> = { active: 'on', paused: 'paused', draft: 'off' };

export const campaignLabel = (campaign: IDataObject): string => {
	const channel = CHANNEL_NAMES[campaign.channel as string] || (campaign.channel as string);
	const state = STATE_NAMES[campaign.state as string] || (campaign.state as string);
	return `${campaign.name as string} · ${channel} · ${state}`;
};

export const sourceLabel = (source: IDataObject): string =>
	`${(source.name as string) || (source.url as string)} · ${platformName(source.platform)}`;

export const ownerLabel = (owner: IDataObject): string =>
	[owner.name, owner.team].filter(Boolean).join(' · ');

export const segmentLabel = (segment: IDataObject): string =>
	`${segment.name as string} (${segment.contact_count as number} contacts)`;

export const replyAgentLabel = (agent: IDataObject): string =>
	agent.default ? `${agent.name as string} (default)` : (agent.name as string);
