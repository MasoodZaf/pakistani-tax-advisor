const db = require('../config/database');
const winston = require('winston');

class BaseModel {
  constructor(tableName) {
    this.tableName = tableName;
  }

  async findById(id) {
    try {
      const result = await db.query(
        `SELECT * FROM ${this.tableName} WHERE id = $1`,
        [id]
      );
      return result.rows[0];
    } catch (error) {
      winston.error(`Error in ${this.tableName}.findById:`, error);
      throw error;
    }
  }

  async findAll(options = {}) {
    try {
      const { limit = 10, offset = 0, orderBy = 'created_at', order = 'DESC' } = options;
      const result = await db.query(
        `SELECT * FROM ${this.tableName} 
         ORDER BY ${orderBy} ${order}
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
      return result.rows;
    } catch (error) {
      winston.error(`Error in ${this.tableName}.findAll:`, error);
      throw error;
    }
  }

  async create(data) {
    try {
      const columns = Object.keys(data);
      const values = Object.values(data);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
      
      const result = await db.query(
        `INSERT INTO ${this.tableName} (${columns.join(', ')})
         VALUES (${placeholders})
         RETURNING *`,
        values
      );
      return result.rows[0];
    } catch (error) {
      winston.error(`Error in ${this.tableName}.create:`, error);
      throw error;
    }
  }

  async update(id, data) {
    try {
      const columns = Object.keys(data);
      const values = Object.values(data);
      const setClause = columns
        .map((col, i) => `${col} = $${i + 2}`)
        .join(', ');
      
      const result = await db.query(
        `UPDATE ${this.tableName}
         SET ${setClause}
         WHERE id = $1
         RETURNING *`,
        [id, ...values]
      );
      return result.rows[0];
    } catch (error) {
      winston.error(`Error in ${this.tableName}.update:`, error);
      throw error;
    }
  }

  async delete(id) {
    try {
      const result = await db.query(
        `DELETE FROM ${this.tableName}
         WHERE id = $1
         RETURNING *`,
        [id]
      );
      return result.rows[0];
    } catch (error) {
      winston.error(`Error in ${this.tableName}.delete:`, error);
      throw error;
    }
  }

  async count(whereClause = '', params = []) {
    try {
      const query = `SELECT COUNT(*) FROM ${this.tableName} ${whereClause}`;
      const result = await db.query(query, params);
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      winston.error(`Error in ${this.tableName}.count:`, error);
      throw error;
    }
  }
}

module.exports = BaseModel; 