import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Payload for POST /admin/reports/:id/action.
 *
 * Used by `ReportsService.actionReport()`.  The `action` field drives
 * which status transition is applied; `note` is stored as resolutionNotes.
 */
export class ResolveReportDto {
  /**
   * The moderation decision.
   *
   * @IsIn validates against an explicit allowlist and produces a clear error
   * message listing the accepted values.
   */
  @IsIn(['reviewing', 'resolved', 'rejected', 'dismissed', 'escalated'], {
    message:
      "action must be one of 'reviewing', 'resolved', 'rejected', 'dismissed', or 'escalated'",
  })
  action: 'reviewing' | 'resolved' | 'rejected' | 'dismissed' | 'escalated';

  /**
   * Optional moderator note stored alongside the resolution.
   * Falls back to 'Report resolved' or 'Report dismissed' in the service
   * when absent.
   */
  @IsOptional()
  @IsString({ message: 'note must be a string' })
  @MaxLength(1000, { message: 'note must be at most 1000 characters' })
  note?: string;
}
