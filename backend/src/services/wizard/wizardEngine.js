// Wizard flow controller — deterministic state machine over the steps
// declared in shared/wizardFieldMap.js. Decides:
//
//   - what the wizard's first step is given a user's addon profile
//   - what step follows a given step_id
//   - whether a captured value satisfies a field's input_type
//
// Does NOT talk to the LLM and does NOT touch the DB. Kept pure so the
// session-state logic is unit-testable without mocks. See:
//   - wizardSessions.js     for the DB-backed CRUD on wizard_sessions
//   - wizardExtractor.js    for the LLM extraction layer (free-text -> values)
//   - wizardFinalize.js     for the SQL writer that commits captured_data
//                           to draft form rows.

const {
  STEPS,
  STEPS_BY_ID,
  PROPERTY_BUCKET_TO_COLUMNS,
  stepsForAddons,
} = require('../../../../shared/wizardFieldMap');

// First step for a user with the given addon profile.
function firstStepForAddons(addons) {
  const order = stepsForAddons(addons);
  return order[0] || null;
}

// Step that follows `currentStepId` for this addon profile. Returns null
// when the wizard is at the end and ready to finalize.
function nextStep(currentStepId, addons) {
  const order = stepsForAddons(addons);
  const idx = order.indexOf(currentStepId);
  if (idx === -1 || idx === order.length - 1) return null;
  return order[idx + 1];
}

// 0-based progress within the user's path. Used by the UI's "step X of Y"
// indicator. Returns { current, total } — current is 1-based for display.
function progress(currentStepId, addons) {
  const order = stepsForAddons(addons);
  const idx = order.indexOf(currentStepId);
  return {
    current: idx < 0 ? 0 : idx + 1,
    total: order.length,
  };
}

// Type-coerce + validate a single field's value. Returns { ok, value, error }.
// Numbers come in as anything string-like — we normalize to a finite number
// >= 0 (negative income / negative deductions are universally errors here).
// `null` and `undefined` are treated as "not provided" — caller decides
// whether that's allowed via field.required.
function validateField(field, raw) {
  if (raw === undefined || raw === null || raw === '') {
    if (field.required) {
      return { ok: false, error: 'required' };
    }
    return { ok: true, value: field.default ?? null };
  }

  switch (field.input_type) {
    case 'pkr_amount':
    case 'pkr_optional':
    case 'number': {
      const n = Number(raw);
      if (!Number.isFinite(n)) return { ok: false, error: 'not_a_number' };
      if (n < 0) return { ok: false, error: 'negative_not_allowed' };
      // Cap at 1 trillion PKR — sanity guard; a real human filer wouldn't
      // touch this, and anything bigger indicates a parse error (e.g. the
      // LLM mistook "1500000" plus a trailing CNIC digit).
      if (n > 1e12) return { ok: false, error: 'unreasonably_large' };
      return { ok: true, value: n };
    }
    case 'select': {
      const opts = (field.options || []).map((o) => o.value);
      if (!opts.includes(raw)) return { ok: false, error: 'invalid_option' };
      return { ok: true, value: raw };
    }
    case 'yn': {
      if (raw === 'Y' || raw === 'N' || raw === true || raw === false) {
        const v = raw === true || raw === 'Y' ? 'Y' : 'N';
        return { ok: true, value: v };
      }
      return { ok: false, error: 'not_yes_no' };
    }
    default:
      return { ok: false, error: 'unknown_input_type' };
  }
}

// Validate every field in a step against a captured-values blob. Returns
// { ok: true, normalized } or { ok: false, errors } where errors maps
// field.key -> error code.
function validateStep(stepId, valuesIn) {
  const step = STEPS_BY_ID[stepId];
  if (!step) return { ok: false, errors: { _step: 'unknown_step' } };

  const normalized = {};
  const errors = {};
  for (const field of step.fields) {
    const r = validateField(field, valuesIn?.[field.key]);
    if (!r.ok) {
      errors[field.key] = r.error;
    } else {
      normalized[field.key] = r.value;
    }
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, normalized };
}

// Build the prompt schema sent to the client (drives the structured input
// widgets) AND to the LLM extractor (so it knows what fields to extract).
// Strips internal-only metadata (routing hints, etc).
function promptSchema(stepId) {
  const step = STEPS_BY_ID[stepId];
  if (!step) return null;
  return {
    step_id: step.id,
    prompt: step.prompt,
    tax_impact: step.tax_impact,
    fields: step.fields.map((f) => ({
      key: f.key,
      prompt: f.prompt,
      input_type: f.input_type,
      options: f.options || null,
      required: !!f.required,
      default: f.default ?? null,
    })),
  };
}

module.exports = {
  STEPS,
  STEPS_BY_ID,
  PROPERTY_BUCKET_TO_COLUMNS,
  firstStepForAddons,
  nextStep,
  progress,
  validateField,
  validateStep,
  promptSchema,
};
