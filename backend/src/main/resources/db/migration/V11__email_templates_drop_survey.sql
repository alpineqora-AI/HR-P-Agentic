-- Communications is a recruiting tool, not a survey tool: strip all survey
-- references. Drops the survey-bound assignment table and rewrites the two
-- seeded templates to event/candidate merge fields.

drop table if exists email_template_assignment;

update email_template
set name        = 'Event Invitation',
    description = 'Initial invite to a campus recruiting event',
    subject     = 'You are invited: {{event_name}}',
    body_html   = '<h2>Hello {{participant_name}},</h2><p>We would love to see you at <strong>{{event_name}}</strong> on {{event_date}} in {{event_location}}.</p><p><a class="email-cta-button" href="{{register_link}}" target="_blank">Register now</a></p><p>Thank you!<br>{{sender_name}}</p>'
where id = '98000000-0000-0000-0000-000000000001';

update email_template
set subject   = 'Reminder: {{event_name}} is coming up',
    body_html = '<p>Hi {{participant_name}},</p><p>Just a friendly nudge — <strong>{{event_name}}</strong> is on {{event_date}}. We hope to see you there.</p><p><a class="email-cta-button" href="{{register_link}}" target="_blank">Register now</a></p>'
where id = '98000000-0000-0000-0000-000000000002';
