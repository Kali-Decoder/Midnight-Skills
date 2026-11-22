---
name: midnight-mip-planning
description: >
  Plan, write, and shepherd a Midnight Improvement Proposal (MIP) or Midnight Problem Statement (MPS)
  in midnightntwrk/midnight-improvement-proposals, and decide how a MidSkills skill should depend on
  a MIP. Use when a user asks "how do I write a MIP", "draft a MIP/MPS for Midnight", "propose a
  standard / protocol change", "is this MIP accepted", "what status is MIP-00xx", "MIP vs MPS",
  "get my proposal numbered", "why is my MIP PR blocked", or when deciding whether a skill can teach a
  spec as final (BUILDABLE NOW / DRAFT AGAINST PROPOSAL / WATCH / NO MIP).
---

# Midnight MIP Planning

Plan a Midnight Improvement Proposal (or the Problem Statement that should come before it) that editors can number on the first pass, and that has a clear path from Draft to Active.

**What this skill produces:** a decision (MPS, MIP, CoIP, or plain issue), a filled `mip-xxxx.md` / `mps-xxxx.md` draft that follows the real template, a pre-submission checklist, and the exact submission and status steps.

**Primary references (read the live files, never paraphrase from memory):**
- `github.com/midnightntwrk/midnight-improvement-proposals`: `mips/mip-0001-mip-process.md` (the MIP process, Accepted), `mps/mps-0001-mps-process.md` (the MPS process, Accepted), `mips/mip-template.md`, `mps/mps-template.md`, `NUMBERS_INDEX.md`, `ROLLING_AGENDA.md`
- Exemplars that reached **Accepted**: MIP-0002 (contract log emission), MIP-0003 (ECDSA support), MIP-0018 (on-chain token metadata)
- [`references/mip-skill-map.md`](references/mip-skill-map.md): which MidSkills skills depend on which MIPs, with verdicts and a watchlist

**Key facts agents must not get wrong** (checked against the repo at commit `eb62664`, 20 Nov 2026):
- **MPS = the problem, MIP = the solution.** An MPS is solution-agnostic ("what needs solving"); a MIP is a technically precise proposal ("how").
- **File name is literally `mip-xxxx.md` / `mps-xxxx.md`.** Editors assign the number. **Never pick a number, and never edit `NUMBERS_INDEX.md` or the index**: editors manage both.
- **Status at submission is `Draft`.** For an MIP, editors number and merge it as Draft; *you* later file an issue to move it to **Proposed**. For an MPS, editors normally set **Proposed** when they merge (or keep Draft if sections are empty).
- **Commits must have verified signatures**, the CLA must be signed, and **the commit author must be the responsible human**: the repo forbids configuring an AI assistant as commit author *or co-author*. Do not add `Co-Authored-By` AI lines to commits for that repo.
- **The PR describes the change, it does not implement it.** Link to code repositories; one file per proposal (plus an optional same-name resources folder).
- **Accepted is not shipped.** The path is Proposed → (≥ 2 weeks commentary) → editor vote → Accepted → Implemented → Active. Only 4 of 33 numbered MIPs were Accepted as of 20 Nov 2026 (0001, 0002, 0003, 0018).

---

## Workflow

1. **Classify the idea** (§1). Bug or small improvement → issue tracker. Compact language change → check whether it belongs in a CoIP. Problem with several plausible solutions → MPS first. Concrete design → MIP.
2. **Research prior art in the repo** (§2): list every MIP/MPS with its status, find overlaps, and pick the MPS your MIP answers.
3. **Vet publicly**: open a GitHub Discussion in the MIPs repo or post on Discord before drafting. Editors weigh motivation heavily.
4. **Draft from the template** (§3 for an MIP, §4 for an MPS), section by section, using the Accepted exemplars as the quality bar.
5. **Self-review with the checklist** (§6), then fix the editor-feedback patterns (§5) before anyone else finds them.
6. **Submit** (§7): fork, add `mips/mip-xxxx.md`, use signed commits, then assign and mention an editor once ready for numbering.
7. **After numbering**: refine in the GitHub Discussion. When complete, file an issue asking editors to consider it (→ **Proposed**), then freeze substantive changes.
8. **Track status** (§8) and, for MidSkills, apply the skill verdict rules (§9).

