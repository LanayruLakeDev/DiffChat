import "load-env";
import { pgDb } from "lib/db/pg/db.pg";
import { sql } from "drizzle-orm";

export async function addAgentSharingMigration() {
  try {
    console.log("Running agent sharing migration...");
    
    // Add is_public column to agent table
    await pgDb.execute(sql`
      ALTER TABLE agent ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;
    `);
    
    console.log("✓ Added is_public column to agent table");
    console.log("✓ Agent sharing migration completed successfully");
  } catch (error) {
    console.error("❌ Agent sharing migration failed:", error);
    throw error;
  }
}

// Run migration
await addAgentSharingMigration();
