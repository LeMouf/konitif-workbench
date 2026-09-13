import type { LaunchPreflightSummary, LaunchProfile, LaunchTarget } from '../launch/model';

export type RuntimePlanStepKind =
  | 'mount-store'
  | 'start-service'
  | 'initialize-manager'
  | 'register-tool'
  | 'activate-watcher'
  | 'launch-worker'
  | 'observability-hook'
  | 'teardown-hook'
  | 'rollback-hook';

export type RuntimePlanStepStatus = 'planned' | 'skipped' | 'blocked';

export interface RuntimePlanStep {
  id: string;
  kind: RuntimePlanStepKind;
  label: string;
  status: RuntimePlanStepStatus;
  critical: boolean;
  reason: string | null;
}

export interface RuntimePlanWarning {
  id: string;
  message: string;
}

export interface RuntimePlan {
  id: string;
  target: LaunchTarget;
  profile: LaunchProfile;
  createdAt: string;
  dryRun: boolean;
  canExecute: boolean;
  steps: RuntimePlanStep[];
  warnings: RuntimePlanWarning[];
  preflight: LaunchPreflightSummary | null;
}
