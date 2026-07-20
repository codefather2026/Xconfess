import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddModerationEvidenceFields20260720000001 implements MigrationInterface {
  name = 'AddModerationEvidenceFields20260720000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('moderation_logs', [
      new TableColumn({
        name: 'confidence',
        type: 'decimal',
        precision: 5,
        scale: 4,
        default: 0,
      }),
      new TableColumn({
        name: 'reason_codes',
        type: 'text',
        isNullable: true,
      }),
      new TableColumn({
        name: 'model_name',
        type: 'varchar',
        isNullable: true,
      }),
      new TableColumn({
        name: 'model_version',
        type: 'varchar',
        isNullable: true,
      }),
      new TableColumn({
        name: 'safe_excerpt',
        type: 'text',
        isNullable: true,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('moderation_logs', 'safe_excerpt');
    await queryRunner.dropColumn('moderation_logs', 'model_version');
    await queryRunner.dropColumn('moderation_logs', 'model_name');
    await queryRunner.dropColumn('moderation_logs', 'reason_codes');
    await queryRunner.dropColumn('moderation_logs', 'confidence');
  }
}
