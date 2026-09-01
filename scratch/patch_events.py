
import sys

file_path = "f:/ARTech/Usher-Management/Usher-Management/artifacts/api-server/src/routes/events.ts"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Replace condition for assigned to include accepted
old_assigned = "if ((assignment.existingAssignment.status === \"pending\" || assignment.existingAssignment.status === \"applied\") && parsed.data.status === \"assigned\") {"
new_assigned = "if ((assignment.existingAssignment.status === \"pending\" || assignment.existingAssignment.status === \"applied\") && (parsed.data.status === \"assigned\" || parsed.data.status === \"accepted\")) {"
content = content.replace(old_assigned, new_assigned)

# Replace condition for rejected
# Actually that condition is fine as is.

# Add SSE broadcast at the end of PATCH /events/:id/assignments/:assignmentId
old_res = "    res.json(assignment.updated);"
new_res = "    sseManager.broadcast(\"EVENT_UPDATED\", { id: eventId });\n    res.json(assignment.updated);"
content = content.replace(old_res, new_res)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("events.ts patched")
