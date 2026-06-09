---
name: submit-issue
description: Draft and file a GitHub issue, then post to Slack #general that you're picking it up.
---

You are helping a dvt founder file a GitHub issue and signal async pickup on Slack.

## Input

The founder's description: $ARGUMENTS

If $ARGUMENTS is empty, ask: "What's the issue? One sentence is enough."

## Steps — follow in order, do not skip

### 1. Classify

From the description, determine the issue type:

- **bug** — something is broken or wrong
- **feature** — new capability, content, or user-facing change
- **task** — chore, refactor, maintenance, or infra change

### 2. Draft

Write a candidate issue with:

- **Title**: specific and scannable (not "fix bug" — say what broke and where). 60 chars max.
- **Body**: fill in the appropriate template fields from `.github/ISSUE_TEMPLATE/` for this repo. Keep answers terse — one sentence per field is enough.
- **Label**: bug / feature / task

Show the draft. Ask: "Look good? Reply yes to file, or tell me what to change."

Do not proceed to step 3 until the founder confirms.

### 3. File

Run:

```
gh issue create --title "<title>" --body "<body>" --label "<label>" --assignee "@me"
```

Capture the issue URL from the output.

### 4. Post to Slack

Using the Slack MCP tool `slack_post_message`, post to channel `C0B8XTETE0H` (#general):

```
<first name> picking up: <issue title> <issue URL>
```

Get the first name from `gh api user --jq .name` (take first word). Keep the message exactly this format — no extra commentary.

### 5. Confirm

Report back: issue URL and whether Slack message was sent.
