import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import LinkedInProvider from "next-auth/providers/linkedin";
import { prisma } from "@/lib/prisma";
import { syncLinkedInProfile } from "@/lib/linkedin";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  providers: [
    LinkedInProvider({
      clientId: process.env.LINKEDIN_CLIENT_ID!,
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET!,
      client: { token_endpoint_auth_method: "client_secret_post" },
      wellKnown:
        "https://www.linkedin.com/oauth/.well-known/openid-configuration",
      // Added w_member_social for auto-posting and offline_access for refresh tokens
      authorization: { params: { scope: "openid profile email w_member_social offline_access" } },
      profile(profile) {
        return {
          id: profile.sub,
          name: `${profile.given_name} ${profile.family_name}`,
          email: profile.email,
          image: profile.picture,
          // Note: linkedinId is set via syncLinkedInProfile in signIn callback
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "linkedin") {
        // Sync LinkedIn profile data
        if (account.access_token) {
          try {
            await syncLinkedInProfile(user.id, account.access_token);
          } catch (err) {
            console.error("LinkedIn profile sync failed:", err);
          }
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      // Set uid on initial sign-in
      if (user) {
        token.uid = user.id;
      }
      // Always fetch fresh data from DB so role/subscription changes take effect immediately
      const uid = (token.uid as string) ?? user?.id;
      if (uid) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: uid },
            include: { subscription: true },
          });

          // Auto-create 7-day trial subscription if missing
          if (dbUser && !dbUser.subscription) {
            const trialEnd = new Date();
            trialEnd.setDate(trialEnd.getDate() + 7);
            try {
              dbUser.subscription = await prisma.subscription.upsert({
                where: { userId: uid },
                create: {
                  userId: uid,
                  status: "trialing",
                  trialEnd,
                  currency: "INR",
                },
                update: {},
              });
              console.log(`Created 7-day trial for user ${uid} in JWT callback`);
            } catch (err) {
              console.error("Failed to upsert trial in JWT:", err);
            }
          }

          token.uid = uid;
          token.role = dbUser?.role ?? "user";
          token.onboardingCompleted = dbUser?.onboardingCompleted ?? false;
          token.subscriptionStatus = dbUser?.subscription?.status ?? "none";
          token.trialEnd = dbUser?.subscription?.trialEnd?.toISOString() ?? null;
        } catch (err) {
          console.error("JWT callback DB fetch error:", err);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.role = (token.role as string) ?? "user";
        session.user.onboardingCompleted = token.onboardingCompleted as boolean;
        session.user.subscriptionStatus = token.subscriptionStatus as string;
        session.user.trialEnd = (token.trialEnd as string | null) ?? null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  // JWT strategy: allows middleware to read token claims without DB hit
  // maxAge: 24 hours — forces re-authentication daily for security
  session: { strategy: "jwt", maxAge: 24 * 60 * 60 },
};

// Extend next-auth types
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      onboardingCompleted?: boolean;
      subscriptionStatus?: string;
      trialEnd?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    role?: string;
    onboardingCompleted?: boolean;
    subscriptionStatus?: string;
    trialEnd?: string | null;
  }
}
