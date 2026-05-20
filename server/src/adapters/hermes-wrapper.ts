import type {
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
  AdapterExecutionContext,
  AdapterExecutionResult,
} from "@paperclipai/adapter-utils";
import {
  execute as hermesExecute,
  sessionCodec as hermesSessionCodec,
  listSkills as hermesListSkills,
  syncSkills as hermesSyncSkills,
  detectModel as detectModelFromHermes,
} from "hermes-paperclip-adapter/server";
import {
  agentConfigurationDoc as hermesAgentConfigurationDoc,
  models as hermesModels,
} from "hermes-paperclip-adapter";

export async function executeHermesWrapper(
  ctx: AdapterExecutionContext,
): Promise<AdapterExecutionResult> {
  const wrappedCtx: AdapterExecutionContext = {
    ...ctx,
    onSpawn: ctx.onSpawn
      ? (meta) => ctx.onSpawn!({ pid: meta.pid, processGroupId: null, startedAt: meta.startedAt })
      : undefined,
  };
  return hermesExecute(wrappedCtx);
}

export async function testEnvironmentHermesWrapper(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const { testEnvironment } = await import("./hermes-test.js");
  return testEnvironment({
    ...ctx,
    adapterType: "hermes_local",
  });
}

export {
  hermesSessionCodec,
  hermesListSkills,
  hermesSyncSkills,
  detectModelFromHermes,
  hermesAgentConfigurationDoc,
  hermesModels,
};