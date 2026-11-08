# Known Risks

Exposures found in review that are not yet fixed. Each section names what an
attacker could reach, the input or state that reaches it, and the mitigation.
A risk is removed from this file when the fix lands, not when it is queued.

None open. The last was `2026-11-07: a .glb asset can make the page fetch a URL
it names`, fixed on 11-08-26 by holding both glTF formats at a loading manager
that refuses every address but a `data:` inside the file and a `blob:` the page
made from it. `git log -- KNOWN_RISKS.md` has what it said.
