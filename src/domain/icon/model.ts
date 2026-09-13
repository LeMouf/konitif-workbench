export type WorkbenchIconTone =
  | 'default'
  | 'action'
  | 'danger'
  | 'design'
  | 'product'
  | 'runtime'
  | 'template'
  | 'shared';

export interface WorkbenchIconRef {
  id: string;
  label?: string;
  tone?: WorkbenchIconTone;
  fallback?: string;
}

export type WorkbenchIconInput = string | WorkbenchIconRef;