---

## 1) MIP, MPS, CoIP, or issue?

| You have | Write | Why |
|---|---|---|
| A bug, a better error message, a perf fix | **Issue** in the relevant repo | MIP-0001: simple improvements and bug fixes "generally do not need a MIP" |
| A real problem with several plausible fixes, or one needing cross-team coordination | **MPS** first | Frames the problem without prescribing a fix; MIPs then answer it |
| A concrete, implementable design | **MIP** (and name the MPS it answers) | Needs a full Specification, Path to Active, and Testing |
| A change to the Compact *language* itself | **Check CoIP first** (Compact Improvement Proposals, `LFDT-Minokawa/compact`) | Editors have flagged that Compact-language work may belong there; MIP-0002 proposed its `emit` syntax as a CoIP alongside the MIP |

**MIP categories:** `Core` (protocol, consensus, VM; may need a network upgrade), `Standards` (app conventions, contract interfaces, data formats), `Networking`, `Governance`, `Informational` (no specific change).
**MPS categories:** `Core`, `Libraries and Tooling`, `Standards`, `Networking`, `Governance`, `Ecosystem`.

---

## 2) Research prior art (do this before writing a word)

Clone the repo and list every proposal with its status. This snippet was run against the repo on 22 Nov 2026 and lists all 82 documents, including folder-based MIPs:

```bash
git clone --depth 1 https://github.com/midnightntwrk/midnight-improvement-proposals.git mips && cd mips
python3 - <<'EOF'
import re, glob, os
for f in sorted(glob.glob('mips/mip-0*') + glob.glob('mps/mps-0*')):
    # some MIPs are folders (e.g. mips/mip-0017-*/mip-0017-*.md); read the file named like the folder
    p = f if f.endswith('.md') else os.path.join(f, os.path.basename(f) + '.md')
    if not os.path.exists(p): continue
    fm = re.search(r'^---\n(.*?)\n---', open(p).read(), re.S)
    g = lambda k: (re.search(rf'^{k}:\s*(.*)$', fm.group(1), re.M) or [None, ''])[1].strip().strip('"')
    print(f"{os.path.basename(f)[:8]:8}  {g('Status'):10} {g('Category')[:14]:14} {g('Title')[:60]}  MPS={g('MPS')} MIP={g('MIP')} Requires={g('Requires')[:40]}")
EOF
grep -n "in review" NUMBERS_INDEX.md      # numbers assigned to PRs that have no file yet
```

Then answer, in your notes:
- **Does an MPS already describe this problem?** If yes, your MIP sets `MPS: MPS-00NN`, and that MPS's *Recommended MIPs* section should list your MIP. If no MPS exists and the problem is contested, write the MPS first.
- **Which MIPs overlap?** Reviewers flag boundaries early (e.g. a mandate-token MIP vs MIP-0029 agent identity). State the boundary in your Rationale and *Out of scope* list.
- **What do you depend on?** Put not-yet-accepted dependencies in `Requires:` (e.g. MIP-0013 requires MIP-0012; MIP-0033 requires MIP-0012, MIP-0013, MIP-0030).
- **Is there a prototype?** Accepted MIPs link working code (MIP-0002 links a ledger PR and compiler issue; MIP-0018 links an experiments repo). Have one, or plan one in the Implementation Plan.

---

## 3) Writing the MIP, section by section

Copy `mips/mip-template.md` exactly. **Its headings are part of the structure; delete the instruction text under them.** Front matter:

