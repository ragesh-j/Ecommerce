import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import prisma from "../../config/db";
import { generateAccessToken, generateRefreshToken } from "../../utils/token";

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: process.env.GOOGLE_CALLBACK_URL!,
    },
    async (_googleAccessToken, _googleRefreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) return done(new Error("No email from Google"), undefined);

        // 1. check if Google account is already linked
        const existingAccount = await prisma.account.findUnique({
          where: {
            provider_providerAccountId: {
              provider: "google",
              providerAccountId: profile.id,
            },
          },
          include: { user: true },
        });

        // 2. if already linked → just create a new session, no need to touch user or account
        if (existingAccount) {
          const { user } = existingAccount;
          const accessToken = generateAccessToken(user.id, user.role);
          const refreshToken = generateRefreshToken(user.id, user.role);

          const session = await prisma.session.create({
            data: {
              userId: user.id,
              accessToken,
              refreshToken,
              accessTokenExpiry: new Date(Date.now() + 15 * 60 * 1000),
              refreshTokenExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
          });

          return done(null, { user, session, accessToken, refreshToken });
        }

        // 3. check if user exists with same email (registered with email/password)
        let user = await prisma.user.findUnique({ where: { email } });

        if (user) {
          // email/password user exists → just link Google to their account
          // no password change, no data change, just add the Account link
          await prisma.account.create({
            data: {
              userId: user.id,
              provider: "google",
              providerAccountId: profile.id,
            },
          });
        } else {
          // 4. brand new user → create user + account
          user = await prisma.user.create({
            data: {
              email,
              name: profile.displayName,
              avatarUrl: profile.photos?.[0]?.value,
              emailVerified: new Date(),
              role: "BUYER",
            },
          });

          await prisma.account.create({
            data: {
              userId: user.id,
              provider: "google",
              providerAccountId: profile.id,
            },
          });
        }

        // 5. create session for both cases
        const accessToken = generateAccessToken(user.id, user.role);
        const refreshToken = generateRefreshToken(user.id, user.role);

        const session = await prisma.session.create({
          data: {
            userId: user.id,
            accessToken,
            refreshToken,
            accessTokenExpiry: new Date(Date.now() + 15 * 60 * 1000),
            refreshTokenExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        });

        return done(null, { user, session, accessToken, refreshToken });
      } catch (err) {
        return done(err, undefined);
      }
    }
  )
);

export default passport;