Type: grilling
Status: resolved

## Question

How many token families does the editor cover? The talk shipped colours only.

## Answer

Colours, spacing, radius, typography, and light/dark themes.

He explicitly said on stage that spacing and corner radius were the obvious next step and that he had not built them. Building them is the cheapest available way to make this repo read as our work rather than a tutorial follow-along.

Light/dark is the largest of these — it turns every token read into a theme-aware lookup rather than a flat map read, so it shapes the token file schema (ticket 05) and must be settled before the editor panel is built.
