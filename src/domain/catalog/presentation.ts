export interface WorkbenchCatalogMedia {
  src: string;
  alt: string;
  mediaType: 'image/svg+xml' | 'image/png' | 'image/webp' | 'image/jpeg';
}

export interface WorkbenchCatalogDependency {
  packageName: string;
  versionRange: string;
  scope: 'runtime' | 'peer' | 'optional' | 'development';
  family: 'konitif' | 'product' | 'external';
  sourceUrl?: string;
}

export interface WorkbenchCatalogDiagramNode {
  id: string;
  label: string;
  description: string;
  tone?: 'projection' | 'runtime' | 'observation';
}

export interface WorkbenchCatalogDiagramEdge {
  from: string;
  to: string;
}

export interface WorkbenchCatalogDiagram {
  id: string;
  title: string;
  kind: string;
  summary: string;
  sourcePackage: string;
  nodes: readonly WorkbenchCatalogDiagramNode[];
  edges: readonly WorkbenchCatalogDiagramEdge[];
  caption: string;
}

export interface WorkbenchCatalogPresentation {
  summary?: string;
  icon?: WorkbenchCatalogMedia;
  illustration?: WorkbenchCatalogMedia;
  metadata?: Readonly<Record<string, string>>;
  detailedDescription?: string;
  dependencies?: readonly WorkbenchCatalogDependency[];
  diagram?: WorkbenchCatalogDiagram;
}
