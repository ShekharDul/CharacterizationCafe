import { create } from "zustand";
import { type Project, type Preview, clone } from "./model";
type State = {
  project: Project | null;
  past: Project[];
  future: Project[];
  preview: Preview;
  selected: string | null;
  load: (p: Project) => void;
  edit: (fn: (p: Project) => void) => void;
  undo: () => void;
  redo: () => void;
  select: (id: string | null) => void;
  setPreview: (preview: Preview) => void;
};
export const useEditor = create<State>((set) => ({
  project: null,
  past: [],
  future: [],
  preview: "normal",
  selected: null,
  load: (p) =>
    set({
      project: clone(p),
      past: [],
      future: [],
      selected: p.traces[0]?.id ?? null,
      preview: "normal",
    }),
  edit: (fn) =>
    set((s) => {
      if (!s.project) return s;
      // Source files are immutable. Share them across history entries rather than
      // copying potentially large raw files on every styling keystroke.
      const p = {
        ...clone({ ...s.project, sources: [] }),
        sources: s.project.sources,
      };
      fn(p);
      p.updatedAt = new Date().toISOString();
      return {
        project: p,
        past: [...s.past, s.project].slice(-60),
        future: [],
      };
    }),
  undo: () =>
    set((s) =>
      !s.past.length || !s.project
        ? s
        : {
            project: {
              ...s.past[s.past.length - 1],
              updatedAt: new Date().toISOString(),
            },
            past: s.past.slice(0, -1),
            future: [s.project, ...s.future],
          },
    ),
  redo: () =>
    set((s) =>
      !s.future.length || !s.project
        ? s
        : {
            project: { ...s.future[0], updatedAt: new Date().toISOString() },
            past: [...s.past, s.project],
            future: s.future.slice(1),
          },
    ),
  select: (selected) => set({ selected }),
  setPreview: (preview) => set({ preview }),
}));
