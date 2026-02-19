export interface ComponentDefinition {
  id: string;
  key: string;
  name: string;
  description: string;
  componentSource: string;
  inputSchemaId: string | null;
  outputSchemaId: string | null;
}
