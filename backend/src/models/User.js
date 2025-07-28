const BaseModel = require('./BaseModel');
const bcrypt = require('bcryptjs');
const winston = require('winston');
const db = require('../config/database');

class User extends BaseModel {
  constructor() {
    super('users');
  }

  async findByEmail(email) {
    try {
      const result = await db.query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );
      return result.rows[0];
    } catch (error) {
      winston.error('Error in User.findByEmail:', error);
      throw error;
    }
  }

  async create(userData) {
    try {
      const { password, ...otherData } = userData;
      const hashedPassword = await bcrypt.hash(password, 10);
      
      return super.create({
        ...otherData,
        password: hashedPassword,
        created_at: new Date(),
        updated_at: new Date()
      });
    } catch (error) {
      winston.error('Error in User.create:', error);
      throw error;
    }
  }

  async updatePassword(id, newPassword) {
    try {
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      return super.update(id, {
        password: hashedPassword,
        updated_at: new Date()
      });
    } catch (error) {
      winston.error('Error in User.updatePassword:', error);
      throw error;
    }
  }

  async verifyPassword(plainPassword, hashedPassword) {
    try {
      return await bcrypt.compare(plainPassword, hashedPassword);
    } catch (error) {
      winston.error('Error in User.verifyPassword:', error);
      throw error;
    }
  }

  async findByRole(role) {
    try {
      const result = await db.query(
        'SELECT * FROM users WHERE role = $1',
        [role]
      );
      return result.rows;
    } catch (error) {
      winston.error('Error in User.findByRole:', error);
      throw error;
    }
  }

  async updateLastLogin(id) {
    try {
      return super.update(id, {
        last_login: new Date(),
        updated_at: new Date()
      });
    } catch (error) {
      winston.error('Error in User.updateLastLogin:', error);
      throw error;
    }
  }
}

module.exports = new User(); 