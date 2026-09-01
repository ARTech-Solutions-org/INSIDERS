
import sys

file_path = "f:/ARTech/Usher-Management/Usher-Management/artifacts/ushers-app/src/App.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Add import
import_hook = "import { useRealtimeSync } from '@/hooks/useRealtimeSync';\n"
content = import_hook + content

# Add hook usage inside function App()
old_app = "function App() {"
new_app = "function AppContent() {\n  useRealtimeSync();\n  return null;\n}\n\nfunction App() {"
content = content.replace(old_app, new_app)

old_return = "<Toaster position=\"top-center\" richColors />"
new_return = "<AppContent />\n        <Toaster position=\"top-center\" richColors />"
content = content.replace(old_return, new_return)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("ushers-app/src/App.tsx patched")
