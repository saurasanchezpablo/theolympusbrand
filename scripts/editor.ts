// The map's edit service (see scripts/lib/editor/server.ts).
//
//   npm run editor -- password   set the house's password (asked twice, not shown)
//   npm run editor -- serve      run it: http://127.0.0.1:8091/api/…, behind the site's web server
//
//   OLYMPUS_DATA          the data folder (default: data/ in the repository)
//   OLYMPUS_EDITOR_HOST   where to listen (default 127.0.0.1; 0.0.0.0 in a container)
//   OLYMPUS_EDITOR_PORT   (default 8091)

import { createEditor, hasPassword, setPassword } from './lib/editor/server.ts';
import { DEFAULT_DATA, dataDir } from '../src/node/data.ts';

// The edit service always works with a data folder: data/ in the repository unless OLYMPUS_DATA names another.
process.env.OLYMPUS_DATA ||= DEFAULT_DATA;

const [command = 'serve'] = process.argv.slice(2);

/** A line from the terminal without showing it. */
function secret(prompt: string): Promise<string> {
  return new Promise((done, fail) => {
    const input = process.stdin;
    if (!input.isTTY) return fail(new Error('run this in a terminal'));
    process.stdout.write(prompt);
    input.setRawMode(true);
    input.resume();
    let text = '';
    const onData = (buf: Buffer) => {
      for (const ch of buf.toString('utf8')) {
        if (ch === '\r' || ch === '\n') {
          input.setRawMode(false);
          input.pause();
          input.off('data', onData);
          process.stdout.write('\n');
          return done(text);
        }
        if (ch === '\u0003') process.exit(130);
        if (ch === '\u007f') text = text.slice(0, -1);
        else text += ch;
      }
    };
    input.on('data', onData);
  });
}

if (command === 'password') {
  const a = await secret('The password for editing the map: ');
  const b = await secret('Again: ');
  if (a !== b) {
    console.error('✖ the two did not match; nothing changed');
    process.exit(1);
  }
  try {
    setPassword(a);
  } catch (e) {
    console.error(`✖ ${(e as Error).message}`);
    process.exit(1);
  }
  console.log(`✔ set (kept as a hash in ${dataDir()}/editor.json)`);
} else if (command === 'serve') {
  const host = process.env.OLYMPUS_EDITOR_HOST || '127.0.0.1';
  const port = Number(process.env.OLYMPUS_EDITOR_PORT || 8091);
  const { url } = await createEditor({ port, host });
  console.log(`the map's edit service: ${url}/api/ · data in ${dataDir()}${hasPassword() ? '' : ' · no password yet: run `npm run editor -- password`; until then the map can be seen, not changed'}`);
  for (const sig of ['SIGTERM', 'SIGINT'] as const) process.on(sig, () => process.exit(0));
} else {
  console.error('usage: npm run editor -- serve | password');
  process.exit(2);
}
