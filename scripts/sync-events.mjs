// Copies the webhook event catalog the Zapier app is built from
// (../zapier/lib/events.json, written by `bin/rails zapier:events` from
// Webhooks::Catalog) into this package, then checks every event has its
// label in nodes/Reviewflowz/shared/eventLabels.ts. Runs before every build,
// so a new event can't ship without its trigger, and a removed one can't
// linger. Outside the Reviewflowz repo (the published package's own repo)
// the committed copy is used as it is.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, '..', 'zapier', 'lib', 'events.json');
const target = join(root, 'nodes', 'Reviewflowz', 'shared', 'events.json');

if (existsSync(source)) {
	const events = readFileSync(source, 'utf8');
	if (!existsSync(target) || readFileSync(target, 'utf8') !== events) {
		writeFileSync(target, events);
		console.log('events.json updated from zapier/lib/events.json');
	}
}

const events = JSON.parse(readFileSync(target, 'utf8')).map((event) => event.type);
const labelsFile = readFileSync(join(root, 'nodes', 'Reviewflowz', 'shared', 'eventLabels.ts'), 'utf8');
const labelled = [...labelsFile.matchAll(/^\t'([a-z_]+\.[a-z_]+)': \{/gm)].map((match) => match[1]);

const missing = events.filter((type) => !labelled.includes(type));
const extra = labelled.filter((type) => !events.includes(type));
if (missing.length || extra.length) {
	console.error(
		`shared/eventLabels.ts and shared/events.json disagree. Missing labels: ${missing.join(', ') || 'none'}. Labels for unknown events: ${extra.join(', ') || 'none'}.`,
	);
	process.exit(1);
}
