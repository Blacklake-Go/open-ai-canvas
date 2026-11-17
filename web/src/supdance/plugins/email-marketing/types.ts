export const SUPDANCE_EMAIL_MARKETING_PLUGIN_ID = "supdance-email-marketing" as const;

export interface MarketingVariable {
    key: string;
    label: string;
    default: string;
}

export interface MarketingTemplate {
    key: string;
    name: string;
    category: string;
    description: string;
    defaultSubject: string;
    defaultHtml: string;
    subject: string;
    html: string;
    supportedVariables: MarketingVariable[];
    sampleVariables: Record<string, string>;
    updatedAt: string;
    updatedBy?: string;
}

export interface EmailMarketingOverview {
    pluginId: string;
    available: boolean;
    templates: Record<string, MarketingTemplate>;
    smtpConfigured: boolean;
    rateLimitPerHour: number;
    updatedAt: string;
}

export interface EmailMarketingTestRequest {
    to: string;
    templateKey: string;
    subject?: string;
    html?: string;
    variables?: Record<string, string>;
}

export interface EmailMarketingTestResult {
    success: boolean;
    message: string;
    recipient: string;
    latencyMs: number;
}
