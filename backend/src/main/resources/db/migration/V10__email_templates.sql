-- Communications rebuild: rich email templates (lifted 1:1 from the
-- teammate-voices component) + survey-trigger assignments. The old
-- localStorage-based template builder is retired.

create table email_template (
    id          uuid primary key default gen_random_uuid(),
    name        text not null,
    description text,
    category    text not null default 'CUSTOM',   -- INVITATION | REMINDER | THANK_YOU | WELCOME | COMPLETION | ANNOUNCEMENT | CUSTOM
    subject     text not null,
    from_name   text,
    body_html   text not null,
    status      text not null default 'DRAFT',    -- DRAFT | ACTIVE | ARCHIVED
    is_default  boolean not null default false,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create table email_template_assignment (
    id              uuid primary key default gen_random_uuid(),
    template_id     uuid not null references email_template(id) on delete cascade,
    survey_id       uuid references survey(id) on delete cascade,
    trigger_type    text not null,                -- INITIAL_INVITE | REMINDER_1..3 | THANK_YOU | ...
    send_delay_days int not null default 0,
    is_active       boolean not null default true,
    created_at      timestamptz not null default now()
);
create index idx_eta_template on email_template_assignment(template_id);

-- Starter templates so the library isn't empty on first open
insert into email_template (id, name, description, category, subject, from_name, body_html, status) values
 ('98000000-0000-0000-0000-000000000001','Survey Invitation','Initial invite to complete a candidate-experience survey','INVITATION',
  'You are invited to complete: {{survey_title}}','Bank of America Careers',
  '<h2>Hello {{participant_name}},</h2><p>We would love your feedback. Please complete <strong>{{survey_title}}</strong> by {{survey_due_date}}.</p><p><a class="email-cta-button" href="{{survey_link}}" target="_blank">Start the survey</a></p><p>Thank you!<br>{{sender_name}}</p>','ACTIVE'),
 ('98000000-0000-0000-0000-000000000002','Gentle Reminder','First reminder for non-respondents','REMINDER',
  'Reminder: {{survey_title}} closes soon','Bank of America Careers',
  '<p>Hi {{participant_name}},</p><p>Just a friendly nudge — <strong>{{survey_title}}</strong> is still waiting for you. It closes on {{survey_due_date}}.</p><p><a class="email-cta-button" href="{{survey_link}}" target="_blank">Complete it now</a></p>','DRAFT');
