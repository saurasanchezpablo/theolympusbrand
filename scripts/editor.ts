// The map's editing password (the edit API itself is part of the site's
// server: npm start, scripts/serve.ts).
//
//   npm run editor -- password   set the house's password (asked twice, not shown)
//   … password --stdin            the same, from the first line piped in
//
//   OLYMPUS_DATA          the data folder (default: data/ in the repository)

import { setPassword } from './lib/editor/server.ts';
import { DEFAULT_DATA, dataDir } from '../src/node/data.ts';

// The edit service always works with a data folder: data/ in the repository unless OLYMPUS_DATA names another.
process.env.OLYMPUS_DATA ||= DEFAULT_DATA;

const [command = 'password'] = process.argv.slice(2);

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

/** The first line of what is piped in (for scripts: a secrets file, a container's setup). */
async function piped(): Promise<string> {
  let text = '';
  for await (const chunk of process.stdin) text += String(chunk);
  return text.split(/\r?\n/)[0];
}

if (command === 'password') {
  const fromPipe = process.argv.includes('--stdin');
  const a = fromPipe ? await piped() : await secret('The password for editing the map: ');
  const b = fromPipe ? a : await secret('Again: ');
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
  console.error('The map’s edit API is part of the site’s server now: npm start (scripts/serve.ts) serves the site and /api/ together.');
  process.exit(2);
} else {
  console.error('usage: npm run editor -- password');
  process.exit(2);
}
