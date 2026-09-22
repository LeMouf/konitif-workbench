import { isKonitifCapabilityVersionCompatible } from '@konitif/core';
import type { ShellWidgetCatalogPort } from '../../domain/shell/model';
import type { ToolCatalogPort, ToolDefinition } from '../../domain/tool/model';
import type { WorkspacePresetArtifact } from './presetArtifacts';

export type WorkspacePresetCatalogAdmissionIssue =
  | {
      code: 'workspace-preset-admission.missing-tool';
      subjectId: string;
      message: string;
    }
  | {
      code: 'workspace-preset-admission.missing-widget';
      subjectId: string;
      message: string;
    }
  | {
      code: 'workspace-preset-admission.missing-capability' | 'workspace-preset-admission.incompatible-capability';
      subjectId: string;
      consumerToolId: string;
      versionRange: string;
      availableVersions: string[];
      message: string;
    };

export type WorkspacePresetCatalogAdmission =
  | { ok: true; issues: [] }
  | { ok: false; issues: WorkspacePresetCatalogAdmissionIssue[] };

export function evaluateWorkspacePresetCatalogAdmission(input: {
  source: WorkspacePresetArtifact;
  toolCatalog: ToolCatalogPort;
  shellWidgetCatalog: ShellWidgetCatalogPort;
  availableToolDefinitions?: readonly ToolDefinition[];
}): WorkspacePresetCatalogAdmission {
  const issues: WorkspacePresetCatalogAdmissionIssue[] = [];
  const requiredToolIds = unique(Object.values(input.source.workspaceSession.workspace.toolInstances).map(instance => instance.toolId));
  const requiredWidgetIds = unique(Object.values(input.source.shellState.regions).flatMap(region => region.widgetIds));
  const requiredDefinitions = requiredToolIds.flatMap(toolId => {
    const definition = input.toolCatalog.getDefinition(toolId);
    if (!definition) {
      issues.push({
        code: 'workspace-preset-admission.missing-tool',
        subjectId: toolId,
        message: `Required tool "${toolId}" is not available in the admitted catalog.`
      });
      return [];
    }
    return [definition];
  });

  for (const widgetId of requiredWidgetIds) {
    if (!input.shellWidgetCatalog.getDefinition(widgetId)) {
      issues.push({
        code: 'workspace-preset-admission.missing-widget',
        subjectId: widgetId,
        message: `Required widget "${widgetId}" is not available in the admitted catalog.`
      });
    }
  }

  const availableDefinitions = input.availableToolDefinitions ?? requiredDefinitions;
  for (const consumer of requiredDefinitions) {
    for (const requirement of consumer.capabilities?.consumes ?? []) {
      if (requirement.mode !== 'required') continue;
      const providers = availableDefinitions.flatMap(definition =>
        (definition.capabilities?.provides ?? [])
          .filter(capability => capability.id === requirement.id)
          .map(capability => ({ definition, capability }))
      );
      if (providers.some(provider => isKonitifCapabilityVersionCompatible(provider.capability.version, requirement.versionRange))) {
        continue;
      }
      const availableVersions = unique(providers.map(provider => provider.capability.version));
      const incompatible = availableVersions.length > 0;
      issues.push({
        code: incompatible
          ? 'workspace-preset-admission.incompatible-capability'
          : 'workspace-preset-admission.missing-capability',
        subjectId: requirement.id,
        consumerToolId: consumer.id,
        versionRange: requirement.versionRange,
        availableVersions,
        message: incompatible
          ? `Tool "${consumer.id}" requires ${requirement.id}@${requirement.versionRange}; available versions are ${availableVersions.join(', ')}.`
          : `Tool "${consumer.id}" requires ${requirement.id}@${requirement.versionRange}; no provider is available.`
      });
    }
  }

  return issues.length === 0 ? { ok: true, issues: [] } : { ok: false, issues };
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}
