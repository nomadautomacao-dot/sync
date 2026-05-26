import NextAuth from "next-auth";
import { authOptions } from "@/core/lib/auth";

export default NextAuth(authOptions);
