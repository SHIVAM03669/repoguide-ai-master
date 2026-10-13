# RepoGuide AI: Project Guide

**A practical explanation of the product, its use cases, features, and architecture**
Updated: 13 October 2026

## 1. The project in one minute

RepoGuide AI is an engineering workspace for understanding a GitHub codebase before changing it. A user opens a repository, and the app indexes its source files, dependencies, and available Git history. The result is a navigable architecture map, searchable code, change-impact information, evidence-backed answers, and pull request review support.

The central idea is **traceability**. The dependency graph comes from parsed files and imports. AI receives retrieved code as context, and Ask checks its citations against those snippets. A developer can move from a high-level question to the actual file and line that supports the answer.

> **Short description for a judge:** “Paste a GitHub repository into RepoGuide AI. It maps the real code relationships, helps you find and understand relevant files, and shows the likely impact of a change before review.”

## 2. The real problem and who uses it

When a developer joins a project or receives a bug report, the repository may contain hundreds or thousands of files. A README rarely explains every dependency. Finding the correct module is only the first step: the developer also needs to know who imports it, what tests may matter, whether it has a history of frequent changes, and what a pull request might affect.

RepoGuide AI is useful for:

| Person | Real task | What the product helps them do |
|---|---|---|
| New contributor | Learn an unfamiliar repository | See modules, dependencies, documentation, and important files together. |
| Maintainer | Assess a proposed edit | Trace direct and indirect dependents, related tests, and change history. |
| Reviewer | Examine a pull request | Inspect changed files, impact signals, structured findings, and supporting evidence. |
| Team using an IDE agent | Give an agent repository context | Let the agent query the same indexed search, dependencies, impact, and Ask services through MCP. |

### A realistic example

Imagine a developer is asked to fix an incorrect token-expiry check in a repository they have never seen. They open the GitHub repository in RepoGuide AI, search for expiry-related code, and select the likely file. The dependency graph shows modules that import it. Impact Analysis lists direct and transitive dependents, related tests, and any history-based signals. The developer can ask, “Where is token expiry enforced?” and open the cited lines. After making a change in their normal editor, they can inspect a pull request review for potential issues and tests to run.

This is an **example workflow**, not a claim that the app made or tested a particular token change. RepoGuide AI informs the developer; it does not edit the repository or run tests for them.

## 3. User workflow

```text
Open a GitHub repository
        ↓
Index source and build the dependency graph
        ↓
Explore architecture, search, wiki, and history
        ↓
Ask a grounded question or inspect change impact
        ↓
Review a PR, verify findings, and run relevant tests locally/CI
```

1. **Open a repository.** A public visitor can paste `owner/repo` or a GitHub URL without signing in. GitHub OAuth provides the signed-in path for repositories the account is authorized to access. A separate demo mode shows seeded UI data without indexing a live repository.
2. **Wait for indexing.** The app clones the repository and reports progress. Once parsing and graph building finish, the architecture view can be explored; search chunks and Git history may continue preparing in the background.
3. **Find the relevant area.** Browse the graph, search code, read indexed Markdown docs, or inspect hotspots and revisions.
4. **Investigate a proposed change.** Select a file, symbol, or PR to inspect dependencies, likely blast radius, test recommendations, and historical context.
5. **Use AI where it adds value.** Ask a natural-language question or request a PR review. The selected chat model receives repository evidence and returns structured output; the app validates citations/findings before showing them.
6. **Verify outside the app.** Open the cited source, make the edit in an editor, and run the suggested tests in a local environment or CI. Review findings are advisory.

## 4. What each feature does

### Entry, access, and progress

- **Public open and browse:** Open a public GitHub repository by URL or slug, or browse public repositories. The guest session is scoped to the selected repository.
- **GitHub sign-in:** OAuth lets an authorized user choose public or private repositories. Private access depends on the GitHub account and its permissions.
- **Index progress and settings:** Progress indicators show indexing state. Settings display repository and index health and provide a re-index action. Results are tied to an indexed Git revision (commit SHA).

### Understand the codebase

- **Overview:** A starting page with repository metrics, active pull requests, hotspots, and routes into the main investigations.
- **Dependency Graph:** A 2D system view and file-level graph built from indexed module and symbol edges. A user can inspect relationships, trace paths or cycles, change graph layout, select a revision, and jump to a file, search, or impact analysis. An optional 3D exploration route exists; the 2D view is the default.
- **Code Search:** Searches indexed code chunks with lexical and vector signals, returning file paths and line ranges. The default local embedding is a deterministic hash representation; it is separate from the chat model. Search becomes useful after background chunk indexing finishes.
- **Wiki:** Lists the repository's indexed Markdown/MDX files, including README, docs, and ADR-like paths. It displays existing repository content; it does not fabricate documentation.
- **Digest:** Exports bounded repository structure and source context for a selected revision as Markdown, text, or JSON. File and total-size limits prevent unbounded exports.
- **Reverse prompt:** Produces a build/reconstruction prompt from the repository digest. It separates observed evidence, inferences to validate, and unknowns.

### Investigate changes

