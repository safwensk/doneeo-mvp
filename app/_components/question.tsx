"use client";

// Extracted from app/page.tsx — behavior unchanged.
import type { PlannerQuestion } from "../../lib/planner";

export function Question({ question, value, onChange, onTextCommit, busy }: { question: PlannerQuestion; value: string | boolean | undefined; onChange: (value: string | boolean) => void; onTextCommit: () => void; busy: boolean }) {
  if (question.type === "boolean") {
    return <div className="dynamic-question"><div><strong>{question.label}</strong>{question.help && <small>{question.help}</small>}</div><div className="yes-no"><button className={value === true ? "active" : ""} onClick={() => onChange(true)}>Yes</button><button className={value === false ? "active" : ""} onClick={() => onChange(false)}>No</button></div></div>;
  }
  if (question.type === "choice") {
    return <div className="dynamic-question stacked"><div><strong>{question.label}</strong>{question.help && <small>{question.help}</small>}</div><div className="choice-row">{question.options?.map(option => <button key={option} className={value === option ? "active" : ""} onClick={() => onChange(option)}>{option}</button>)}</div></div>;
  }
  const canSubmit = !busy && typeof value === "string" && value.trim().length >= 2;
  return <div className="field-card dynamic-field"><span>{question.label}</span><input value={typeof value === "string" ? value : ""} onChange={event => onChange(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && canSubmit) { event.preventDefault(); onTextCommit(); } }} placeholder={question.help || "Enter details"} /><small>Your answer stays here while you type. Confirm it when you are finished.</small><button className="answer-lock" disabled={!canSubmit} onClick={onTextCommit}>{busy ? "Validating…" : "Confirm answer"}</button></div>;
}
