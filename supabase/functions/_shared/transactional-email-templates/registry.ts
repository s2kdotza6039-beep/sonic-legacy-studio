/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as adhocMessage } from './adhoc-message.tsx'
import { template as securityDailyReport } from './security-daily-report.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'adhoc-message': adhocMessage,
  'security-daily-report': securityDailyReport,
}
