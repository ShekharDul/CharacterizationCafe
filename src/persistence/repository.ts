import { openDB } from "idb";
import { type Project, projectSchema } from "../domain/model";
const database = () =>
  openDB("characterization-cafe", 1, {
    upgrade(db) {
      db.createObjectStore("projects", { keyPath: "id" });
    },
  });
export const repository = {
  async save(project: Project) {
    const db = await database();
    await db.put("projects", projectSchema.parse(project));
  },
  async list(): Promise<Project[]> {
    const db = await database();
    const rows = await db.getAll("projects");
    return rows
      .map((p) => projectSchema.parse(p))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  async remove(id: string) {
    const db = await database();
    await db.delete("projects", id);
  },
};
