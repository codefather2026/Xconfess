import { BadRequestException } from '@nestjs/common';
import { ReportStatus } from '../admin/entities/report.entity';

export const REPORT_STATUS_TRANSITIONS: Record<ReportStatus, ReportStatus[]> = {
  [ReportStatus.OPEN]: [
    ReportStatus.REVIEWING,
    ReportStatus.RESOLVED,
    ReportStatus.REJECTED,
    ReportStatus.ESCALATED,
  ],
  [ReportStatus.REVIEWING]: [
    ReportStatus.RESOLVED,
    ReportStatus.REJECTED,
    ReportStatus.ESCALATED,
  ],
  [ReportStatus.ESCALATED]: [
    ReportStatus.REVIEWING,
    ReportStatus.RESOLVED,
    ReportStatus.REJECTED,
  ],
  [ReportStatus.RESOLVED]: [],
  [ReportStatus.REJECTED]: [],
};

export function isValidReportStatusTransition(
  from: ReportStatus,
  to: ReportStatus,
): boolean {
  return REPORT_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertValidReportStatusTransition(
  from: ReportStatus,
  to: ReportStatus,
): void {
  if (isValidReportStatusTransition(from, to)) {
    return;
  }

  throw new BadRequestException({
    code: 'INVALID_REPORT_STATUS_TRANSITION',
    message: `Invalid report status transition from ${from} to ${to}`,
    from,
    to,
    allowedTransitions: REPORT_STATUS_TRANSITIONS[from] ?? [],
  });
}
