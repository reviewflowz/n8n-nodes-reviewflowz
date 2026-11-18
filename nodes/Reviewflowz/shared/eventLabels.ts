// How each webhook event reads in the trigger's event list: the same names
// and descriptions as the Zapier app (zapier/lib/event_labels.js).
// shared/events.json (our catalog) says which events exist; this file names
// them. scripts/sync-events.mjs fails the build when the two disagree.

export const EVENT_LABELS: Record<string, { label: string; description: string }> = {
	'review.created': { label: 'New Review', description: 'Triggers when a new review is found on one of your sources.' },
	'review.updated': { label: 'Review Edited', description: 'Triggers when a reviewer edits their review. You get the new version.' },
	'review.removed': { label: 'Review Removed', description: 'Triggers when a review is taken down on the platform, or hidden as not recommended.' },
	'review.reinstated': { label: 'Review Reinstated', description: 'Triggers when a removed review is back on the platform.' },
	'review.deleted': { label: 'Review Deleted', description: 'Triggers when a review is deleted from Reviewflowz.' },
	'review.enriched': { label: 'Review Analyzed', description: 'Triggers when a new review gets its sentiment, topics, tags and team members.' },
	'review.tagged': { label: 'Review Tagged', description: 'Triggers when a tag is added to a review.' },
	'review.untagged': { label: 'Review Untagged', description: 'Triggers when a tag is taken off a review.' },
	'review.owner_assigned': { label: 'Team Member Credited', description: 'Triggers when a team member is credited for a review.' },
	'review.owner_unassigned': { label: 'Team Member Credit Removed', description: "Triggers when a team member's credit for a review is taken off." },
	'reply.drafted': { label: 'Reply Drafted', description: 'Triggers when a reply draft is written, by a person or the AI agent.' },
	'reply.submitted': { label: 'Reply Submitted', description: 'Triggers when a reply is sent to a platform that checks replies before they go live.' },
	'reply.published': { label: 'Reply Published', description: 'Triggers when a reply goes live on the platform.' },
	'reply.updated': { label: 'Reply Edited', description: 'Triggers when a live reply is edited.' },
	'reply.failed': { label: 'Reply Failed', description: 'Triggers when a reply could not be written or published.' },
	'source.created': { label: 'New Source', description: 'Triggers when a source (a listing we collect reviews from) is added.' },
	'source.synced': { label: 'Source Checked', description: 'Triggers when a source finishes checking for new reviews.' },
	'source.access_lost': { label: 'Source Access Lost', description: 'Triggers when we can no longer reach a source through its connected account.' },
	'source.access_restored': { label: 'Source Access Restored', description: 'Triggers when access to a source works again.' },
	'source.decommissioned': { label: 'Listing Taken Down', description: 'Triggers when a listing is taken down on the platform for good.' },
	'source.deleted': { label: 'Source Deleted', description: 'Triggers when a source is deleted.' },
	'rating.changed': { label: 'Rating Changed', description: "Triggers when a source's rating or review count changes." },
	'invitation.sent': { label: 'Review Request Sent', description: 'Triggers when a review request goes out.' },
	'invitation.clicked': { label: 'Review Request Clicked', description: "Triggers when a customer opens their review request's link." },
	'invitation.skipped': { label: 'Review Request Not Sent', description: 'Triggers when a review request is not sent, with the reason (unsubscribed, no phone, already reviewed...).' },
	'invitation.failed': { label: 'Review Request Failed', description: 'Triggers when a review request bounces or cannot be delivered.' },
	'contact.reviewed': { label: 'Customer Left a Review', description: 'Triggers when a customer you asked leaves a review, matched to them by name.' },
	'contact.opted_out': { label: 'Contact Unsubscribed', description: 'Triggers when a contact unsubscribes from review requests.' },
	'campaign.paused': { label: 'Campaign Paused', description: 'Triggers when a campaign pauses: by a person, an integration, or credits running out.' },
	'campaign.resumed': { label: 'Campaign Resumed', description: 'Triggers when a paused campaign starts sending again.' },
};
