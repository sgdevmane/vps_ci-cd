export async function up(knex) {
  await knex.schema
    .createTable('users', (t) => {
      t.increments('id');
      t.string('username').notNullable().unique();
      t.string('password_hash').notNullable();
      t.text('security_question');
      t.text('security_answer_hash');
      t.boolean('must_change_password').notNullable().defaultTo(1);
      t.string('created_at').notNullable();
      t.string('updated_at').notNullable();
    })
    .createTable('sessions', (t) => {
      t.string('token').primary();
      t.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      t.string('created_at').notNullable();
      t.string('expires_at').notNullable();
      t.index('user_id');
    })
    .createTable('services', (t) => {
      t.increments('id');
      t.string('name').notNullable();
      t.string('provider').notNullable().defaultTo('github');
      t.text('repo_url').notNullable();
      t.text('folder_path').notNullable();
      t.string('branch_mode').notNullable().defaultTo('webhook');
      t.string('fixed_branch');
      t.text('allowed_branches');
      t.string('sync_mode').notNullable().defaultTo('pull');
      t.boolean('clone_if_empty').notNullable().defaultTo(1);
      t.text('secret');
      t.string('generic_token_header').defaultTo('X-Webhook-Token');
      t.string('hook_token').notNullable().unique();
      t.boolean('enabled').notNullable().defaultTo(1);
      t.string('last_sync_at');
      t.string('last_status');
      t.string('created_at').notNullable();
      t.string('updated_at').notNullable();
    })
    .createTable('commands', (t) => {
      t.increments('id');
      t.integer('service_id').notNullable().references('id').inTable('services').onDelete('CASCADE');
      t.integer('position').notNullable().defaultTo(0);
      t.text('command').notNullable();
      t.string('branch_filter');
      t.boolean('continue_on_error').notNullable().defaultTo(0);
      t.index('service_id');
    })
    .createTable('triggers', (t) => {
      t.increments('id');
      t.integer('service_id').notNullable().references('id').inTable('services').onDelete('CASCADE');
      t.string('source').notNullable().defaultTo('webhook');
      t.string('status').notNullable().defaultTo('queued');
      t.string('event');
      t.string('branch');
      t.string('sha');
      t.boolean('signature_ok');
      t.string('ip');
      t.string('created_at').notNullable();
      t.string('started_at');
      t.string('finished_at');
      t.integer('duration_ms');
      t.text('log').defaultTo('');
      t.index(['service_id', 'id']);
    })
    .createTable('settings', (t) => {
      t.string('key').primary();
      t.text('value');
    });
}

export async function down(knex) {
  await knex.schema
    .dropTableIfExists('settings')
    .dropTableIfExists('triggers')
    .dropTableIfExists('commands')
    .dropTableIfExists('services')
    .dropTableIfExists('sessions')
    .dropTableIfExists('users');
}