```yaml
---
MIP: X
Title: Short Descriptive Title
Authors:
  - Ada Lovelace (adalovelace)          # alphabetize authors by last name
Status: Draft
Category: Standards                     # Core | Standards | Networking | Governance | Informational
Created: 2026-11-22
Requires: none                          # MIPs this depends on that are not yet accepted
Replaces: none                          # MIPs this will supersede when accepted
MPS: MPS-00NN                           # the problem it answers, or "none" (can be added later)
---
```

Keep the Apache-2.0 license comment block from the template right after the front matter.

| Section | What editors expect | What the Accepted MIPs did |
|---|---|---|
| **Abstract** | About 200 words: the problem *and* the solution | One paragraph; reads standalone |
| **Motivation** | Why existing Midnight capabilities are inadequate. MIP-0001: "It's **very** important that proposed changes are well-motivated" | MIP-0018 splits it: *The problem* / *Why an off-chain registry is not enough* / *Why events* |
| **Specification** | Precise enough to implement, unambiguous. **Must state how it is versioned** (MIP-0001) | MIP-0018 opens with RFC 2119 keywords and a **Terminology** list, and has explicit **Limitations** and **Out of scope** lists; MIP-0002 defines two versioning axes and says which changes are amendments and which need a superseding MIP |
| **Rationale** | Why this design; alternatives considered and why rejected | Name the rejected alternatives, and cite neighbouring MIPs to draw boundaries |
| **Path to Active → Acceptance Criteria** | *Objective* milestones from Accepted to Active | MIP-0018: "At least two independent consumers… pass every vector", "at least one issuer other than the authors adopts…" |
| **Path to Active → Implementation Plan** | How it gets built, by whom, in what order | MIP-0002 lists workstreams (ledger, compiler, indexer, SDK) and **what happens if each ships first** ("no breakage") |
| **Backwards Compatibility Assessment** | Hard fork? Who breaks? Migration? | MIP-0018 covers existing contracts and offers an upgrade template |
| **Security Considerations** | New attack vectors and mitigations | Cover what becomes public, replay and malleability, and trust in third parties |
| **Implementation** | Which components change; dependencies | Links to real PRs and issues |
| **Testing** | How you will show it works without regressions | MIP-0018's vectors are **normative**: *Must accept* A1–A6, *Must reject* R1–R6, *Must ignore*. (MIP-0031, still Proposed, ships machine-readable `vectors.json` in its resources folder, a good pattern) |
| **References / Acknowledgements / Copyright Waiver** | Sources, non-author contributors, and the Apache-2.0 + CLA waiver | Keep the waiver text from the template |

**Resources** (images, vectors, specs) go in a sibling folder with the same basename: `mips/mip-xxxx/` before numbering.

---

## 4) Writing the MPS (when the problem comes first)

Copy `mps/mps-template.md`. Sections: **Abstract** (~200 words, no solution), **Vision**, **Problem** (factual, evidence-based, impact-focused, scoped neither too broad nor too narrow), **Use Cases** (real needs, the friction, why it matters), **Goals** (measurable, outcome-focused, prioritized), **Expected Outcomes**, **Open Questions**, **Recommended MIPs** (title, summary, how it relates), References, Acknowledgements. Front matter uses `MPS:`, `Status`, `Category` (MPS list in §1), `Created`, `Requires`, `Replaces`, `MIP`.

- **The license differs:** an MPS ends with *"This MPS is licensed under CC-BY-4.0"*, while MIPs are Apache-2.0.
- **Stay solution-agnostic.** Editors check this at numbering. Put "we could do X" in *Recommended MIPs*, not in *Problem*.
- **Quantify.** On MPS-0044, editors asked for workloads to be defined and for "near zero" to be stated as a probability, including adversarial conditions. Vague goals get pushed to "refine in the MIP".
- **Once Proposed, don't rewrite it.** If the framing changes substantially, author a new MPS that supersedes it. Appending to *Recommended MIPs* is fine.

---

## 5) What editors and reviewers push back on

Taken from review comments on recent MIP/MPS PRs (sampled 22 Nov 2026). Fix these before submitting:

