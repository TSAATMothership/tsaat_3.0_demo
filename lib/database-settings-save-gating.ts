export interface DatabaseSettingsSaveGateInput {
  sslEnabled: boolean;
  hasConnectionSuccess: boolean;
  hasSslSuccess: boolean;
  hasSchemaSuccess: boolean;
  isSaving: boolean;
  isTestingConnection: boolean;
  isTestingSsl: boolean;
  isTestingSchema: boolean;
}

export function canSaveDatabaseSettings(input: DatabaseSettingsSaveGateInput): boolean {
  if (!input.hasConnectionSuccess) {
    return false;
  }
  if (!input.hasSchemaSuccess) {
    return false;
  }
  if (input.sslEnabled && !input.hasSslSuccess) {
    return false;
  }
  if (input.isSaving || input.isTestingConnection || input.isTestingSsl || input.isTestingSchema) {
    return false;
  }

  return true;
}
