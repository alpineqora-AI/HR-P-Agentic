-- Form library: from purpose-keyed singletons to many named forms per kind,
-- plus reusable templates.
--   - purpose becomes the form's KIND (EVENT_INTAKE | EVENT_REGISTRATION),
--     no longer unique — admins can build many intake forms
--   - is_default marks the one form per kind that surfaces where no explicit
--     choice was made (QR registration page, legacy callers)
--   - is_template marks reusable starting points ("Save as template")
--   - events remember which intake form they were created with, and responses
--     remember exactly which form produced them

alter table form_definition drop constraint form_definition_purpose_key;
alter table form_definition add column is_template boolean not null default false;
alter table form_definition add column is_default  boolean not null default false;

-- The two seeded forms become the defaults of their kinds.
update form_definition set is_default = true;

alter table recruiting_event add column intake_form_id uuid references form_definition(id);
alter table form_response    add column form_id        uuid references form_definition(id);

create index idx_form_definition_purpose on form_definition(purpose);
