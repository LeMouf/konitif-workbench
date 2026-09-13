import type { LayoutNode } from '../layout/model';
import type { ToolInstance } from '../tool/model';
import type { DesignSystemThemeSession } from '../design-system/themeSession';

export interface WorkspaceWindow {
  id: string;
  title: string;
  root: LayoutNode;
}

export interface WorkspacePresetProvenance {
  id: string;
  version: string | null;
  status: 'exact' | 'customized';
}

export interface Workspace {
  id: string;
  version: number;
  activeWindowId: string;
  fullscreenPanelId?: string | null;
  designSystemThemeSession?: DesignSystemThemeSession | null;
  presetProvenance?: WorkspacePresetProvenance | null;
  windows: WorkspaceWindow[];
  toolInstances: Record<string, ToolInstance>;
}
