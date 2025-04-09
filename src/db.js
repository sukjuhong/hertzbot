import { JSONFilePreset } from "lowdb/node";
import path from "path";
import appRoot from "app-root-path";

const dbPath = path.join(appRoot.path, "db.json");

const defaultData = { trackedChannels: [] };
const db = await JSONFilePreset(dbPath, defaultData);

export { db };
