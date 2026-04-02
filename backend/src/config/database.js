let connectionString = (process.env.DATABASE_URL || '').trim();
if (/^DATABASE_URL\s*=/i.test(connectionString)) connectionString = connectionString.replace(/^DATABASE_URL\s*=\s*/i, '');
if ((connectionString.startsWith('"') && connectionString.endsWith('"')) || (connectionString.startsWith("'") && connectionString.endsWith("'"))) {
  connectionString = connectionString.slice(1, -1).trim();
}

const sqliteForced = process.env.USE_SQLITE === 'true';
const envDialect = String(process.env.DB_DIALECT || '').trim().toLowerCase();
let mysqlUrl = String(process.env.MYSQL_URL || process.env.MYSQL_DATABASE_URL || '').trim();
if (/^MYSQL_URL\s*=/i.test(mysqlUrl)) mysqlUrl = mysqlUrl.replace(/^MYSQL_URL\s*=\s*/i, '').trim();
if ((mysqlUrl.startsWith('"') && mysqlUrl.endsWith('"')) || (mysqlUrl.startsWith("'") && mysqlUrl.endsWith("'"))) {
  mysqlUrl = mysqlUrl.slice(1, -1).trim();
}

let db;

function isMySqlConnectionString(s) {
  const v = String(s || '').trim().toLowerCase();
  return v.startsWith('mysql://') || v.startsWith('mariadb://');
}

function shouldUseMySql() {
  if (envDialect === 'mysql') return true;
  if (mysqlUrl) return true;
  if (isMySqlConnectionString(connectionString)) return true;
  if (process.env.MYSQL_HOST || process.env.MYSQL_USER || process.env.MYSQL_DATABASE) return true;
  return false;
}

