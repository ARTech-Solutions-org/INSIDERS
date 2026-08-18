import { sign } from "jsonwebtoken";
console.log(sign({ id: 1, email: "admin@test.com", role: "admin" }, process.env.JWT_SECRET || "supersecret"));
