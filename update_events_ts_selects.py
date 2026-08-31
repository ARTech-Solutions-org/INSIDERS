import re

file_path = "artifacts/api-server/src/routes/events.ts"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# For GET /events/:id
content = content.replace(
    "avgRating: ushersTable.avgRating,",
    "avgRating: ushersTable.avgRating,\n      languages: ushersTable.languages,\n      height: ushersTable.height,\n      dateOfBirth: ushersTable.dateOfBirth,"
)

# For GET /events/:id/assignments
content = content.replace(
    "gender: ushersTable.gender } }",
    "gender: ushersTable.gender, languages: ushersTable.languages, height: ushersTable.height, dateOfBirth: ushersTable.dateOfBirth } }"
)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Updated events.ts")
