import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class AddCategoriesTable20260628000000 implements MigrationInterface {
  name = 'AddCategoriesTable20260628000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'categories',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'name', type: 'varchar', length: '80', isUnique: true },
          { name: 'slug', type: 'varchar', length: '120', isUnique: true },
          {
            name: 'icon',
            type: 'enum',
            enum: ['heart', 'fire', 'star', 'lightning', 'bookmark', 'smile', 'anger', 'drop', 'music', 'game', 'work', 'school', 'travel', 'food', 'fitness', 'tech', 'other'],
            default: "'other'",
          },
          { name: 'color', type: 'varchar', length: '7', default: "'#6366f1'" },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'is_active', type: 'boolean', default: true },
          { name: 'confession_count', type: 'int', default: 0 },
          { name: 'created_at', type: 'timestamp', default: 'now()' },
          { name: 'updated_at', type: 'timestamp', default: 'now()' },
        ],
      }),
    );

    await queryRunner.createIndices('categories', [
      new TableIndex({ name: 'IDX_CATEGORIES_SLUG', columnNames: ['slug'], isUnique: true }),
      new TableIndex({ name: 'IDX_CATEGORIES_NAME', columnNames: ['name'], isUnique: true }),
    ]);

    await queryRunner.query(`ALTER TABLE anonymous_confessions ADD COLUMN IF NOT EXISTS category_id uuid CONSTRAINT fk_category REFERENCES categories(id)`);
    await queryRunner.query(`ALTER TABLE confession_drafts ADD COLUMN IF NOT EXISTS category_id uuid CONSTRAINT fk_category_draft REFERENCES categories(id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS IDX_CONFESSIONS_CATEGORY_ID ON anonymous_confessions(category_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS IDX_DRAFTS_CATEGORY_ID ON confession_drafts(category_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_DRAFTS_CATEGORY_ID`);
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_CONFESSIONS_CATEGORY_ID`);
    await queryRunner.query(`ALTER TABLE anonymous_confessions DROP COLUMN IF EXISTS category_id`);
    await queryRunner.query(`ALTER TABLE confession_drafts DROP COLUMN IF EXISTS category_id`);
    await queryRunner.dropTable('categories');
  }
}
