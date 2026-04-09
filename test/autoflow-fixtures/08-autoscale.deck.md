footer: autoflow rules · autoscale
slidenumbers: true
autoflow: true
theme: nordic
scheme: 1

# Cover

---

<!--
RULE: autoscale (priority 80, last in the chain)
TRIGGERS WHEN:
  - The slide has 9+ content lines OR 80+ total words
  - No earlier rule matched (this is the safety net)
EFFECT:
  - Adds [.autoscale: true] and [.autoscale-lines: N]
  - The CSS reduces font size based on the line count tier:
      light: 9-12 lines
      moderate: 13-18 lines
      dense: 19+ lines
-->

# A long talk on engineering judgment

Engineers learn that there are tradeoffs. They learn that no choice is free,
and that every decision they ship has a cost the team or the user will pay
later, in time, in money, in confusion, or in trust.

Some lessons can be told. Most have to be felt. The hard part of getting
better is not absorbing more facts but learning what to ignore, what to
pursue, and what to put down before it becomes a sunk cost.

Hold opinions loosely. Trust your gut after the third or fourth time you
were right about something nobody else saw. Refactor the code that's making
your week heavier; ignore the code that's not.

Ship the small thing. Tell the team. Listen to the room. Adjust. Repeat.
