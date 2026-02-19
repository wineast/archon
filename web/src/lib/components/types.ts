export interface ComponentDefinition {
  id: string;
  key: string;
  name: string;
  description: string;
  componentSource: string;
  inputSchemaRef: string | null;
  outputSchemaRef: string | null;
}
