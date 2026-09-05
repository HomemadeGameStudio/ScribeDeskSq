import type { FormEvent, RefObject } from "react";
import { ArrowIcon, SearchIcon } from "./icons";

export interface RoutingState {
  label: string;
  stage: string;
}

interface Props {
  engineLabel: string;
  routing: RoutingState | null;
  onRoute: (raw: string) => void;
  onEngineClick: () => void;
  inputRef: RefObject<HTMLInputElement>;
}

export default function SearchBar({ engineLabel, routing, onRoute, onEngineClick, inputRef }: Props) {
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const raw = inputRef.current?.value ?? "";
    if (!raw.trim() || routing) return;
    onRoute(raw);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <form className="sd-route" onSubmit={submit} role="search" aria-label="Route bar">
      <div className="sd-route-box">
        <SearchIcon size={17} />
        <input
          ref={inputRef}
          className="sd-route-input"
          type="text"
          placeholder="Search the web or enter a URL — opens in-page"
          autoComplete="off"
          spellCheck={false}
          aria-label="Search or URL"
        />

        <span
          className={`sd-route-status${routing ? " is-busy" : ""}`}
          role="status"
          aria-live="polite"
        >
          {routing ? (
            <>
              <span className="spinner" aria-hidden />
              {routing.stage}…
            </>
          ) : (
            <>ready · idle</>
          )}
        </span>

        <button
          type="button"
          className="sd-engine-chip"
          onClick={onEngineClick}
          title="Change proxy engine"
          aria-label={`Proxy engine: ${engineLabel}. Open settings.`}
        >
          <span className="dot" aria-hidden />
          {engineLabel}
        </button>

        <button
          className="sd-go-btn"
          type="submit"
          disabled={!!routing}
          aria-label="Open tunnel"
          title="Route it"
        >
          {routing ? (
            <span
              className="spinner"
              style={{ width: 16, height: 16, borderColor: "rgba(23,10,5,0.35)", borderTopColor: "#170a05" }}
              aria-hidden
            />
          ) : (
            <ArrowIcon size={17} />
          )}
        </button>
      </div>
    </form>
  );
}
