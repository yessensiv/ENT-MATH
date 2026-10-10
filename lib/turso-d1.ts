import type { Client, InValue, ResultSet } from '@libsql/client';

// Keep the existing SQLite schema, Drizzle mappings and atomic D1 batches.
export class TursoD1 {
  constructor(private readonly client: Client) {}
  prepare(sql: string) { return new TursoStatement(this.client, sql); }
  async batch(statements: TursoStatement[]) {
    return (await this.client.batch(statements.map(s => ({ sql: s.sql, args: s.args })), 'write')).map(result);
  }
}
function result(value: ResultSet) {
  return { success: true, results: value.rows.map(row => Object.fromEntries(value.columns.map((column, i) => [column, row[i]]))),
    meta: { changes: value.rowsAffected, last_row_id: Number(value.lastInsertRowid ?? 0) } };
}
class TursoStatement {
  constructor(private readonly client: Client, readonly sql: string, readonly args: InValue[] = []) {}
  bind(...args: InValue[]) { return new TursoStatement(this.client, this.sql, args); }
  async all() { return result(await this.client.execute({ sql: this.sql, args: this.args })); }
  async run() { return this.all(); }
  async first(column?: string) { const row = (await this.all()).results[0]; return row ? column ? row[column] : row : null; }
  async raw(options?: { columnNames?: boolean }) {
    const value = await this.client.execute({ sql: this.sql, args: this.args });
    const rows = value.rows.map(row => value.columns.map((_, i) => row[i]));
    return options?.columnNames ? [value.columns, ...rows] : rows;
  }
}
