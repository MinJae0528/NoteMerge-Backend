const { pool } = require('./src/config/database');

async function showTables() {
  try {
    console.log('=== 데이터베이스 테이블 목록 ===');
    const [tables] = await pool.execute('SHOW TABLES');
    console.log(tables);
    
    for (const table of tables) {
      const tableName = Object.values(table)[0];
      console.log(`\n=== ${tableName} 테이블 구조 ===`);
      const [columns] = await pool.execute(`DESCRIBE ${tableName}`);
      console.table(columns);
      
      // CREATE TABLE 문도 가져오기
      console.log(`\n=== ${tableName} CREATE TABLE 문 ===`);
      const [createTable] = await pool.execute(`SHOW CREATE TABLE ${tableName}`);
      console.log(createTable[0]['Create Table']);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

showTables();