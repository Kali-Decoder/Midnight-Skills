## What this changes

<!-- One or two sentences. Link the issue if there is one. -->

## Type

- [ ] New core skill
- [ ] Update to an existing skill
- [ ] Community skill entry (`community.skills` in `skills.json` only)
- [ ] Error lookup (`midnight-common-errors/errors.json`)
- [ ] Versions (`references/versions.json`)
- [ ] Tooling / scripts / MCP server

## Checklist

- [ ] `npm run sync:registry` run and its output committed
- [ ] `npm run validate:registry` and `npm run check:versions` pass
- [ ] Network and version set tested on: <!-- e.g. preprod, Ledger 9.1 -->
- [ ] No secrets, mnemonics, or API tokens in the diff
- [ ] Community entries: full 40-character `commit` SHA, one skill per PR
