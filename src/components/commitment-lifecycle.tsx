"use client";
import { useEffect, useState } from "react";

const STEPS = [
  ["Intent", "Requester states an outcome and its acceptance criteria."],
  ["Commit", "Terms are frozen into a signed commitment object."],
  ["Fund", "Capital moves into escrow before work can start."],
  ["Claim", "A verified worker takes the commitment on-chain."],
  ["Verify", "Independent verifiers attest against the criteria."],
  ["Settle", "Escrow releases and reputation is written."],
];

const DWELL = 2600;

/**
 * The six stages of a commitment, walked automatically so the row reads as a
 * sequence rather than a list. Hovering or focusing a stage pins it.
 */
export function CommitmentLifecycle() {
  const [active, setActive] = useState(0);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    if (pinned || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setActive((step) => (step + 1) % STEPS.length), DWELL);
    return () => window.clearInterval(id);
  }, [pinned]);

  const pin = (index: number) => { setActive(index); setPinned(true); };

  return (
    <section className="commitment-lifecycle">
      <header className="lifecycle-intro">
        <div>
          <p className="section-label">A new economic primitive</p>
          <h2>The commitment, not the transaction<em>.</em></h2>
        </div>
        <p>A commitment binds an intent, its capital, its worker, and its proof into one settleable object. Agents negotiate against it. The protocol enforces it. Nothing settles until the proof clears.</p>
      </header>
      <ol className="lifecycle-track" onMouseLeave={() => setPinned(false)}>
        {STEPS.map(([title, copy], index) => (
          <li key={title}>
            <button
              type="button"
              className={`lifecycle-stage ${index === active ? "is-active" : index < active ? "is-done" : "is-ahead"}`}
              onMouseEnter={() => pin(index)}
              onFocus={() => pin(index)}
              onBlur={() => setPinned(false)}
              onClick={() => pin(index)}
              aria-current={index === active}
            >
              <span className="stage-index">0{index + 1}</span>
              <span className="stage-dot" aria-hidden="true" />
              <b>{title}</b>
              <span className="stage-copy">{copy}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
