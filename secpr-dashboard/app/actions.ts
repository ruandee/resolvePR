'use server';

import { neon } from '@neondatabase/serverless';

export async function create(formData: FormData) {
  const sql = neon(`${process.env.DATABASE_URL}`);
  const comment = formData.get('comment');
  await sql`INSERT INTO comments (comment) VALUES (${comment})`;
}
