import { useEffect, useRef } from 'react';
type Tool = {
  name: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean };
  execute: (input: unknown) => unknown;
};
type ModelDocument = Document & {
  modelContext?: { registerTool: (tool: Tool, options: { signal: AbortSignal }) => void | Promise<void> };
};
export function useGameTools(
  state: object,
  join: (name: string, index: number) => Promise<void>,
  tap: () => Promise<void>,
  start: () => Promise<void>,
  useItem: () => Promise<void>,
  switchLane: (direction: number) => Promise<void>,
  steer: (amount: number) => Promise<void>,
) {
  const current = useRef({ state, join, tap, start, useItem, switchLane, steer });
  current.current = { state, join, tap, start, useItem, switchLane, steer };
  useEffect(() => {
    const context = (document as ModelDocument).modelContext;
    if (!context) return;
    const lifecycle = new AbortController();
    const tools: Tool[] = [
      {
        name: 'steer',
        description:
          'Push sideways across the river: -1 (left) to 1 (right), 0 to stop. The duck slides fluidly while the push is held.',
        inputSchema: {
          type: 'object',
          properties: { amount: { type: 'number', minimum: -1, maximum: 1 } },
          required: ['amount'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false },
        execute: async (input) => {
          const a = (input as { amount: number })?.amount;
          if (typeof a !== 'number' || a < -1 || a > 1) throw Error('amount must be between -1 and 1.');
          await current.current.steer(a);
          return { steering: a };
        },
      },
      {
        name: 'switch_lane',
        description: 'Hop one lane left (-1) or right (+1) to reach a floating toy, ride rapids, or dodge rocks and logs.',
        inputSchema: {
          type: 'object',
          properties: { direction: { type: 'integer', enum: [-1, 1] } },
          required: ['direction'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false },
        execute: async (input) => {
          const d = (input as { direction: number })?.direction;
          if (d !== -1 && d !== 1) throw Error('direction must be -1 or 1.');
          await current.current.switchLane(d);
          return { switched: true };
        },
      },
      {
        name: 'use_item',
        description: 'Use the item currently held by your duck during a race.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: false },
        execute: async () => {
          await current.current.useItem();
          return { used: true };
        },
      },
      {
        name: 'start_race',
        description:
          'Start the room countdown, or play again from the results. Only the room host can start; everyone else waits for the host.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: false },
        execute: async () => {
          await current.current.start();
          return { started: true };
        },
      },
      {
        name: 'read_race',
        description: 'Read the current shared river phase and server standings.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true },
        execute: () => current.current.state,
      },
      {
        name: 'join_race',
        description: 'Choose a duck and join the shared river, or spectate until the next race.',
        inputSchema: {
          type: 'object',
          properties: { name: { type: 'string', maxLength: 14 }, duckIndex: { type: 'integer', minimum: 0, maximum: 9 } },
          required: ['name', 'duckIndex'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false },
        execute: async (input) => {
          const p = input as { name: string; duckIndex: number };
          if (
            !p ||
            typeof p.name !== 'string' ||
            p.name.length > 14 ||
            !Number.isInteger(p.duckIndex) ||
            p.duckIndex < 0 ||
            p.duckIndex > 9
          )
            throw Error('Use a name of at most 14 characters and a duck index from 0 to 9.');
          await current.current.join(p.name, p.duckIndex);
          return { joined: true };
        },
      },
      {
        name: 'tap_duck',
        description: 'Send one paddle tap to the authoritative river server. Only active racers can move.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: false },
        execute: async () => {
          await current.current.tap();
          return { tapSent: true };
        },
      },
    ];
    for (const tool of tools)
      try {
        void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => {});
      } catch {}
    return () => lifecycle.abort();
  }, []);
}
