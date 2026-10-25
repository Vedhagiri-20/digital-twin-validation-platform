import React, { useState } from "react";
import "./validation-flow-carousel.css";

const stages = [
  {
    number: "01",
    title: "Engineering Definition",
    subtitle: "Establish the expected product configuration",
    description:
      "Define the approved engineering source of truth before downstream validation begins.",
    points: [
      "Product structure and part numbers",
      "Revision and quantity",
      "Lifecycle state",
      "Engineering change context",
    ],
    accent: "green",
  },
  {
    number: "02",
    title: "PLM Synchronization",
    subtitle: "Maintain the controlled downstream product definition",
    description:
      "Transfer engineering information into PLM through governed integrations and synchronization workflows.",
    points: [
      "Engineering-to-PLM data transfer",
      "Product structure synchronization",
      "Revision and lifecycle propagation",
      "Controlled downstream representation",
    ],
    accent: "green",
  },
  {
    number: "03",
    title: "Automated Validation",
    subtitle: "Verify digital continuity and data integrity",
    description:
      "Compare Engineering/CAD source data against the PLM representation using deterministic validation rules.",
    points: [
      "Revision consistency",
      "Quantity validation",
      "Lifecycle-state validation",
      "Missing or unexpected components",
    ],
    accent: "red",
  },
  {
    number: "04",
    title: "Validation Analysis & Decision",
    subtitle: "Investigate discrepancies and verify corrective action",
    description:
      "Convert failed validation checks into traceable findings that can be reviewed, corrected and validated again.",
    points: [
      "Defect identification and evidence",
      "Expected vs. actual analysis",
      "Fix verification",
      "Regression validation and closure",
    ],
    accent: "red",
  },
];

export default function ValidationFlowCarousel() {
  const [active, setActive] = useState(0);
  const [direction, setDirection] = useState("next");

  const changeStage = (nextIndex, nextDirection) => {
    setDirection(nextDirection);
    setActive(nextIndex);
  };

  const next = () => {
    changeStage((active + 1) % stages.length, "next");
  };

  const previous = () => {
    changeStage(
      (active - 1 + stages.length) % stages.length,
      "previous"
    );
  };

  const stage = stages[active];

  return (
    <section
      id="how-it-works"
      className="industry-flow"
      aria-labelledby="industry-flow-title"
    >
      <div className="industry-flow__inner">
        <div className="industry-flow__intro">
          <span className="industry-flow__eyebrow">
            VALIDATION FLOW
          </span>

          <h2 id="industry-flow-title">
            Maintain digital continuity from engineering
            definition through PLM validation.
          </h2>

          <p>
            Follow the engineering-data validation lifecycle from
            source definition through synchronization, automated
            comparison and validation decision.
          </p>
        </div>

        <div className="industry-flow__progress">
          {stages.map((item, index) => (
            <button
              key={item.number}
              type="button"
              className={
                index === active
                  ? "industry-flow__progress-item industry-flow__progress-item--active"
                  : "industry-flow__progress-item"
              }
              onClick={() =>
                changeStage(
                  index,
                  index >= active ? "next" : "previous"
                )
              }
              aria-label={`Open stage ${item.number}: ${item.title}`}
            >
              
              <strong>{item.title}</strong>
            </button>
          ))}
        </div>

        <div className="industry-flow__stage-shell">
          <button
            type="button"
            className="industry-flow__arrow industry-flow__arrow--left"
            onClick={previous}
            aria-label="Previous validation stage"
          >
            <svg
              viewBox="0 0 24 24"
              width="22"
              height="22"
              aria-hidden="true"
            >
              <path
                d="M15 18l-6-6 6-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <article
            key={active}
            className={`industry-flow__stage industry-flow__stage--${direction}`}
            aria-live="polite"
          >
            <div className="industry-flow__stage-number">
              STAGE {stage.number}
            </div>

            <div className="industry-flow__stage-grid">
              <div className="industry-flow__stage-copy">
                <div
                  className={`industry-flow__icon industry-flow__icon--${stage.accent}`}
                >
                  {stage.number}
                </div>

                <h3>{stage.title}</h3>

                <h4>{stage.subtitle}</h4>

                <p>{stage.description}</p>
              </div>

              <div className="industry-flow__checks">
                <span className="industry-flow__checks-label">
                  VALIDATION SCOPE
                </span>

                {stage.points.map((point) => (
                  <div
                    className="industry-flow__check"
                    key={point}
                  >
                    <span className="industry-flow__check-mark">
                      ✓
                    </span>
                    <span>{point}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="industry-flow__footer">
              <span>
                {String(active + 1).padStart(2, "0")}
                {" / "}
                {String(stages.length).padStart(2, "0")}
              </span>

              <div className="industry-flow__dots">
                {stages.map((item, index) => (
                  <button
                    key={item.number}
                    type="button"
                    className={
                      active === index
                        ? "industry-flow__dot industry-flow__dot--active"
                        : "industry-flow__dot"
                    }
                    onClick={() =>
                      changeStage(
                        index,
                        index >= active ? "next" : "previous"
                      )
                    }
                    aria-label={`Go to stage ${item.number}`}
                  />
                ))}
              </div>

              <span className="industry-flow__footer-label">
                Engineering validation lifecycle
              </span>
            </div>
          </article>

          <button
            type="button"
            className="industry-flow__arrow industry-flow__arrow--right"
            onClick={next}
            aria-label="Next validation stage"
          >
            <svg
              viewBox="0 0 24 24"
              width="22"
              height="22"
              aria-hidden="true"
            >
              <path
                d="M9 6l6 6-6 6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}
