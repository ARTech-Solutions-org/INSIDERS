import { db, ushersTable } from "./src/index.js";

async function run() {
  try {
    await db.insert(ushersTable).values({
      fullName: "Test User",
      phone: "01022566232",
      email: "mohanedelrawy0@gmail.com",
      nationalIdNumber: "11111111111111",
      passwordHash: "dummy"
    });
    console.log("Inserted first");
  } catch(e) {}
  
  try {
    await db.insert(ushersTable).values({
      fullName: "Test User",
      phone: "01022566232",
      email: "mohanedelrawy0@gmail.com",
      nationalIdNumber: "11111111111111",
      passwordHash: "dummy"
    });
    console.log("Inserted second");
  } catch(e) {
    console.log("ERROR CODE:", e.code);
    console.log("ERROR MESSAGE:", e.message);
    console.log("ERROR KEYS:", Object.keys(e));
  }
}
run().then(() => process.exit(0));
