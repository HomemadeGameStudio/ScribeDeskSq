import { GitHubMark } from "./icons";

interface Props {
  greeting: string;
  ping: number;
  pingOk: boolean;
  clock: string;
  panicEnabled: boolean;
  onPanic: () => void;
}

export default function Footer({ greeting, ping, pingOk, clock, panicEnabled, onPanic }: Props) {
  return (
    <footer className="sd-footer">
      <div className="sd-greet">
        <span className="wave" aria-hidden>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 3.2c2.8 3 4.2 5.6 4.2 8a4.2 4.2 0 1 1-8.4 0c0-2.4 1.4-5 4.2-8Z"
              fill="#ff6a3d"
              opacity="0.9"
            />
            <path d="M12 12.6v8" stroke="#94929c" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </span>
        <span>
          {greeting}, <strong>User</strong>!
        </span>
      </div>

      <div className="sd-tele" aria-label="Connection telemetry">
        <span className="sd-ping">
          <span className={`ping-dot ${pingOk ? "ok" : "warn"}`} aria-hidden />
          Ping: <b>{ping} ms</b>
        </span>
        <span className="sep" aria-hidden />
        <span>US-EAST · NODE 04</span>
        <span className="sep" aria-hidden />
        <span>{clock}</span>
      </div>

      <div className="sd-repos">
        <a
          className="sd-repo-link"
          href="https://github.com/titaniumnetwork-dev/Ultraviolet"
          target="_blank"
          rel="noreferrer"
        >
          <GitHubMark size={13} /> Ultraviolet
        </a>
        <a
          className="sd-repo-link"
          href="https://github.com/mercuryworkshop/bare-mux"
          target="_blank"
          rel="noreferrer"
        >
          Bare-Mux
        </a>
        {panicEnabled && (
          <button className="sd-panic-chip" onClick={onPanic} title="Instantly bail to the decoy site">
            <kbd>~</kbd> panic
          </button>
        )}
      </div>
    </footer>
  );
}
