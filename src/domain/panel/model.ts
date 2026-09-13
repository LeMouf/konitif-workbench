export interface PanelNode {
  id: string;
  /**
   * Panels own their display title so layout snapshots stay serializable even when a tool definition changes later.
   */
  title: string;
  toolInstanceId: string | null;
  showFullscreenToggle?: boolean;
}
