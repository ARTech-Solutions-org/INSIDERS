import { db } from "../src/index.js";
import bcrypt from "bcryptjs";
import { adminsTable } from "../src/schema/admins.js";
import { ushersTable } from "../src/schema/ushers.js";
import { eventsTable } from "../src/schema/events.js";
import { eventAssignmentsTable } from "../src/schema/event-assignments.js";
import { deductionRulesTable } from "../src/schema/deduction-rules.js";
import { ratingsTable } from "../src/schema/ratings.js";
import { balanceTransactionsTable } from "../src/schema/balance-transactions.js";
import { usherDocumentsTable } from "../src/schema/usher-documents.js";
import { usherAvailabilityTable } from "../src/schema/usher-availability.js";
import { usherSkillsTable } from "../src/schema/usher-skills.js";

async function seed() {
  console.log("Starting database seed...");

  console.log("Cleaning old data...");
  await db.delete(balanceTransactionsTable);
  await db.delete(ratingsTable);
  await db.delete(deductionRulesTable);
  await db.delete(eventAssignmentsTable);
  await db.delete(eventsTable);
  await db.delete(usherAvailabilityTable);
  await db.delete(usherSkillsTable);
  await db.delete(usherDocumentsTable);
  await db.delete(ushersTable);
  await db.delete(adminsTable);

  // 1. Create Admins
  const passwordHash = await bcrypt.hash("password123", 10);
  console.log("Creating admins...");
  const [superAdmin] = await db.insert(adminsTable).values({
    name: "Alice Super",
    email: "super@artech.com",
    passwordHash,
    role: "super_admin",
  }).returning();

  const [regularAdmin] = await db.insert(adminsTable).values({
    name: "Bob Admin",
    email: "admin@artech.com",
    passwordHash,
    role: "admin",
    createdByAdminId: superAdmin.id,
  }).returning();

  const [coordinator] = await db.insert(adminsTable).values({
    name: "Charlie Coordinator",
    email: "coordinator@artech.com",
    passwordHash,
    role: "admin", // changed from coordinator
    createdByAdminId: superAdmin.id,
  }).returning();

  // 2. Create Ushers
  console.log("Creating ushers...");
  const [usher1] = await db.insert(ushersTable).values({
    fullName: "John Doe",
    phone: "+201000000001",
    email: "john.doe@example.com",
    nationalIdNumber: "29001011234567",
    passwordHash,
    status: "active",
    avgRating: 4.5,
    balance: 500,
  }).returning();

  const [usher2] = await db.insert(ushersTable).values({
    fullName: "Jane Smith",
    phone: "+201000000002",
    email: "jane.smith@example.com",
    nationalIdNumber: "29505051234568",
    passwordHash,
    status: "active",
    avgRating: 4.8,
    balance: 1200,
  }).returning();

  const [usher3] = await db.insert(ushersTable).values({
    fullName: "Omar Pending",
    phone: "+201000000003",
    email: "omar.pending@example.com",
    nationalIdNumber: "29909091234569",
    passwordHash,
    status: "pending",
  }).returning();

  // 3. Usher Details
  await db.insert(usherDocumentsTable).values([
    { usherId: usher1.id, docType: "national_id", fileUrl: "https://example.com/doc1.pdf", fileKey: "doc1", status: "approved" },
    { usherId: usher2.id, docType: "national_id", fileUrl: "https://example.com/doc2.pdf", fileKey: "doc2", status: "approved" },
  ]);

  await db.insert(usherSkillsTable).values([
    { usherId: usher1.id, skillType: "language", value: "English" },
    { usherId: usher1.id, skillType: "language", value: "Arabic" },
    { usherId: usher2.id, skillType: "brand_experience", value: "Samsung" },
    { usherId: usher2.id, skillType: "height", value: "175cm" },
  ]);

  const today = new Date();
  const tmrw = new Date(); tmrw.setDate(tmrw.getDate() + 1);
  const nextWeek = new Date(); nextWeek.setDate(nextWeek.getDate() + 7);

  await db.insert(usherAvailabilityTable).values([
    { usherId: usher1.id, date: today.toISOString(), isAvailable: true },
    { usherId: usher2.id, date: nextWeek.toISOString(), isAvailable: true },
  ]);

  // 4. Create Events
  console.log("Creating events...");
  const [pastEvent] = await db.insert(eventsTable).values({
    title: "Tech Conference 2026",
    eventLocName: "Cairo International Convention Centre",
    venueLat: 30.0718,
    venueLng: 31.3175,
    startTime: new Date(Date.now() - 86400000 * 2), // 2 days ago
    endTime: new Date(Date.now() - 86400000 * 2 + 3600000 * 8), // 8 hours long
    dressCode: "Formal Business",
    instructions: "Arrive 30 mins early. Go to Hall 3.",
    eventBudget: 10000,
    status: "completed",
    createdByAdminId: superAdmin.id,
  }).returning();

  const [upcomingEvent] = await db.insert(eventsTable).values({
    title: "Summer Music Festival",
    eventLocName: "El Gouna Arena",
    venueLat: 27.3371,
    venueLng: 33.6775,
    startTime: nextWeek,
    endTime: new Date(nextWeek.getTime() + 3600000 * 10),
    dressCode: "Black Artech T-Shirt, Black Jeans",
    instructions: "Meet at the main gate. Stay hydrated.",
    eventBudget: 15000,
    status: "published",
    createdByAdminId: regularAdmin.id,
  }).returning();

  // 5. Deduction Rules
  await db.insert(deductionRulesTable).values([
    { eventId: upcomingEvent.id, ruleType: "Late > 15m", amount: 50 },
    { eventId: upcomingEvent.id, ruleType: "No Show", amount: 200 },
  ]);

  // 6. Assignments & History
  console.log("Creating assignments...");
  
  // Past event assignment (completed)
  const [pastAssignment] = await db.insert(eventAssignmentsTable).values({
    eventId: pastEvent.id,
    usherId: usher1.id,
    status: "completed",
    isTeamLead: true,
    checkinTime: new Date(pastEvent.startTime.getTime() - 1800000), // 30 mins early
    checkinMethod: "gps",
    checkinLat: pastEvent.venueLat,
    checkinLng: pastEvent.venueLng,
    checkoutTime: pastEvent.endTime,
  }).returning();

  await db.insert(ratingsTable).values({
    eventAssignmentId: pastAssignment.id,
    ratedByType: "admin",
    ratingValue: 5,
    comment: "Excellent leadership.",
  });

  await db.insert(balanceTransactionsTable).values({
    usherId: usher1.id,
    eventAssignmentId: pastAssignment.id,
    amount: 500,
    type: "credit",
    reason: "Event completion: Tech Conference 2026",
  });

  // Upcoming event assignment (accepted)
  await db.insert(eventAssignmentsTable).values({
    eventId: upcomingEvent.id,
    usherId: usher2.id,
    status: "accepted",
    isTeamLead: false,
  });

  console.log("Seed completed successfully!");
}

seed().catch(console.error).finally(() => process.exit(0));
