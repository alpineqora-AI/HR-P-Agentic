-- The assistant was renamed Olivia -> Aria long ago (V4 fixed the sender enum),
-- but seed TEXT still said Olivia: chat transcripts where the assistant
-- introduces itself, and 'Olivia (AI)' as an interviewer. Fix the assistant
-- references only — people genuinely named Olivia (e.g. the candidate
-- Olivia Brown) keep their names.

UPDATE message   SET body = replace(body, 'Olivia', 'Aria') WHERE body LIKE '%Olivia%';
UPDATE interview SET interviewers = replace(interviewers, 'Olivia (AI)', 'Aria (AI)')
    WHERE interviewers LIKE '%Olivia (AI)%';
