export const OPERATIONS = {
  multiply: { label: "×", symbol: "×", fn: (a, b) => a * b },
  divide: { label: "÷", symbol: "÷", fn: (a, b) => (b === 0 ? null : a / b) },
  add: { label: "+", symbol: "+", fn: (a, b) => a + b },
  subtract: { label: "−", symbol: "−", fn: (a, b) => a - b },
};

export function executePricingRule(buyPrice, steps) {
  if (!steps || steps.length === 0) return { price: Number(buyPrice) || 0, valid: true, error: null };
  let result = Number(buyPrice) || 0;
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const op = OPERATIONS[step.operation];
    if (!op) return { price: null, valid: false, error: `Invalid operation at step ${i + 1}` };
    const operand = Number(step.operand);
    if (isNaN(operand) || step.operand === "" || step.operand === null) {
      return { price: null, valid: false, error: `Empty operand at step ${i + 1}` };
    }
    if (step.operation === "divide" && operand === 0) {
      return { price: null, valid: false, error: `Division by zero at step ${i + 1}` };
    }
    result = op.fn(result, operand);
    if (result === null) return { price: null, valid: false, error: `Calculation error at step ${i + 1}` };
  }
  return { price: Math.round(result * 100) / 100, valid: true, error: null };
}

export function formatRuleSteps(steps) {
  if (!steps || steps.length === 0) return "No steps configured";
  return steps.map((s) => `${OPERATIONS[s.operation]?.symbol || "?"} ${s.operand}`).join(" → ");
}

export function validateSteps(steps) {
  if (!steps || steps.length === 0) return { valid: false, error: "Add at least one calculation step" };
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (!step.operation) return { valid: false, error: `Select operation at step ${i + 1}` };
    if (step.operand === "" || step.operand === null || isNaN(Number(step.operand))) {
      return { valid: false, error: `Enter operand at step ${i + 1}` };
    }
    if (step.operation === "divide" && Number(step.operand) === 0) {
      return { valid: false, error: `Division by zero at step ${i + 1}` };
    }
  }
  return { valid: true, error: null };
}