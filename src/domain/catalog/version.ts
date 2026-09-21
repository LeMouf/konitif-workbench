export interface WorkbenchCatalogElementVersion {
  value: string;
  authority: {
    kind: 'package-manifest';
    packageName: string;
  };
}
