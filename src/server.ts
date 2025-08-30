import { app } from "./app";
import { config } from "./config";
import { connectMongo } from "./db/mongo";
import { ensureAdminSeeded } from "./seed/seedAdmin";

const port = config.port;

async function bootstrap(): Promise<void> {
	await connectMongo();
	await ensureAdminSeeded();
	app.listen(port, () => {
		// eslint-disable-next-line no-console
		console.log(`Server listening on http://localhost:${port}`);
	});
}

void bootstrap();
