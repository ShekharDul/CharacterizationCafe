import { useEffect, useRef, useState } from "react";
import { ArrowLeft, FolderOpen, Plus, Trash2 } from "lucide-react";
import { type Project, type Technique, uid } from "./domain/model";
import { useEditor } from "./domain/store";
import { repository } from "./persistence/repository";
import { sampleProject } from "./scientific/samples";
import { Brand, Confirm, Drawer } from "./components/ui";
import { Welcome, MiniPlot } from "./features/Welcome";
import { ImportWizard } from "./features/ImportWizard";
import { Editor } from "./features/Editor";
import { APP_VERSION } from "./domain/model";
export default function App() {
  const [screen, setScreen] = useState<
      "home" | "new" | "editor" | "projects" | "add"
    >("home"),
    [technique, setTechnique] = useState<Technique | undefined>(),
    [projects, setProjects] = useState<Project[]>([]),
    [help, setHelp] = useState(false),
    [deleting, setDeleting] = useState<Project | null>(null),
    [saveStatus, setSaveStatus] = useState("Saved"),
    [storageError, setStorageError] = useState("");
  const { project, load } = useEditor();
  const saveQueue = useRef(Promise.resolve());
  const generation = useRef(0);
  useEffect(() => {
    repository
      .list()
      .then(setProjects)
      .catch(() =>
        setStorageError(
          "Local projects could not be loaded. Enable browser storage and use a regular browsing window.",
        ),
      );
  }, []);
  useEffect(() => {
    if (!project) return;
    const version = ++generation.current;
    setSaveStatus("Saving…");
    saveQueue.current = saveQueue.current
      .catch(() => {})
      .then(() => repository.save(project))
      .then(() => {
        setProjects((prev) => [
          project,
          ...prev.filter((p) => p.id !== project.id),
        ]);
        if (version === generation.current) {
          setSaveStatus("Saved");
          setStorageError("");
        }
      })
      .catch(() => {
        if (version === generation.current)
          setSaveStatus("Save failed — browser storage unavailable");
        setStorageError(
          "Your project could not be saved. Browser storage may be full or unavailable. Export your figure and keep your original files.",
        );
      });
  }, [project]);
  const open = (p: Project) => {
    load(p);
    setScreen("editor");
  };
  const start = (t?: Technique) => {
    setTechnique(t);
    setScreen("new");
  };
  const duplicate = (p: Project) => {
    const copy = structuredClone(p);
    copy.id = uid();
    copy.name = `${p.name} copy`;
    copy.createdAt = new Date().toISOString();
    copy.updatedAt = copy.createdAt;
    open(copy);
  };
  return (
    <>
      {storageError && (
        <div className="global-notice" role="alert">
          {storageError}
        </div>
      )}
      {screen === "home" && (
        <Welcome
          onNew={start}
          onSample={(t) => open(sampleProject(t))}
          onProjects={() => setScreen("projects")}
          onHelp={() => setHelp(true)}
          projects={projects}
          onOpen={open}
        />
      )}
      {(screen === "new" || screen === "add") && (
        <ImportWizard
          key={`${screen}-${technique}`}
          initial={technique}
          existing={screen === "add" ? (project ?? undefined) : undefined}
          onCancel={() => setScreen(screen === "add" ? "editor" : "home")}
          onFinish={(p) => {
            if (screen === "add")
              useEditor.getState().edit((current) => Object.assign(current, p));
            else load(p);
            setScreen("editor");
          }}
        />
      )}
      {screen === "editor" && (
        <Editor
          onHome={() => setScreen("home")}
          onAdd={() => setScreen("add")}
          onDuplicate={duplicate}
          saveStatus={saveStatus}
        />
      )}
      {screen === "projects" && (
        <div className="projects-page">
          <header className="home-header">
            <Brand onClick={() => setScreen("home")} />
            <button className="primary small" onClick={() => start()}>
              <Plus size={16} /> New figure
            </button>
          </header>
          <main className="workflow-main">
            <button className="text-button" onClick={() => setScreen("home")}>
              <ArrowLeft size={15} /> Home
            </button>
            <div className="eyebrow">Your local library</div>
            <h1>Room for your research.</h1>
            <p className="lead">
              Your figures, data, and every deliberate change. Saved in this
              browser.
            </p>
            {projects.length ? (
              <div className="project-grid">
                {projects.map((p) => (
                  <article className="project-card" key={p.id}>
                    <button className="project-open" onClick={() => open(p)}>
                      <div className="project-thumbnail">
                        <MiniPlot technique={p.technique} />
                      </div>
                      <span className="tag">{p.technique}</span>
                      <h3>{p.name}</h3>
                      <p>
                        {p.traces.length} traces ·{" "}
                        {new Date(p.updatedAt).toLocaleDateString()}
                      </p>
                    </button>
                    <div className="button-row">
                      <button
                        className="text-button"
                        onClick={() => duplicate(p)}
                      >
                        Duplicate
                      </button>
                      <button
                        className="text-button"
                        aria-label={`Delete ${p.name}`}
                        onClick={() => setDeleting(p)}
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-projects">
                <FolderOpen size={34} />
                <h2>Your first figure belongs here.</h2>
                <p>Create a figure or explore a sample to get started.</p>
                <button className="primary" onClick={() => start()}>
                  Create a figure
                </button>
              </div>
            )}
            <p className="notice">
              Local storage is specific to this browser and device. Clearing
              browser data removes saved projects. Keep your source files and
              export a recipe for backup.
            </p>
          </main>
        </div>
      )}
      <Confirm
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete this local project?"
        description={`“${deleting?.name ?? ""}” and its saved data will be removed from this browser. Downloaded files are unaffected.`}
        onConfirm={() => {
          if (deleting) {
            const id = deleting.id;
            void saveQueue.current
              .then(() => repository.remove(id))
              .then(() =>
                setProjects((prev) => prev.filter((p) => p.id !== id)),
              )
              .catch(() =>
                setStorageError("Could not delete the project. Please retry."),
              );
          }
        }}
      />
      <Drawer
        open={help}
        onClose={() => setHelp(false)}
        title="A little guidance."
        description="CharacterizationCafe makes figure preparation transparent."
      >
        <h3>From data to figure</h3>
        <ol>
          <li>Choose your technique and upload CSV, TSV, TXT, or XLSX data.</li>
          <li>Check the detected headers and confirm X/Y columns.</li>
          <li>Choose a layout, then refine labels and styling.</li>
          <li>Apply processing deliberately in the Transformations tab.</li>
          <li>Export PNG, SVG, and your settings recipe.</li>
        </ol>
        <h3>Your data stays here</h3>
        <p>
          Source files and figures are stored locally in IndexedDB. No uploaded
          data is sent to a server. This version has no analytics or AI
          processing.
        </p>
        <h3>Scientific conventions</h3>
        <p>
          Changing an axis label does not convert values. FTIR and NMR reverse
          the displayed X axis by default. DSC sign inversion is a separate
          explicit transformation.
        </p>
        <h3>Processing and previews</h3>
        <p>
          Normalization and offsets preserve source data. The optional
          derivative uses centred secant differences with one-sided endpoints
          and no smoothing. Vision simulations approximate full-severity
          colour-vision deficiencies; they are not an accessibility
          certification.
        </p>
        <h3>Keyboard editing</h3>
        <p>
          Tab navigates controls. Ctrl+Z undoes figure actions; Ctrl+Shift+Z
          redoes them. Focus a figure annotation and use arrow keys to move it.
        </p>
        <h3>Current limits</h3>
        <p>
          Single-panel figures; no baseline correction, smoothing, automatic
          analysis, or unit conversion. Excel formulas use stored results. Large
          files are limited to 25 MB. Check labels, legend placement, and
          annotations visually before publication.
        </p>
        <small>CharacterizationCafe {APP_VERSION}</small>
      </Drawer>
    </>
  );
}
