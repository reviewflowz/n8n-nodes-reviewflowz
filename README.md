# n8n-nodes-reviewflowz

The [Reviewflowz](https://www.reviewflowz.com) nodes for [n8n](https://n8n.io/): start workflows on new
reviews, replies, rating changes and review requests, and send review requests, run campaigns, reply to
reviews and manage sources from any workflow. Built on the
[Reviewflowz API v3](https://api.reviewflowz.com/v3/docs).

[Installation](#installation) · [Credentials](#credentials) · [Nodes](#nodes) · [Example workflows](#example-workflows) · [Compatibility](#compatibility) · [Resources](#resources)

## Installation

Follow the [community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation/)
and install `n8n-nodes-reviewflowz`.

Your Reviewflowz plan must include the API.

## Credentials

Two ways to connect. Both read and write one Reviewflowz account.

### OAuth2 (recommended)

1. In n8n, create a **Reviewflowz OAuth2 API** credential.
2. Click **Connect my account**, sign in to Reviewflowz, pick the account, and allow access.

There is nothing to set up first: n8n registers itself with Reviewflowz on its own (OAuth 2 Dynamic Client
Registration), with your instance's callback URL. This works on n8n Cloud and on self-hosted n8n. A
self-hosted instance must be reached over `https://` (or on `localhost`) for the sign-in to come back to it.

### API key

1. In Reviewflowz, go to **Settings > API** and create a key with **Full access** (a **Read only** key can read
   but not send requests, reply or subscribe the trigger).
2. In n8n, create a **Reviewflowz API** credential and paste the key (`rfz_live_...`).

Then pick **API Key** as the node's **Authentication**.

## Nodes

### Reviewflowz Trigger

Starts the workflow on the events you pick. Turning the workflow on subscribes a webhook endpoint in
Reviewflowz for it; turning it off deletes it. Every delivery is signed (Standard Webhooks) and the trigger
checks the signature with its endpoint's secret: an unsigned or wrongly signed request is refused and never
starts the workflow.

| Group | Events |
| --- | --- |
| Reviews | New Review, Review Edited, Review Removed, Review Reinstated, Review Deleted, Review Analyzed, Review Tagged, Review Untagged, Team Member Credited, Team Member Credit Removed |
| Replies | Reply Drafted, Reply Submitted, Reply Published, Reply Edited, Reply Failed |
| Sources | New Source, Source Checked, Source Access Lost, Source Access Restored, Listing Taken Down, Source Deleted |
| Ratings | Rating Changed |
| Review requests | Review Request Sent, Review Request Clicked, Review Request Not Sent, Review Request Failed |
| Contacts | Customer Left a Review, Contact Unsubscribed |
| Campaigns | Campaign Paused, Campaign Resumed |

**Filters** (each applies to the events it makes sense for): sources, locations, platforms, minimum and
maximum rating, campaigns, tags, team members, and the channel of an unsubscribe.

The output is the object as the API returns it (the review, reply, source, request...) with the event beside
it in `event` (`id`, `type`, `timestamp` and its facts, such as the tag added or why a request wasn't sent),
plus `source_name`, `location_name`, `campaign_name` and the contact's details beside the ids.

Each workflow's endpoint counts toward the account's 20 webhook endpoints.

### Reviewflowz

| Resource | Operations |
| --- | --- |
| Review Request | **Send** (add a customer to a campaign, which sends them its request on its schedule), Get Many |
| Campaign | Create, Get, Get Many, Pause, Turn On, Update |
| Contact | Add to Segment, Create or Update, Get Many, Unsubscribe |
| Reply | Create (reply to a review, or save a draft), Write With AI |
| Review | Add Tag, Credit Team Member, Get, Get Many, Remove Tag |
| Source | Add, Check for New Reviews, Get Many, Get Rating, Set Dimension |
| Location | Create, Get Many |
| Tag | Get Many |
| Team Member | Get Many |
| Business Listing | Look Up |

**Send** checks the campaign before adding anyone: an email campaign needs the customer's email, a text
campaign their phone. A campaign that is off still takes the customer: they are saved in it and never get its
request; customers added after it is turned on do.
Someone already in the campaign is not asked twice. Your own contact fields (staff name, visit type...) fill
the message's merge fields.

The node can be used as a tool by n8n's AI Agent.

## Example workflows

- **Ask every customer for a review**: your booking, CRM or POS trigger (a job completed, an order shipped)
  → Reviewflowz **Send** review request, mapping the customer's email, phone and name.
- **Unhappy review alert**: Reviewflowz Trigger on **New Review** with **Maximum Rating** 2 → Slack or email.
- **AI replies for approval**: Reviewflowz Trigger on **New Review** → Reviewflowz **Write With AI** (saved as
  the review's draft) → a message to the team to approve it in Reviewflowz.
- **Tag by keyword**: Reviewflowz Trigger on **New Review** → IF the text mentions parking → Reviewflowz
  **Add Tag** "Parking".

## Compatibility

Tested with n8n 2.48.5. The OAuth2 credential needs an n8n version with Dynamic Client Registration for
OAuth2 credentials; on older versions use an API key.

## Resources

- [Reviewflowz API v3 docs](https://api.reviewflowz.com/v3/docs)
- [Authentication](https://api.reviewflowz.com/v3/docs/guides/authentication) and
  [OAuth](https://api.reviewflowz.com/v3/docs/guides/oauth)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- Help: hello@reviewflowz.com

## Development

Inside the Reviewflowz repo, `npm run build` first copies the webhook event catalog from
`../zapier/lib/events.json` (written by `bin/rails zapier:events`) and fails when an event has no label in
`nodes/Reviewflowz/shared/eventLabels.ts`. `npm run lint` must pass before a release.

To try it against a local Reviewflowz server, start n8n with
`CREDENTIALS_OVERWRITE_DATA='{"reviewflowzApi":{"baseUrl":"http://api.localhost:3000/v3"},"reviewflowzOAuth2Api":{"baseUrl":"http://api.localhost:3000/v3","serverUrl":"http://api.localhost:3000/v3"}}'`.

Releases are published from GitHub Actions with npm provenance (`.github/workflows/publish.yml`): bump the
version, add a CHANGELOG entry, push a tag such as `0.1.0`.