- **Impact Analysis:** Starts from a file, symbol, or pull request and traces dependencies to estimate direct and transitive blast radius. It also shows risk factors, confidence, relevant tests, co-change or similar-change history when available, and a safe-change checklist. Risk is a heuristic signal, not a prediction that a test will fail.
- **Ask RepoGuide AI:** Retrieves relevant code snippets and nearby graph context, sends them with the question to the configured chat provider, and expects a structured answer with confidence and file/line citations. Citations outside the retrieved snippets are discarded. If the model response is invalid, the app returns a low-confidence fallback instead of presenting it as verified evidence.
- **Topography and hotspots:** A 2D landscape and ranked files or modules based on recent change activity and related signals. Users can switch lookback windows and open a hotspot in Impact Analysis. An optional 3D exploration route is separate from the default view.
- **History:** Shows indexed revisions and lets users search commit and PR history. Co-change and similar past changes help answer whether files tend to change together. History-based panels depend on history ingestion being complete.

### Plan and review

- **Planning:** Surfaces candidate files from hotspot data and guides the “plan → agent → PR → impact → review → verify” loop. These are candidates for investigation, not an automatically saved project plan.
- **Pull Requests:** Lists indexed PRs and provides detail views for changed files, impact, review status, test signals, and findings. A review can be triggered from the UI or by configured GitHub webhook flow.
- **Findings:** Groups review findings for inspection. The review service uses code changes and supporting context to request structured findings from the chat provider, validates their evidence, applies review policy, and can optionally publish a GitHub Check when configured. A finding is a suggestion for human review, not an enforced CI gate.

### Integrate with developer tools

- **MCP server:** Exposes `search_codebase`, `find_impact`, `trace_dependencies`, `search_history`, `ask_repository`, `get_context_pack`, `repo_digest`, and `repo_reverse_prompt` to clients such as Cursor or Claude Desktop. These tools call the same repository services as the web app and identify the indexed repository and revision in their results.

## 5. How the system works

```text
GitHub ──clone / webhook──► Fastify API ──jobs──► Worker
                              │                     │
                              └─────────┬───────────┘
                                        ▼
                          PostgreSQL + pgvector
                          files, revisions, graph,
                          search chunks, PRs, history
                                        ▲
                                        │
Browser ──► Next.js web + BFF ──► API services
                                        │
                          Ask / PR review requests
                                        ▼
                         Google-hosted Gemma 4*

IDE agent ──► MCP server ──► the same indexed services

* When LLM_PROVIDER=gemma and the Google API is available.
```

| Part | Job |
|---|---|
| `web/` | Next.js Pages dashboard, GitHub OAuth and signed guest sessions, and a server-side BFF that proxies allowed requests to the API. |
| `api/` | Fastify REST API, repository indexing, analysis, AI provider selection, background worker, CLI, and MCP server. |
| `common/` | Shared IDs, types, and calculation helpers used by web and API. |
| PostgreSQL + pgvector | Keeps repository revisions, parsed files/symbols, dependency edges, code chunks, PRs, findings, and history. |
| Redis + worker | Supports background coordination and queued indexing/review work. |
| GitHub | Supplies repository content, metadata, OAuth access, PRs, and optional webhook events. |

### Indexing, step by step

1. **Acquire source safely.** The API gets GitHub metadata, clones or updates the repository under a per-repository lock, and swaps in a complete checkout rather than exposing a partial one.
2. **Parse supported source.** File discovery selects TypeScript, JavaScript, Python, and Go source files. Tree-sitter extracts symbols, imports, and exports.
3. **Build the graph.** The indexer resolves imports and persists module and symbol dependency edges for a specific commit SHA. This deterministic work makes architecture and dependency traversal available without waiting for an LLM.
4. **Prepare search.** Files are divided into bounded chunks and embedded. The local default is a hash embedding; other embedding providers can be configured. Search combines lexical/vector signals and graph-related ranking.
5. **Ingest history.** Git commits and changed files are processed to derive hotspots and co-change relationships. This can run after the core graph is ready.
6. **Refresh on change.** An explicit re-index or configured GitHub webhook can start new work. Revision-aware views keep evidence tied to the source version being examined.

### Where Gemma 4 fits

The local configuration currently selects **Gemma 4 26B A4B IT** through Google's hosted generate-content API. The API key stays server-side. Gemma 4 is called by the shared LLM provider for two workflows:

| Workflow | Evidence sent to the model | Output used by the app |
|---|---|---|
| Ask | User question, retrieved code snippets, and limited graph context | JSON answer, confidence, and citations checked against retrieved file/line ranges. |
| PR review | PR changes, changed symbols, snippets, and test signals | Structured findings checked against supporting snippets and review policy. |

MCP `ask_repository` calls the same Ask service. Gemma 4 **does not** clone repositories, parse code, build dependency edges, compute embeddings, or run tests. The provider can be switched through `LLM_PROVIDER`; `EMBEDDING_PROVIDER` is configured independently. See [AI_PROVIDERS.md](./AI_PROVIDERS.md).

## 6. Data, trust, and security boundaries

