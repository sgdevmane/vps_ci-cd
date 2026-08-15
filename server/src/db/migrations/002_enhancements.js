export async function up(knex) {
  // Add new columns to services table
  const hasHealthcheck = await knex.schema.hasColumn('services', 'healthcheck_url');
  if (!hasHealthcheck) {
    await knex.schema.table('services', (t) => {
      t.text('healthcheck_url');
      t.boolean('auto_rollback').notNullable().defaultTo(0);
      t.boolean('maintenance_mode').notNullable().defaultTo(0);
    });
  }

  // Create notification channels table
  const hasNotifications = await knex.schema.hasTable('notification_channels');
  if (!hasNotifications) {
    await knex.schema
      .createTable('notification_channels', (t) => {
        t.increments('id');
        t.string('name').notNullable();
        t.string('provider').notNullable().defaultTo('slack'); // slack, discord, telegram, webhook, email
        t.text('webhook_url');
        t.text('config'); // JSON string for provider-specific settings (bot token, chat ID, headers)
        t.boolean('enabled').notNullable().defaultTo(1);
        t.string('created_at').notNullable();
        t.string('updated_at').notNullable();
      })
      .createTable('service_notifications', (t) => {
        t.increments('id');
        t.integer('service_id').notNullable().references('id').inTable('services').onDelete('CASCADE');
        t.integer('channel_id').notNullable().references('id').inTable('notification_channels').onDelete('CASCADE');
        t.boolean('on_start').notNullable().defaultTo(0);
        t.boolean('on_success').notNullable().defaultTo(1);
        t.boolean('on_failure').notNullable().defaultTo(1);
        t.unique(['service_id', 'channel_id']);
      })
      .createTable('service_env', (t) => {
        t.increments('id');
        t.integer('service_id').notNullable().references('id').inTable('services').onDelete('CASCADE');
        t.string('key').notNullable();
        t.text('value_enc').notNullable(); // AES-256-GCM encrypted value
        t.boolean('is_secret').notNullable().defaultTo(1);
        t.string('created_at').notNullable();
        t.string('updated_at').notNullable();
        t.unique(['service_id', 'key']);
        t.index('service_id');
      })
      .createTable('audit_logs', (t) => {
        t.increments('id');
        t.integer('user_id');
        t.string('action').notNullable();
        t.string('target_type');
        t.string('target_id');
        t.text('details');
        t.string('ip');
        t.string('created_at').notNullable();
        t.index(['target_type', 'target_id']);
        t.index('created_at');
      });
  }
}

export async function down(knex) {
  await knex.schema
    .dropTableIfExists('audit_logs')
    .dropTableIfExists('service_env')
    .dropTableIfExists('service_notifications')
    .dropTableIfExists('notification_channels');

  const hasHealthcheck = await knex.schema.hasColumn('services', 'healthcheck_url');
  if (hasHealthcheck) {
    await knex.schema.table('services', (t) => {
      t.dropColumn('maintenance_mode');
      t.dropColumn('auto_rollback');
      t.dropColumn('healthcheck_url');
    });
  }
}