if (sqliteForced || (!connectionString && !shouldUseMySql())) {
  console.log('🗄️  Using SQLite database');
  db = require('./database-sqlite');
  db.isSQLite = true;
  db.isPostgres = false;
  db.isMySQL = false;
  db.dialect = 'sqlite';
} else {
  if (shouldUseMySql()) {
    console.log('🗄️  Using MySQL database');
    const mysql = require('mysql2/promise');

    const resolveMySqlConfig = () => {
      const urlToUse = mysqlUrl || connectionString;
      if (isMySqlConnectionString(urlToUse)) {
        const u = new URL(urlToUse);
        return {
          host: u.hostname,
          port: u.port ? Number.parseInt(u.port, 10) : 3306,
          user: decodeURIComponent(u.username || ''),
          password: decodeURIComponent(u.password || ''),
          database: (u.pathname || '').replace(/^\//, ''),
          ssl: (u.searchParams.get('ssl') || u.searchParams.get('sslmode') || '').toLowerCase(),
        };
      }
      return {
        host: process.env.MYSQL_HOST,
        port: Number.parseInt(process.env.MYSQL_PORT || '3306', 10),
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE,
        ssl: String(process.env.MYSQL_SSLMODE || process.env.MYSQL_SSL || '').toLowerCase(),
      };
    };

    const mysqlCfg = resolveMySqlConfig();
    const sslMode = mysqlCfg.ssl;
    const ssl =
      sslMode === 'disable' || sslMode === 'false' || sslMode === '0'
        ? undefined
        : sslMode
          ? { rejectUnauthorized: false }
          : undefined;

    const pool = mysql.createPool({
      host: mysqlCfg.host,
      port: mysqlCfg.port,
      user: mysqlCfg.user,
      password: mysqlCfg.password,
      database: mysqlCfg.database,
      ssl,
      waitForConnections: true,
      connectionLimit: Number.parseInt(process.env.MYSQL_POOL_MAX || '10', 10),
      queueLimit: 0,
      enableKeepAlive: true,
    });

    const translatePgParamsToMySql = (sql, params) => {
      let s = String(sql || '');
      const p = [...(params || [])];
      const matches = s.match(/\$\d+/g) || [];
      if (matches.length === 0) return { sql: s, params: p };

      // Map of $n to value
      const paramMap = new Map();
      matches.forEach(m => {
        const idx = parseInt(m.slice(1)) - 1;
        if (idx >= 0 && idx < p.length) {
          paramMap.set(m, p[idx]);
        }
      });

      const newParams = [];
      const translatedSql = s.replace(/\$\d+/g, (match) => {
        const val = paramMap.get(match);
        newParams.push(val);
        return '?';
      });

      return { sql: translatedSql, params: newParams };
    };

    const query = async (sql, params = []) => {
      let returningInfo = parseReturning(sql);
      
      // If no RETURNING found with regex, check if it's a simple DELETE/UPDATE/INSERT with RETURNING
      if (!returningInfo) {
        const upper = String(sql || '').toUpperCase();
        const retIdx = upper.lastIndexOf(' RETURNING ');
        if (retIdx !== -1) {
          returningInfo = {
            returning: String(sql).slice(retIdx + 11).trim(),
            baseSql: String(sql).slice(0, retIdx).trim()
          };
        }
      }

      if (returningInfo) {
        const baseSql = returningInfo.baseSql;
        const returning = returningInfo.returning;
        if (/^\s*INSERT\b/i.test(baseSql)) {
          const tableMatch = baseSql.match(/^\s*INSERT\s+INTO\s+([`"\w.]+)/i);
          const table = tableMatch ? tableMatch[1] : null;
          const { sql: translatedSql, params: translatedParams } = translatePgParamsToMySql(baseSql, params);
          const normalized = rewriteForMySql(translatedSql);
          const [result] = await pool.query(normalized, translatedParams);
          const insertId = result && typeof result.insertId === 'number' ? result.insertId : null;
          if (!table || !insertId) {
            return { rows: [{ id: insertId }], rowCount: result?.affectedRows || 0 };
          }
          const cols = returning === '*' ? '*' : returning;
          if (cols.trim().toLowerCase() === 'id') {
            return { rows: [{ id: insertId }], rowCount: 1 };
          }
          const [rows] = await pool.query(`SELECT ${cols} FROM ${table} WHERE id = ?`, [insertId]);
          return { rows: rows || [], rowCount: Array.isArray(rows) ? rows.length : 0 };
        }

        if (/^\s*UPDATE\b/i.test(baseSql)) {
          const tableMatch = baseSql.match(/^\s*UPDATE\s+([`"\w.]+)/i);
          const table = tableMatch ? tableMatch[1] : null;
          const whereClausePg = extractWhereForReturning(baseSql);
          const whereParams = whereClausePg ? getParamValuesForClause(whereClausePg, params) : [];
          const { sql: translatedWhereSql, params: translatedWhereParams } = translatePgParamsToMySql(whereClausePg, whereParams);
          const whereClauseMySql = whereClausePg ? rewriteForMySql(translatedWhereSql) : null;

          const { sql: translatedSql, params: translatedParams } = translatePgParamsToMySql(baseSql, params);
          const normalized = rewriteForMySql(translatedSql);
          const [result] = await pool.query(normalized, translatedParams);

          if (!table || !whereClauseMySql) {
            return { rows: [], rowCount: result?.affectedRows || 0 };
          }
          const cols = returning === '*' ? '*' : returning;
          const [rows] = await pool.query(`SELECT ${cols} FROM ${table} WHERE ${whereClauseMySql}`, translatedWhereParams);
          return { rows: rows || [], rowCount: Array.isArray(rows) ? rows.length : 0 };
        }

        if (/^\s*DELETE\b/i.test(baseSql)) {
          const tableMatch = baseSql.match(/^\s*DELETE\s+FROM\s+([`"\w.]+)/i);
          const table = tableMatch ? tableMatch[1] : null;
          const whereClausePg = extractWhereForReturning(baseSql);
          const whereParams = whereClausePg ? getParamValuesForClause(whereClausePg, params) : [];
          const { sql: translatedWhereSql, params: translatedWhereParams } = translatePgParamsToMySql(whereClausePg, whereParams);
          const whereClauseMySql = whereClausePg ? rewriteForMySql(translatedWhereSql) : null;

          const { sql: translatedSql, params: translatedParams } = translatePgParamsToMySql(baseSql, params);
          const normalized = rewriteForMySql(translatedSql);
          const [result] = await pool.query(normalized, translatedParams);

          const rowCount = result?.affectedRows || 0;
          if (rowCount === 0) return { rows: [], rowCount: 0 };

          if (returning.toLowerCase() === 'id' && whereClauseMySql && whereClauseMySql.includes('id = ?')) {
             const parts = whereClauseMySql.split(/\bAND\b/i);
             const idPartIdx = parts.findIndex(p => p.toLowerCase().includes('id = ?'));
             if (idPartIdx !== -1 && translatedWhereParams[idPartIdx] !== undefined) {
                return { rows: [{ id: translatedWhereParams[idPartIdx] }], rowCount };
             }
          }
          return { rows: [], rowCount };
        }
      }

      const { sql: translatedSql, params: translatedParams } = translatePgParamsToMySql(sql, params);
      const normalized = rewriteForMySql(translatedSql);
      try {
        const [rowsOrResult] = await pool.query(normalized, translatedParams);
        if (Array.isArray(rowsOrResult)) return { rows: rowsOrResult, rowCount: rowsOrResult.length };
        const rowCount = typeof rowsOrResult?.affectedRows === 'number' ? rowsOrResult.affectedRows : 0;
        const insertId = typeof rowsOrResult?.insertId === 'number' ? rowsOrResult.insertId : undefined;
        return { rows: insertId ? [{ id: insertId }] : [], rowCount };
      } catch (err) {
        const code = String(err?.code || '');
        const errno = Number(err?.errno || 0);
        if (code === 'ER_DUP_FIELDNAME' || errno === 1060) {
          if (/^\s*ALTER\s+TABLE\b/i.test(normalized) && /\bADD\s+COLUMN\b/i.test(normalized)) {
            return { rows: [], rowCount: 0 };
          }
        }
        if (code === 'ER_DUP_KEYNAME' || errno === 1061) {
          if (/^\s*CREATE\s+(UNIQUE\s+)?INDEX\b/i.test(normalized)) {
            return { rows: [], rowCount: 0 };
          }
        }
        throw err;
      }
    };

    const getClient = async () => {
      const conn = await pool.getConnection();
      return {
        query: async (sql, params) => {
          const { sql: translatedSql, params: translatedParams } = translatePgParamsToMySql(sql, params);
          const normalized = rewriteForMySql(translatedSql);
          const [rowsOrResult] = await conn.query(normalized, translatedParams || []);
          if (Array.isArray(rowsOrResult)) return { rows: rowsOrResult, rowCount: rowsOrResult.length };
          const rowCount = typeof rowsOrResult?.affectedRows === 'number' ? rowsOrResult.affectedRows : 0;
          const insertId = typeof rowsOrResult?.insertId === 'number' ? rowsOrResult.insertId : undefined;
          return { rows: insertId ? [{ id: insertId }] : [], rowCount };
        },
        release: () => conn.release(),
      };
    };

    db = {
      query,
      getClient,
      pool,
      isSQLite: false,
      isPostgres: false,
      isMySQL: true,
      dialect: 'mysql',
    };
  } else {
    console.log('🗄️  Using PostgreSQL database');
    const { Pool } = require('pg');
    let ssl = { rejectUnauthorized: false };
    try {
      const u = new URL(connectionString);
      console.log(`🗄️  PG target: ${u.hostname}${u.port ? `:${u.port}` : ''}${u.pathname || ''}`);
      const sslmode = (u.searchParams.get('sslmode') || '').toLowerCase();
      if (sslmode === 'disable' || sslmode === 'allow') ssl = false;
      if (sslmode === 'no-verify') ssl = { rejectUnauthorized: false };
    } catch {}
    const envSslMode = (process.env.PGSSLMODE || '').toLowerCase();
    if (envSslMode === 'disable' || envSslMode === 'allow') ssl = false;

    const pool = new Pool({
      connectionString,
      ssl,
      keepAlive: true,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
      max: Number.parseInt(process.env.PG_POOL_MAX || '10', 10),
    });
    pool.on('connect', () => {
      console.log('✅ Database connected');
    });
    pool.on('error', (err) => {
      console.error('❌ Database pool error:', err);
    });
    db = {
      query: (text, params) => pool.query(text, params),
      getClient: () => pool.connect(),
      pool,
      isSQLite: false,
      isPostgres: true,
      isMySQL: false,
      dialect: 'postgres',
    };
  }
}

module.exports = db;
