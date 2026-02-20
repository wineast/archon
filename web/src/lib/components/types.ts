export interface ComponentDefinition {
  id: string;
  key: string;
  name: string;
  description: string;
  toolInputSchemaId: string | null;
  toolOutputSchemaId: string | null;
  componentSource: string;
}
