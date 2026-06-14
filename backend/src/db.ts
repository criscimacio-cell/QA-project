import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://qtamp:qtamp_dev@localhost:5432/qtamp';

const sql = postgres(DATABASE_URL, {
  idle_timeout: 20,
  max_lifetime: 60 * 30,
  max: 10,
  onnotice: () => {}, // silence NOTICE messages
});

export default sql;
export { sql };
