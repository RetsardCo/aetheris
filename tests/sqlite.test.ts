import { describe, it, expect } from 'vitest';
import initSqlJs from 'sql.js';

describe('sql.js WASM SQLite engine', () => {
  it('initializes and executes DDL, DML and queries', async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();

    db.run(`
      CREATE TABLE test_events (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        message TEXT
      );
    `);

    db.run('INSERT INTO test_events (id, timestamp, message) VALUES (?, ?, ?)', ['evt_1', 123456789, 'hello']);

    const res = db.exec('SELECT * FROM test_events WHERE id = "evt_1"');
    expect(res.length).toBe(1);
    expect(res[0].values[0][0]).toBe('evt_1');
    expect(res[0].values[0][1]).toBe(123456789);
    expect(res[0].values[0][2]).toBe('hello');

    const exported = db.export();
    expect(exported.length).toBeGreaterThan(0);
    db.close();
  });
});
