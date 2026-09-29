import {
  ArrowRight,
  Upload,
  ShieldCheck,
  ArrowUpRight,
  FolderOpen,
} from "lucide-react";
import { type Technique, type Project, techniques } from "../domain/model";
import { templates } from "../scientific/techniques";
import { Brand } from "../components/ui";
const lines: Record<Technique, string> = {
  XRD: "M0 44L13 43 19 42 23 10 27 43 44 42 48 28 52 43 68 42 73 19 77 42 90 42 94 34 98 42 120 42",
  Raman:
    "M0 44Q15 44 21 43Q26 43 29 19Q32 43 42 43Q57 43 63 31Q69 43 76 43Q80 43 83 8Q86 43 120 44",
  FTIR: "M0 15Q15 15 24 15Q32 54 41 15Q52 15 60 16Q65 49 70 16Q80 16 85 38Q91 16 120 16",
  "UV–Vis": "M0 44Q12 44 21 37Q32 2 44 24Q49 40 60 35Q78 0 93 28Q103 44 120 44",
  NMR: "M0 44H20L22 15 24 44H38L40 26 42 44 44 19 46 44H69L71 5 73 44 75 10 77 44H120",
  TGA: "M0 10Q21 10 29 14T42 17Q49 18 54 30T75 33Q83 33 88 42T120 44",
  DSC: "M0 34Q25 34 30 29T55 27Q62 27 68 9Q73 0 79 23Q83 32 91 34Q96 50 103 38T120 36",
};
export function MiniPlot({ technique }: { technique: Technique }) {
  return (
    <svg className="mini-plot" viewBox="0 0 120 56" aria-hidden="true">
      <path d="M0 53H120" stroke="currentColor" opacity=".15" />
      <path
        d={lines[technique]}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d={lines[technique]}
        transform="translate(0,6)"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        opacity=".25"
      />
    </svg>
  );
}
export function Welcome({
  onNew,
  onSample,
  onProjects,
  onHelp,
  projects,
  onOpen,
}: {
  onNew: (t?: Technique) => void;
  onSample: (t: Technique) => void;
  onProjects: () => void;
  onHelp: () => void;
  projects: Project[];
  onOpen: (p: Project) => void;
}) {
  return (
    <div className="welcome">
      <header className="home-header">
        <Brand />
        <nav>
          <button className="text-button" onClick={onProjects}>
            <FolderOpen size={16} /> Projects{" "}
            {projects.length > 0 && (
              <span className="count">{projects.length}</span>
            )}
          </button>
          <button className="text-button" onClick={onHelp}>
            Help
          </button>
          <button className="primary small" onClick={() => onNew()}>
            New figure <span>+</span>
          </button>
        </nav>
      </header>
      <main className="welcome-main">
        <div className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <span /> A workspace for your research
            </div>
            <h1>
              Good research.
              <br />
              <em>Beautifully presented.</em>
            </h1>
            <p>
              Publication-ready figures from raw research data.
              <br />
              Drop in your data, refine the details, and make your next figure
              feel effortless.
            </p>
            <div className="hero-actions">
              <button className="primary" onClick={() => onNew()}>
                <Upload size={17} /> Create a figure <ArrowRight size={17} />
              </button>
              <button onClick={() => onSample("XRD")}>
                Try sample data <ArrowUpRight size={16} />
              </button>
            </div>
            <div className="reassurance">
              <ShieldCheck size={15} /> Local to your browser. Your raw data
              stays yours.
            </div>
          </div>
          <div className="hero-figure">
            <div className="figure-topline">
              <span>
                <i /> FIGURE 01
              </span>
              <span>X-ray diffraction</span>
            </div>
            <svg
              viewBox="0 0 400 230"
              aria-label="Illustration of three synthetic diffraction patterns"
            >
              <path
                d="M48 18V192H378"
                fill="none"
                stroke="#596b70"
                strokeWidth="1"
              />
              {[0, 1, 2].map((i) => (
                <g
                  key={i}
                  transform={`translate(50,${28 + i * 50}) scale(2.65,.8)`}
                >
                  <path
                    d={lines.XRD}
                    fill="none"
                    stroke={["#2f637a", "#a87348", "#547762"][i]}
                    strokeWidth="1.25"
                  />
                </g>
              ))}
              {[20, 30, 40, 50, 60, 70, 80].map((v, i) => (
                <text
                  key={v}
                  x={56 + i * 51}
                  y={209}
                  fontSize="10"
                  textAnchor="middle"
                  fill="#526167"
                >
                  {v}
                </text>
              ))}
              <text x={216} y={228} fontSize="11" textAnchor="middle">
                2θ (°)
              </text>
              <text
                transform="translate(16,107) rotate(-90)"
                fontSize="11"
                textAnchor="middle"
              >
                Intensity (a.u.)
              </text>
              <text x={311} y={35} fontSize="10" fill="#2f637a">
                Sample A
              </text>
              <text x={311} y={85} fontSize="10" fill="#a87348">
                Sample B
              </text>
              <text x={311} y={135} fontSize="10" fill="#547762">
                Sample C
              </text>
            </svg>
            <div className="figure-footer">
              <span>Raw data. Clear perspective.</span>
              <span>SVG · PNG</span>
            </div>
          </div>
        </div>
        <section className="technique-section">
          <div className="section-heading">
            <div>
              <div className="eyebrow">Built around your experiment</div>
              <h2>Seven techniques. One thoughtful workspace.</h2>
            </div>
            <span className="muted">Choose a technique to begin</span>
          </div>
          <div className="technique-grid">
            {techniques.map((t, i) => (
              <button
                className={`technique-card technique-${i}`}
                key={t}
                onClick={() => onNew(t)}
              >
                <MiniPlot technique={t} />
                <div>
                  <strong>{t}</strong>
                  <ArrowUpRight size={15} />
                </div>
                <p>{templates[t].description}</p>
              </button>
            ))}
          </div>
        </section>
        {projects.length > 0 && (
          <section className="recent-section">
            <div className="section-heading">
              <h2>Pick up where you left off</h2>
              <button className="text-button" onClick={onProjects}>
                All projects <ArrowRight size={15} />
              </button>
            </div>
            <div className="recent-grid">
              {projects.slice(0, 3).map((p) => (
                <button
                  key={p.id}
                  className="recent-card"
                  onClick={() => onOpen(p)}
                >
                  <span className="tag">{p.technique}</span>
                  <strong>{p.name}</strong>
                  <small>
                    {p.traces.length} traces ·{" "}
                    {new Date(p.updatedAt).toLocaleDateString()}
                  </small>
                </button>
              ))}
            </div>
          </section>
        )}
        <div className="principles">
          <span>
            <b>01</b> Your data, preserved
          </span>
          <span>
            <b>02</b> Every change, visible
          </span>
          <span>
            <b>03</b> Every figure, editable
          </span>
        </div>
      </main>
      <footer className="home-footer">
        <span>
          CharacterizationCafe{" "}
          <span className="muted">/ Made for the details that matter.</span>
        </span>
        <span>No AI-generated analysis. Just your research.</span>
      </footer>
    </div>
  );
}
