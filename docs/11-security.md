# 11 — Security

What the house protects against, how, and what is left to you. Several of its
files run as root on your machines — boot menus, login messages, application
themes — so the rule is simple: **text never becomes code**, and **nothing is
run that was not checked**.

## Text from the catalogue

A service's name, caption, description and address go into shell scripts,
stylesheets, XML, JSON, Markdown and the console's login screen. Two layers
keep them text:

1. **At the door.** The catalogue refuses control characters (a newline in a
   name could end a script's line and start another), names and captions over
   48 characters, descriptions over 120, addresses with quotes, spaces, `$`,
   `<`, `>` or backslashes, and logos outside `catalog/logos/` or over 512 KB.
   The same check guards the Atelier and its share links: a design someone
   sends you cannot carry anything the catalogue would refuse.
2. **At every use.** Each kind of file escapes on its own, so none depends on
   the first layer: scripts print text as single-quoted words (never inside a
   here-document), comments cannot be closed early, XML and Markdown are
   escaped, JSON is written by a JSON writer, getty's backslash escapes are
   doubled, CSV cells cannot start a spreadsheet formula.

The test suite feeds a service whose name tries every way out — here-document
ends, `$(…)`, back-quotes, quotes, comment ends, `{{…}}`, HTML, `javascript:`
links, terminal escape codes — straight into every generator, past the first
layer, and checks that nothing runs and every file still parses.

## The site

- The guide renders Markdown without passing HTML through: comments are
  dropped, an image is rebuilt from its source, width and text alone, anything
  else is shown as text, and links go only to pages and web addresses.
- The page carries a content policy of its own (scripts and everything else
  only from the site itself, forms only to it), and nginx sends the same with
  `X-Content-Type-Options`, a referrer policy, a permissions policy (no camera,
  microphone or location), and no version number. The brand's files are served
  sandboxed.
- Nothing in the browser talks to another server; designs stay in the
  browser that made them.

## Scripts fetched from the site

The one-command installers fetch the files they need and check each against
the SHA-256 written inside the script before running anything. That protects
against damaged or swapped *files*, but not against a swapped *script*: over
plain HTTP, anyone who can tamper with the network between you and the server
could change the script and its checksums together. So:

- **Serve the site over HTTPS** — behind your reverse proxy with a
  certificate (see *The site on your server*). The Downloads page warns when
  it is opened over plain HTTP.
- Or **check the script first**: the Downloads page gives each installer's
  SHA-256 and a command that saves it, checks it, and only then runs it — check
  the checksum against a copy you trust (this repository, built by you).
- On Arch, the package's `PKGBUILD` pins every file; build it from a copy you
  trust for the same guarantee.

## The automatic rebuild

The builder runs the repository's own code whenever the catalogue changes or
it pulls from GitHub. Whoever can push to the repository can therefore run
code on the server, as the builder's user: keep push access to yourself
(and two-factor authentication on the account). Within that:

- it only fast-forwards — it never merges, rebases or discards a change made
  on the server;
- dependencies are installed with `npm ci --ignore-scripts`: no package's
  install script ever runs (none of the house's dependencies needs one);
- the builder runs as an ordinary user, with no open ports; both containers
  run with `no-new-privileges`, and the web server read-only with only the
  capabilities nginx needs;
- `npm audit` reports no known vulnerability in the dependencies.

## Scripts that run as root

Every script that changes the system keeps a copy of what it replaces, writes
files in one step (a half-written boot menu would not boot), takes
`--restore`, and refuses rather than guesses: GRUB's and Limine's scripts stop
on a machine that does not use them, Limine's stops when its configuration is
enrolled for Secure Boot and the tool to enrol it again is missing, the SSH
banner is checked with `sshd -t` before sshd reloads and taken back out if it
fails. Application kits run inside the application's container where they can,
in a fresh temporary folder.

## What is not covered

- The house's scripts trust the machine they run on: a root user who can
  already change `/etc` gains nothing from them.
- Application themes ride on the applications' own customisation features;
  they do not change how those applications handle security.
