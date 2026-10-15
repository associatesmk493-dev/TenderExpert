/* eslint-disable @typescript-eslint/no-explicit-any */
// Runs a save and, when the database does not have a newer column yet, retries without it
// so the rest of the form still saves instead of failing completely.
export async function writeWithFallback<T extends { error: any }>(run: (payload: Record<string, any>) => PromiseLike<T>, payload: Record<string, any>) {
  const current = { ...payload };
  const skipped: string[] = [];
  for (let attempt = 0; attempt < 10; attempt++) {
    const result = await run(current);
    const column = result.error?.message?.match(/Could not find the '([^']+)' column/)?.[1];
    if (!column || !(column in current)) return { result, skipped };
    delete current[column];
    skipped.push(column);
  }
  return { result: await run(current), skipped };
}

// Same as writeWithFallback, for inserting several rows at once.
export async function writeManyWithFallback<T extends { error: any }>(run: (rows: Record<string, any>[]) => PromiseLike<T>, rows: Record<string, any>[]) {
  let current = rows.map((row) => ({ ...row }));
  const skipped: string[] = [];
  for (let attempt = 0; attempt < 12; attempt++) {
    const result = await run(current);
    const column = result.error?.message?.match(/Could not find the '([^']+)' column/)?.[1];
    if (!column || !current.some((row) => column in row)) return { result, skipped };
    current = current.map(({ [column]: _removed, ...rest }) => rest);
    skipped.push(column);
  }
  return { result: await run(current), skipped };
}

export const skippedMessage = (skipped: string[]) =>
  skipped.length ? `Not saved yet: ${skipped.join(', ')}. Run the latest database update (SQL) to enable these.` : undefined;
