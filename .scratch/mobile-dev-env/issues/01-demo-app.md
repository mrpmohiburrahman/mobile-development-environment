Type: grilling
Status: resolved

## Question

What app should the IDE wrap around? The blueprint view only reads well with enough visually distinct screens, and anything needing API keys breaks for whoever clones the repo.

## Answer

An original habit tracker, ~7 screens: Login, Today, HabitDetail, AllHabits, Stats, Profile, Settings.

Chosen because it is token-dense in every direction a design system cares about — streak rings and category chips exercise colour, cards exercise radius and spacing, the stats screen exercises typography scale — while needing zero assets, zero API keys and zero backend. Seeded local data means `git clone && npm install && npm start` just works.

Rejected: rebuilding his Japanese-study app (needs an LLM key to be interesting, so it is dead on arrival for a reviewer), and bolting onto an existing project (none supplied).
