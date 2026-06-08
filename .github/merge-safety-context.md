<!--
Repo-specific merge-safety guidance for the auto-approve confidence judge in
.github/workflows/pr-agent.yml. The workflow appends this file to a generic
gatekeeper system prompt, so the workflow itself stays identical across repos
and each repo tunes its own risk rules here. Keep it short and concrete.
-->
This repository is the dvt website (dvt.dev): Astro front end with Cloudflare
Pages Functions and a D1 database. Trivially safe (high confidence): copy/docs,
comments, or a config typo.

Score lower (route to human review) for anything touching:

- The handraise API / form-submission endpoints
- D1 schema or migrations
- Secrets, API tokens, or environment bindings
- Build or deploy configuration (wrangler, Pages, CI)
