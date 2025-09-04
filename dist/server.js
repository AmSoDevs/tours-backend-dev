"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const config_1 = require("./config");
const mongo_1 = require("./db/mongo");
const seedAdmin_1 = require("./seed/seedAdmin");
const port = config_1.config.port;
async function bootstrap() {
    await (0, mongo_1.connectMongo)();
    await (0, seedAdmin_1.ensureAdminSeeded)();
    app_1.app.listen(port, () => {
        // eslint-disable-next-line no-console
        console.log(`Server listening on http://localhost:${port}`);
    });
}
void bootstrap();
//# sourceMappingURL=server.js.map