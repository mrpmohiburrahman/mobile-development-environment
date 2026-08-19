Type: task
Status: resolved
Blocked by: 04

## Question

Define the token file schema (covering all five families plus light/dark) and build the server that patches it. Includes the two-backend client from ticket 04: HTTP when a token server answers, in-memory fallback otherwise.

## Answer

Schema is `color.{light,dark}.*`, `space.*`, `radius.*`, `type.<role>.{size,weight,lineHeight}` — dotted paths throughout, so one `setPath` handles every family.

Server is `token-server/index.mjs`: Node stdlib only, no dependencies and no build step. `GET /tokens`, `POST /token {path,value}`, `POST /revert`. It refuses paths that don't already exist, so a typo can't silently add a token.

Two decisions worth recording:

- The server writes a **trailing newline**. Without one every diff ends in `\ No newline at end of file`, which is noise in the exact artifact this tool exists to make readable.
- The committed `tokens.json` is stored in the server's own output format. It wasn't at first, and the very first edit produced a 40-line reformat diff instead of a one-line diff — which would have undercut the whole demo. Verified: an edit is now exactly `1 insertion(+), 1 deletion(-)`.

The two-backend requirement from ticket 04 is met by making edits an **override layer** merged over the JSON rather than a mutation. With a server the file converges on the override so the override is a no-op; with no server the override is all there is. One code path, both modes.
