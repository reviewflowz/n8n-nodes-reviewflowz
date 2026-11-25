# Changelog

## 0.1.2

- Send review request adds the customer whatever the campaign's state, as an integration does. While the
  campaign is off the customer is saved in it and never gets its request; customers added after it is turned
  on do. The "If the Campaign Is Off" option is gone: a workflow that had it set to stop now adds the customer.

## 0.1.1

- Package metadata: homepage and author URL point to https://reviewflowz.com; node documentation links point to the API docs.

## 0.1.0

- Reviewflowz Trigger: every Reviewflowz webhook event (30), with filters. Subscribes its own webhook
  endpoint when the workflow turns on and deletes it when it turns off; checks every delivery's Standard
  Webhooks signature and refuses unsigned ones.
- Reviewflowz node: Send review request; campaigns (create, get, get many, pause, turn on, update);
  contacts (add to segment, create or update, get many, unsubscribe); replies (create, write with AI);
  reviews (add tag, credit team member, get, get many, remove tag); sources (add, check for new reviews,
  get many, get rating, set dimension); locations; tags; team members; business listing look-up.
- Credentials: OAuth2 with automatic client registration, or an API key.
