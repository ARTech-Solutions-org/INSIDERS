import os

filepath = 'artifacts/admin-app/src/pages/event-details.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace occurrences
content = content.replace("a.status !== 'pending'", "(a.status !== 'pending' && a.status !== 'applied')")
content = content.replace("a.status === 'pending'", "(a.status === 'pending' || a.status === 'applied')")

# Remove double parenthesis if any
content = content.replace("((a.status !== 'pending' && a.status !== 'applied'))", "(a.status !== 'pending' && a.status !== 'applied')")
content = content.replace("((a.status === 'pending' || a.status === 'applied'))", "(a.status === 'pending' || a.status === 'applied')")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

events_path = 'artifacts/api-server/src/routes/events.ts'
with open(events_path, 'r', encoding='utf-8') as f:
    events_content = f.read()

# Replace in events.ts (only the if condition for pending to accept applied)
events_content = events_content.replace(
    'if (assignment.existingAssignment.status === "pending" && parsed.data.status === "assigned") {',
    'if ((assignment.existingAssignment.status === "pending" || assignment.existingAssignment.status === "applied") && parsed.data.status === "assigned") {'
)
events_content = events_content.replace(
    'else if (assignment.existingAssignment.status === "pending" && parsed.data.status === "rejected") {',
    'else if ((assignment.existingAssignment.status === "pending" || assignment.existingAssignment.status === "applied") && parsed.data.status === "rejected") {'
)

with open(events_path, 'w', encoding='utf-8') as f:
    f.write(events_content)

print("Done")
