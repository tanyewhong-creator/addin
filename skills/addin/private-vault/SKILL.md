---
name: private-vault
description: "Manage local secrets the agent may need: prefer OS keyring, never plaintext in repos."
version: 1.0.0
author: A/addin
license: MIT
platforms: [linux, macos]
metadata:
  hermes:
    tags: [secrets, privacy, security, addin]
    related_skills: [audit-log]
---

# Private Vault

## overview

A/addin's privacy thesis: the agent runs locally and the user owns their data.
Secrets are no exception. This skill teaches the agent and the user the recommended
secret-handling workflow that keeps credentials out of repos, screenshots, and
prompts.

The agent never needs to see a secret value to use it — the OS keyring or a shell
variable set before the session starts is enough. This skill exists so the agent
knows where to look and how to ask, without the user having to explain the workflow
each time.

## when to use

Use this skill when:

- The agent needs an API key (GitHub token, OpenAI key, cloud credentials, etc.)
  to carry out a task the user has requested.
- The user pastes a secret value directly into the chat window by mistake.
- The user asks how to store or rotate a credential that the agent will need in
  future sessions.
- Setting up a new integration that requires a bearer token or shared secret.

## when not to use

- **Arbitrary user data** — notes, drafts, and preferences belong in `~/.addin/`.
  The vault workflow is for credentials and tokens only.
- **Replacing a dedicated password manager** — if the user already has 1Password,
  Bitwarden, or a similar tool, defer to it. This skill describes the pattern; it
  does not compete with purpose-built secret managers.
- **Storing secrets on behalf of the agent** — the agent does not maintain its own
  persistent credential store in v2.0. Per-request retrieval, described below, is
  the safe pattern.

## recommended storage, ranked

### 1. OS keyring

The highest-trust option: the credential is encrypted at rest and unlocked with the
user's login session. No plaintext file to accidentally commit.

**Linux** — `secret-tool` from `libsecret-tools`:

```sh
# store a GitHub personal-access token
secret-tool store --label='github-token' service github account user

# retrieve it (prints the value to stdout)
secret-tool lookup service github account user
```

**macOS** — `security` (ships with Xcode CLTools):

```sh
# store
security add-generic-password -a "$USER" -s github-token -w

# retrieve
security find-generic-password -a "$USER" -s github-token -w
```

When the agent needs the credential at task time, it shells out to the appropriate
command above and uses the result directly without logging it. See *what the agent
should ASK before retrieving* below.

### 2. Per-shell environment variable in `~/.addin/secrets.env`

Useful when the keyring is unavailable or the user prefers a portable approach.
The file must be gitignored and sourced explicitly — never auto-loaded by the agent.

**.gitignore snippet** (add to the root of any project repo):

```
# addin secrets — never commit
.addin/
secrets.env
*.env
```

**Sourcing pattern** (add to `~/.bashrc` / `~/.zshrc` or run manually before a session):

```sh
[ -f ~/.addin/secrets.env ] && source ~/.addin/secrets.env
```

The file itself should contain simple `export KEY=value` lines with no comments
that reveal the purpose of the key more than necessary.

### 3. External password-manager CLIs

If the user already has a CLI-capable password manager (examples: `op` for
1Password, `bw` for Bitwarden, `pass` for the UNIX pass store), the agent can
shell out at request time to retrieve a secret without ever seeing it persist to
disk. The agent does not endorse a specific tool — defer to whatever the user has
installed and trusts.

## what addin will never do

- **Write secrets to the audit log.** `addin/network/egress.py` records only the
  destination hostname and port for each outbound connection — never the request
  body, headers, or bearer tokens. See the `audit-log` skill's *what's not in the
  audit log* section for the full list of exclusions.
- **Echo secrets in nudges.** Nudge text is human-readable, stored in
  `~/.hermes/curator/nudges.json`, and visible in the dashboard. No secret value
  should ever appear there.
- **Copy secrets into `~/.hermes/sessions/`.** Session context is stored for
  conversational continuity, not as a credential cache. The agent must re-fetch a
  secret from the keyring each time it is needed.

## redaction posture

If the user pastes a secret value directly into the chat:

1. The agent should flag it immediately: "that looks like a credential — I won't
   store or repeat the value."
2. Suggest moving it to the OS keyring using the commands above.
3. Ask the user to delete the message from the chat if their client supports it.
4. Do not quote or re-echo the value in any subsequent message, nudge, or audit
   event.

The agent should not store the raw value in session context after the conversation
ends.

## what the agent should ask before retrieving

Before shelling out to the keyring or reading a `secrets.env` file, the agent must
confirm scope with the user:

- **One-time retrieval:** "To complete this task I need your GitHub token — okay to
  retrieve it from the OS keyring for this request only?"
- **Session-wide:** "Should I keep the token available for the rest of this session,
  or retrieve it fresh each time?"

Never auto-fetch a secret speculatively (e.g., "I'll grab the token now in case you
need it later"). Fetch only when the task concretely requires it, with explicit
user consent for that specific retrieval.

## future work

v2.1+ may add an `addin vault` CLI wrapper that codifies this workflow — a thin
layer around the OS keyring with a consistent interface across Linux and macOS.
v2.0 ships content-only because adding a Python `keyring` dependency was deemed out
of scope for the Phase 2c bundle. The recommended workflow described above requires
only system tools that ship with the OS or are installable via the system package
manager.
