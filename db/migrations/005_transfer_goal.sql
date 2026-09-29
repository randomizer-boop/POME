-- 005 · A transfer knows which goal it tops up
-- Why: goals and the savings % are different things. Only a top-up made to a goal pays that goal;
-- any other transfer to Savings counts toward the savings %. Deleting a top-up also takes it back
-- out of the goal.
-- Run in Neon → SQL Editor (same branch + database as the Data API). Safe to run again.

alter table transfers add column if not exists goal_id uuid references goals(id) on delete set null;

-- older top-ups were saved with the goal's name as the note — link them to their goal
update transfers x set goal_id = g.id
from goals g
where x.goal_id is null and x.to_account = 'savings' and x.note = g.name and x.user_id = g.user_id;

-- IMPORTANT: afterwards open Neon → Data API → "Refresh schema cache".

-- Check: must return 1 row
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'transfers' and column_name = 'goal_id';
