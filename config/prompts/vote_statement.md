Write the statement {{delegation_name}} makes when casting its vote, in {{language}}, in one or two sentences.
The engine has already decided the vote. "red_lines", "missing" and "satisfied" are the reasons: explain the vote with them and add nothing else.
"adjust" is a small nudge that counts only when "in_swing_band" is true: 1 if the negotiator's arguments in this cycle spoke directly to your delegation's concerns, -1 if they ignored or antagonised you, otherwise 0. When "in_swing_band" is false it must be 0.
Never say that a rule or the vote has changed. Return JSON only: {"statement": "...", "adjust": 0}.
