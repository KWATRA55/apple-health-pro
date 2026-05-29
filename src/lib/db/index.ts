import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DB_PATH = path.join(process.cwd(), 'data', 'health.db')

let db: Database.Database | null = null

export function getDB(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    initializeSchema(db)
  }
  return db
}

function initializeSchema(database: Database.Database): void {
  const schemaPath = path.join(process.cwd(), 'src', 'lib', 'db', 'schema.sql')
  const schema = fs.readFileSync(schemaPath, 'utf-8')
  database.exec(schema)
}

export function runQuery(sql: string, params: Record<string, unknown> = {}): Database.RunResult {
  const database = getDB()
  return database.prepare(sql).run(params)
}

export function getOne<T = Record<string, unknown>>(sql: string, params: Record<string, unknown> = {}): T | undefined {
  const database = getDB()
  return database.prepare(sql).get(params) as T | undefined
}

export function getAll<T = Record<string, unknown>>(sql: string, params: Record<string, unknown> = {}): T[] {
  const database = getDB()
  return database.prepare(sql).all(params) as T[]
}

export function closeDB(): void {
  if (db) {
    db.close()
    db = null
  }
}

export type { Database }