- **Versioned evidence:** A `Repository` has indexed `RepositoryRevision` records keyed by commit SHA. Files, symbols, edges, and chunks belong to a revision, so a result can identify the code version it came from.
- **Grounded output:** Ask checks file and line citations against the snippets retrieved for that request. The graph is derived from parsed source, while AI output remains advisory and can still be incomplete or wrong.
- **Sessions and access:** The web app signs session cookies, scopes dashboard proxy requests to the selected repository, and keeps GitHub credentials on the server side. The API supports a shared internal secret; it is required in production configuration. Webhooks use signature verification.
- **Repository data:** Opening or authorizing a repository sends its source through the indexer and stores indexed content in PostgreSQL. When AI features are used, selected retrieved snippets are sent to the chosen external chat provider. This matters when choosing a provider for private code.
- **Operational limits:** AST dependency support is first-class for TypeScript, JavaScript, Python, and Go. History signals need ingested history; PR features need PR data. The app recommends tests but does not execute them or guarantee that a change is safe.

## 7. What is needed to run it

The app needs Node.js/Yarn and Git, PostgreSQL with pgvector, and Redis. The web and API can run locally; a worker handles queued jobs when indexing is not inline. Templates are [web/.env.example](../web/.env.example) and [api/.env.example](../api/.env.example). Use [SETUP.md](./SETUP.md) for the commands and migrations.

| Capability | Main configuration |
|---|---|
| Web ↔ API and session | `REPOPILOT_API_URL`, `SESSION_SECRET`; matching `INTERNAL_API_SECRET` for the web and API in production. |
| Database and jobs | `DATABASE_URL`, Redis connection, `REPO_CLONE_ROOT`, and `INDEX_INLINE` or a running worker. |
| Public GitHub access | Public repository URL; a `GITHUB_TOKEN` can help with authenticated GitHub API access. |
| Private repositories | GitHub OAuth client ID/secret and correctly configured callback URL and permissions. |
| Gemma 4 Ask/review | `LLM_PROVIDER=gemma`, `GEMINI_API_KEY`, optional `GEMMA_CHAT_MODEL=gemma-4-26b-a4b-it`. |
| Search embeddings | `EMBEDDING_PROVIDER=local` by default; Ollama or OpenAI are optional alternatives. |
| GitHub automation | `GITHUB_WEBHOOK_SECRET`; publishing Checks also requires suitable GitHub authorization. |
| MCP | `MCP_REPO_SLUG` or `MCP_REPOSITORY_ID` bound to an indexed repository. |

Never put `GEMINI_API_KEY`, `GITHUB_CLIENT_SECRET`, `SESSION_SECRET`, or `INTERNAL_API_SECRET` in a `NEXT_PUBLIC_*` variable. The legacy `REPOPILOT_API_URL`, `@repopilot/*` package IDs, and existing deployment URLs are technical identifiers retained after the user-facing rename to RepoGuide AI.

## 8. Current validation and honest demo boundaries

As of 13 October 2026, the local web and API health endpoints responded successfully, and the API/worker containers were running with `LLM_PROVIDER=gemma`. A direct small Gemma provider request returned parseable JSON. The web suite passed **216 tests**, the focused provider suite passed **8 tests**, and web type-check/API build passed.

An end-to-end Ask request against an indexed public repository received **HTTP 500 from Google's Gemma endpoint** in the latest check. The integration is configured and the provider path has been exercised, but a reliable live Ask demonstration needs a successful recheck of that external service. The full local API suite also had Vitest worker exits in 11 suites, so it should not be described as passing. The public guest path and repository index were exercised locally; a real private-repository OAuth callback, PR publication, and external MCP client session were not verified in that check.

For a judge demo, the most dependable sequence is: open a small public repository, show its real graph and a file's impact, then run Ask only after confirming the model endpoint responds. Keep a screenshot of a genuine result as a backup, clearly identified as a prior run.

## 9. Terms used in this document

| Term | Meaning here |
|---|---|
| **Index** | Stored, revision-specific files, symbols, edges, chunks, and history derived from a repository. |
| **Dependency edge** | A parsed relationship such as one module importing another. |
| **Blast radius** | Files or modules that may be affected because they depend on the selected target. |
| **Hotspot** | A file or module highlighted by change activity and related risk signals. |
| **Grounded answer** | An AI answer accompanied by citations to retrieved code that the app validates. |
| **BFF** | The Next.js server layer between the browser and private Fastify API. |
| **MCP** | Model Context Protocol, which lets an IDE agent call the project's indexed analysis tools. |

## 10. Source and further reading

- [README.md](../README.md): product tour and screenshots.
- [PRD.md](./PRD.md): product requirements and intended boundaries.
- [HLD.md](./HLD.md): system architecture and core flows.
- [LLD.md](./LLD.md): modules, data model, routes, and extension points.
- [SETUP.md](./SETUP.md) and [AI_PROVIDERS.md](./AI_PROVIDERS.md): local operation and AI configuration.
- [GAMMA_PITCH_PROMPT.md](./GAMMA_PITCH_PROMPT.md): slide-generation brief based on this product.
