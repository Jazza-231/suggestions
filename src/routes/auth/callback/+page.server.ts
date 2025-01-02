import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { github } from "$lib/server/auth";
import * as auth from "$lib/server/auth";
import { db } from "$lib/server/db";
import * as table from "$lib/server/db/schema";
import { eq } from "drizzle-orm";
import { OAUTH_CALLBACK_URL } from "$env/static/private";

export const load: PageServerLoad = async (event) => {
	const { url } = event;

	const searchParams = new URLSearchParams(url.search);
	const code = searchParams.get("code");
	const state = searchParams.get("state");
	const privateCode = searchParams.get("privateCode");

	const oauthProvider = privateCode ? "scratch" : "github";

	let oauthId;
	let username;
	let displayName;

	if (oauthProvider === "github") {
		if (!code || !state) {
			redirect(307, "/auth/error");
		}

		const tokens = await github.validateAuthorizationCode(code);
		const accessToken = tokens.accessToken();

		const response = await fetch("https://api.github.com/user", {
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		});

		const githubUser = await response.json();

		if (!githubUser) redirect(307, "/auth/error");

		oauthId = githubUser.id;
		username = githubUser.login;
		displayName = githubUser.name;
	}

	if (oauthProvider === "scratch") {
		await fetch(`https://auth.itinerary.eu.org/api/auth/verifyToken?privateCode=${privateCode}`, {
			method: "GET",
		})
			.then((response) => response.json())
			.then((data) => {
				if (data.valid === true && data.redirect === OAUTH_CALLBACK_URL) {
					oauthId = data.username;
					username = data.username;
					displayName = "";
				} else {
					redirect(307, "/auth/error");
				}
			});
	}

	let [dbUser] = await db.select().from(table.user).where(eq(table.user.oauthId, oauthId));

	if (!dbUser) {
		await db.insert(table.user).values({
			id: crypto.randomUUID(),
			oauthId,
			username,
			displayName,
			oauthProvider,
		});
	}

	[dbUser] = await db.select().from(table.user).where(eq(table.user.oauthId, oauthId));

	const sessionToken = auth.generateSessionToken();
	const session = await auth.createSession(sessionToken, dbUser.id);

	auth.setSessionTokenCookie(event, sessionToken, session.expiresAt);

	redirect(302, "/account");
};
