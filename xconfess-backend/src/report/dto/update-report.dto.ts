import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ReportStatus } from '../../admin/entities/report.entity';

export class UpdateReportStatusDto {
  @IsEnum([ReportStatus.RESOLVED, ReportStatus.REJECTED], {
    message: 'status must be "resolved" or "rejected"',
  })
  status: ReportStatus.RESOLVED | ReportStatus.REJECTED;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  resolutionReason?: string;
}