| Pattern | Example from real reviews | Fix |
|---|---|---|
| **Unquantified claims** | "Do we have a size estimate of this tx?", "Quantify as a probability" | Give sizes, rates, bounds and worst cases. MIP-0002 includes capacity and storage projections |
| **Missing failure modes** | "Lack of handover will result in rotation stall. Should we have a fallback?" | Specify every fallback and degraded mode |
| **Unsafe defaults** | "Could we disallow the default fallback? Seems like a prudent step" | Choose fail-closed defaults and justify any permissive ones |
| **Unclear scope** | "Should the monitoring capability be also specified here? A separate MIP?" | Add an *Out of scope* list and say where excluded work belongs |
| **Overlap with an existing proposal** | A mandate-token MIP vs MIP-0029 (MAIS) | Cite the neighbour, and state who owns what in Rationale |
| **Alternatives not discussed** | "Was a ZK proof holding the … certificate also considered?" | List the alternatives and why you rejected each |
| **Wrong venue** | "There is a CoIP process … this MPS may belong there instead" | Check the CoIP fit for Compact-language changes |
| **Process violations** | "commits need verified signatures", "The numbers index is exclusively managed by the MIP editors … A MIP proposal should only have one file" | Sign commits, sign the CLA, add one file, use `xxxx`, don't touch indexes |
| **Front-matter slips** | Editor suggestions fixing `MPS: "0036"` and `Status: Proposed` | Copy the template keys exactly; let editors set number and status |

---

## 6) Pre-submission checklist

- [ ] Searched all MIPs/MPS (§2); `MPS:` and `Requires:` filled in, and overlaps named in Rationale
- [ ] File is `mips/mip-xxxx.md`, with `MIP: X` and `Status: Draft`; resources are in `mips/mip-xxxx/`
- [ ] Every template heading is present, all instruction text is removed, and the license block and copyright waiver are kept
- [ ] Abstract is about 200 words and states both the problem and the solution
- [ ] Specification defines its terms (and uses RFC 2119 MUST/SHOULD/MAY where it sets requirements, as MIP-0018 does)
- [ ] Specification states its **versioning** rule: what counts as an amendment vs a superseding MIP
- [ ] Limitations and *Out of scope* are explicit
- [ ] Every number that matters is quantified (sizes, limits, rates, costs, fees)
- [ ] Failure modes and fallbacks are specified, and defaults are safe
- [ ] Acceptance Criteria are objective and independently checkable (e.g. "two independent implementations pass the vectors")
- [ ] Implementation Plan names workstreams and their ship order, and links a prototype if one exists
- [ ] Backwards compatibility: says whether a hard fork is needed, and gives a migration path for existing contracts and wallets
- [ ] Security Considerations cover what becomes public, replay, malleability, and trust assumptions
- [ ] Testing includes vectors (must-accept / must-reject) where a format or encoding is defined
- [ ] No implementation code in the PR, only links
- [ ] Commits are signed and verified, the CLA is signed, and the commit author is the human author (no AI author or co-author)

---

## 7) Submission and the road to Accepted

```text
fork → add mips/mip-xxxx.md (Status: Draft) → open PR
     → when ready for numbering: assign a MIP Editor as reviewer AND mention them in a PR comment
     → editors review at a scheduled meeting: number + merge (still Draft) | send back with feedback | close
     → refine in a GitHub Discussion (Discussion → Issue → follow-up PR for real changes)
     → when complete: file an ISSUE naming the MIP number, asking editors to consider it   → Proposed
     → no substantive edits from here; ≥ 2 weeks community commentary
     → editor vote at a scheduled meeting (see ROLLING_AGENDA.md)                          → Accepted | Rejected
     → implementation done                                                                 → Implemented
     → deployed in a network upgrade                                                       → Active
```

