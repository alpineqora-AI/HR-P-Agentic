-- Replace the survey-derived seed templates with recruiting-native starters.
-- The library should ship email templates about the hiring journey, not surveys.

delete from email_template
where id in (
    '98000000-0000-0000-0000-000000000001',
    '98000000-0000-0000-0000-000000000002'
);

insert into email_template (id, name, description, category, subject, from_name, body_html, status) values
 ('98000000-0000-0000-0000-000000000010','Application Received','Confirmation sent when a candidate applies','WELCOME',
  'We received your application, {{participant_name}}','Bank of America Careers',
  '<h2>Thanks for applying, {{participant_name}}!</h2><p>We have received your application and our team is reviewing it. We will be in touch with next steps soon.</p><p>Warm regards,<br>{{sender_name}}</p>','ACTIVE'),

 ('98000000-0000-0000-0000-000000000011','Interview Invitation','Invite a candidate to schedule or attend an interview','INVITATION',
  'You are invited to interview with Bank of America','Bank of America Careers',
  '<h2>Hi {{participant_name}},</h2><p>Great news — we would like to move forward and invite you to interview. Pick a time that works for you and we will take care of the rest.</p><p><a class="email-cta-button" href="{{register_link}}" target="_blank">Schedule your interview</a></p><p>Looking forward to speaking with you,<br>{{sender_name}}</p>','ACTIVE'),

 ('98000000-0000-0000-0000-000000000012','Campus Event Invitation','Invite students to a campus recruiting event','INVITATION',
  'You are invited: {{event_name}}','Bank of America Careers',
  '<h2>Hello {{participant_name}},</h2><p>We would love to see you at <strong>{{event_name}}</strong> on {{event_date}} in {{event_location}}.</p><p><a class="email-cta-button" href="{{register_link}}" target="_blank">Register now</a></p><p>Hope to see you there,<br>{{sender_name}}</p>','DRAFT'),

 ('98000000-0000-0000-0000-000000000013','Offer Letter','Extend an offer to a selected candidate','COMPLETION',
  'Your offer from Bank of America','Bank of America Careers',
  '<h2>Congratulations, {{participant_name}}!</h2><p>We are delighted to extend you an offer to join Bank of America. Details are attached — please review and let us know if you have any questions.</p><p>Welcome aboard,<br>{{sender_name}}</p>','DRAFT');
