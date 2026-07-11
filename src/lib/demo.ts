/** A small, realistic Claude Code-style session used for the demo button. */

interface Block {
  [key: string]: unknown;
}

let t = Date.parse('2026-07-11T09:14:03.000Z');
const lines: string[] = [];

function push(role: 'user' | 'assistant', content: Block[] | string, extra: Block = {}, advanceMs = 900): void {
  lines.push(
    JSON.stringify({
      type: role,
      timestamp: new Date(t).toISOString(),
      message: { role, content, ...extra },
    }),
  );
  t += advanceMs;
}

const usage = (input: number, output: number, cacheRead = 0) => ({
  model: 'claude-sonnet-5',
  usage: { input_tokens: input, output_tokens: output, cache_read_input_tokens: cacheRead },
});

push('user', [{ type: 'text', text: 'The checkout test suite started failing after the tax refactor — can you find and fix the root cause?' }]);
push('assistant', [{ type: 'thinking', thinking: 'A tax refactor breaking checkout tests suggests rounding or rate-lookup changes. I should run the suite first to see the actual failures before touching anything.' }], usage(2140, 188, 1800), 4200);
push('assistant', [{ type: 'tool_use', id: 'tu-1', name: 'Bash', input: { command: 'npm test -- checkout', description: 'Run checkout test suite' } }], usage(2350, 96), 6100);
push('user', [{ type: 'tool_result', tool_use_id: 'tu-1', is_error: true, content: 'FAIL tests/checkout.test.ts — 3 failed\n  ✕ applies reduced VAT for books (expected 4.19, received 4.2)\n  ✕ splits tax across line items\n  ✕ rounds totals per invoice, not per item' }], {}, 400);
push('assistant', [{ type: 'thinking', thinking: 'All three failures are rounding-related: expected 4.19 vs 4.2 means the refactor rounds per item instead of per invoice. Let me read the tax module.' }], usage(2610, 154), 2500);
push('assistant', [{ type: 'tool_use', id: 'tu-2', name: 'Read', input: { file_path: 'src/tax/calculate.ts' } }], usage(2700, 71), 1400);
push('user', [{ type: 'tool_result', tool_use_id: 'tu-2', content: '…\nexport function lineItemTax(item: LineItem, rate: Rate): number {\n  return round2(item.net * rate.value); // ← rounds every line\n}\n…' }], {}, 300);
push('assistant', [{ type: 'tool_use', id: 'tu-3', name: 'Grep', input: { pattern: 'round2\\(', glob: 'src/tax/**' } }], usage(2880, 84), 900);
push('user', [{ type: 'tool_result', tool_use_id: 'tu-3', content: 'src/tax/calculate.ts:12\nsrc/tax/calculate.ts:31\nsrc/tax/invoice.ts:47' }], {}, 250);
push('assistant', [{ type: 'text', text: 'Found it — the refactor moved rounding into lineItemTax(), so every line item rounds independently and the per-invoice totals drift by a cent. Fixing it to accumulate unrounded and round once per invoice.' }], usage(3050, 214), 2100);
push('assistant', [{ type: 'tool_use', id: 'tu-4', name: 'Edit', input: { file_path: 'src/tax/calculate.ts', old_string: 'return round2(item.net * rate.value);', new_string: 'return item.net * rate.value;' } }], usage(3220, 138), 700);
push('user', [{ type: 'tool_result', tool_use_id: 'tu-4', content: 'File updated.' }], {}, 250);
push('assistant', [{ type: 'tool_use', id: 'tu-5', name: 'Edit', input: { file_path: 'src/tax/invoice.ts', old_string: 'const tax = items.reduce((s, i) => s + lineItemTax(i, rate), 0);', new_string: 'const tax = round2(items.reduce((s, i) => s + lineItemTax(i, rate), 0));' } }], usage(3390, 152), 800);
push('user', [{ type: 'tool_result', tool_use_id: 'tu-5', content: 'File updated.' }], {}, 250);
push('assistant', [{ type: 'tool_use', id: 'tu-6', name: 'Bash', input: { command: 'npm test -- checkout', description: 'Re-run checkout suite' } }], usage(3560, 88), 7400);
push('user', [{ type: 'tool_result', tool_use_id: 'tu-6', content: 'PASS tests/checkout.test.ts — 14 passed' }], {}, 400);
push('assistant', [{ type: 'tool_use', id: 'tu-7', name: 'Bash', input: { command: 'npm test', description: 'Full suite to check for regressions' } }], usage(3720, 90), 14200);
push('user', [{ type: 'tool_result', tool_use_id: 'tu-7', content: 'PASS — 212 passed, 0 failed' }], {}, 400);
push('assistant', [{ type: 'text', text: 'Fixed. Root cause: the tax refactor rounded per line item, so invoice totals drifted by a cent whenever reduced-VAT items appeared. Rounding now happens once per invoice (round2 moved from lineItemTax to invoice totals). Checkout suite and the full suite (212 tests) pass.' }], usage(3900, 342), 1900);
push('user', [{ type: 'text', text: 'perfect, thanks — commit it please' }], {}, 1100);
push('assistant', [{ type: 'tool_use', id: 'tu-8', name: 'Bash', input: { command: "git commit -am 'Round VAT once per invoice, not per line item'", description: 'Commit the fix' } }], usage(4080, 121), 1200);
push('user', [{ type: 'tool_result', tool_use_id: 'tu-8', content: '[main 3f2c1aa] Round VAT once per invoice, not per line item' }], {}, 300);
push('assistant', [{ type: 'text', text: 'Committed as 3f2c1aa.' }], usage(4200, 58), 600);

export const demoTrace: string = lines.join('\n');