- **Be explicit when you're ready.** Editors only consider numbering after you assign and mention them, and only consider acceptance after you file the issue. Opening a PR is not a submission.
- **Numbers come at numbering time, not at acceptance.** Gaps in the sequence are normal; MIP-0028 is assigned "in review" with no file yet.
- **An MPS differs:** merging normally makes it **Proposed** with no separate issue. Editors open a Discussion titled `MPS-NNNN: <Title>`, and the vote is a Discussions poll (label `MPS Vote`) closed at an editors meeting. Accepted MPSs become *Resolved* when their Recommended MIPs land.

---

## 8) Status reference

**MIP:** `Draft` → `Proposed` → `Accepted` / `Rejected` → `Implemented` → `Active`. Plus `Withdrawn` (any time before the vote), `Superseded` (a newer accepted MIP says so), and `Obsolete` (editors vote).
Final statuses: **Informational = Accepted**, **Governance = Implemented**, **Core / Standards / Networking = Active**.

**MPS:** `Draft` → `Proposed` → `Accepted` / `Rejected` → `Resolved`. Plus `Withdrawn`, `Superseded`, and `Obsolete`.

**How agents should talk about status:** always quote the status from the file's front matter and the date you read it. "MIP-0011 (Proposed, read 20 Nov 2026)" is correct. "The shielded token standard" with no status is not. Never say a Proposed MIP "is the standard".

---

## 9) Depending on a MIP from a MidSkills skill

The skill teaches how to build; the MIP defines the standard. Never restate a spec from memory when the MIP is the source. Give every planned skill a verdict:

| Verdict | When | What the skill does |
|---|---|---|
| **BUILDABLE NOW** | The MIP is Accepted, or the feature is live code (e.g. Ledger 9 `emit`, ECDSA) | Build it; cite the MIP as canonical |
| **DRAFT AGAINST PROPOSAL** | The MIP is Proposed (a detailed spec that can still move) | Build it, **state the MIP's status inside the skill**, and re-check on every refresh |
| **WATCH** | The MIP is Draft, or there is only an MPS | No skill yet; add it to the watchlist |
| **NO MIP** | Third-party product or integration | Ground it in the project's own docs; cite adjacent MIPs as context only |

The current mapping, verdicts, custody cluster, and watchlist are in [`references/mip-skill-map.md`](references/mip-skill-map.md). **Re-run the §2 status script on every MidSkills refresh**: a status change is the earliest signal that a skill needs work, before the toolchain or docs move.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| PR labelled `BLOCKED \| Unverified` | Unsigned commits | Set up commit signing (GitHub docs: *signing commits*), re-sign, and force-push |
| CLA bot comment pending | CLA not signed | Sign via the CLA assistant link on the PR |
| Editor: "revert changes to NUMBERS_INDEX" | You edited editor-managed files | Revert them; submit only your proposal file (plus its resources folder) |
| PR open for weeks with no numbering | Editors weren't asked | Assign a MIP Editor as reviewer **and** mention them in a comment |
| Numbered, but never voted on | No submission issue | File an issue naming the MIP number and asking for consideration |
| "This is solution-shaped" on an MPS | Problem section prescribes a fix | Move solutions into *Recommended MIPs*; keep *Problem* evidence-based |
| Reviewers ask for numbers | Qualitative claims | Add sizes, bounds, probabilities and adversarial cases |
| "Belongs in CoIP" | Compact language change | Propose the syntax via Compact's CoIP; keep ledger/indexer/SDK parts in the MIP |
| An agent cites a MIP number that doesn't exist | Recalled from memory | Re-run the §2 script; quote only numbers and statuses read from the repo |

---

## Related Skills

| Task | Skill |
|------|-------|
| Ledger 9 `emit`, ECDSA, cross-contract calls (MIP-0002, MIP-0003) | `compact/` |
| Security review of what a proposal makes public | `security/` |
| Token standards context (MIP-0011, MIP-0014, MIP-0018) | `token-transfers/`, `nft/` |
| Custody-account future (MIP-0012/0013/0022/0030/0033) | `midnight-passport/` |
| Indexer / query RPC proposals (MIP-0009, MIP-0026) | `indexer/`, `midnight-js/` |
