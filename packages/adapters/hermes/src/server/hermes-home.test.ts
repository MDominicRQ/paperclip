/**
 * Strict-TDD coverage for the hermes-home resolver.
 *
 * The resolver is the single source of truth for Hermes config/skills/env
 * discovery. It MUST honor the precedence HERMES_HOME > HOME > USERPROFILE
 * > os.homedir(), never append .hermes twice, and path.resolve() the
 * result so callers always see an absolute path.
 */

import path from "node:path";
import { describe, expect, test } from "vitest";

import {
  resolveHermesHome,
  resolveHermesHomeSync,
} from "./hermes-home.js";

describe("resolveHermesHomeSync precedence", () => {
  test("HERMES_HOME wins over HOME and homedir (no double append)", () => {
    expect(
      resolveHermesHomeSync({
        env: { HERMES_HOME: "/paperclip/.hermes", HOME: "/paperclip" },
        homedir: () => "/nope",
      }),
    ).toBe("/paperclip/.hermes");
  });

  test("falls back to HOME + /.hermes when HERMES_HOME is unset", () => {
    expect(
      resolveHermesHomeSync({
        env: { HOME: "/paperclip" },
        homedir: () => "/nope",
      }),
    ).toBe(pathFor("/paperclip/.hermes"));
  });

  test("falls back to USERPROFILE + /.hermes when HOME is unset (Windows)", () => {
    // Use a path that is meaningful on both POSIX (treated as a relative
    // filename) and Windows (used as the literal USERPROFILE value). The
    // contract is: USERPROFILE is the base, .hermes is appended exactly
    // once, and the result is path.resolve()'d.
    const userProfile = path.sep === "\\" ? "C:\\Users\\foo" : "C:/Users/foo";
    const expected = pathFor(`${userProfile}/.hermes`);
    expect(
      resolveHermesHomeSync({
        env: { USERPROFILE: userProfile },
        homedir: () => "/nope",
      }),
    ).toBe(expected);
  });

  test("falls back to os.homedir() + /.hermes when nothing else is set", () => {
    expect(
      resolveHermesHomeSync({
        env: {},
        homedir: () => "/home/operator",
      }),
    ).toBe(pathFor("/home/operator/.hermes"));
  });

  test("normalizes a relative HERMES_HOME through path.resolve() and does not append .hermes", () => {
    expect(
      resolveHermesHomeSync({
        env: { HERMES_HOME: "relative/path" },
        homedir: () => "/nope",
      }),
    ).toBe(pathFor("relative/path"));
  });

  test("treats empty HERMES_HOME as unset (falls through to HOME)", () => {
    expect(
      resolveHermesHomeSync({
        env: { HERMES_HOME: "", HOME: "/paperclip" },
        homedir: () => "/nope",
      }),
    ).toBe(pathFor("/paperclip/.hermes"));
  });

  test("HERMES_HOME precedence reads from process.env when no env override is passed", () => {
    const original = process.env.HERMES_HOME;
    process.env.HERMES_HOME = "/tmp/test-hermes-home";
    try {
      expect(resolveHermesHomeSync()).toBe(pathFor("/tmp/test-hermes-home"));
    } finally {
      if (original === undefined) delete process.env.HERMES_HOME;
      else process.env.HERMES_HOME = original;
    }
  });
});

describe("resolveHermesHome async wrapper", () => {
  test("resolves to the same value as the sync variant", async () => {
    const syncResult = resolveHermesHomeSync({
      env: { HERMES_HOME: "/paperclip/.hermes" },
      homedir: () => "/nope",
    });
    const asyncResult = await resolveHermesHome({
      env: { HERMES_HOME: "/paperclip/.hermes" },
      homedir: () => "/nope",
    });
    expect(asyncResult).toBe(syncResult);
  });
});

/**
 * Normalize through path.resolve so Windows test paths match the resolver's
 * platform-aware output. On POSIX this is a no-op; on Windows it strips
 * forward-slash artifacts and produces a clean absolute path.
 */
function pathFor(input: string): string {
  return path.resolve(input);
}