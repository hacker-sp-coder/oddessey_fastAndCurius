from pydantic import BaseModel
from typing import Dict

RUBRIC_VERSION = "1.0.0"

class CriterionDefinition(BaseModel):
    name: str
    weight: float
    description: str

RUBRIC_CRITERIA: Dict[str, CriterionDefinition] = {
    "problem_clarity": CriterionDefinition(
        name="Problem Clarity",
        weight=15.0,
        description="Severity, quantifiable magnitude, and customer pain urgency."
    ),
    "target_customer": CriterionDefinition(
        name="Target Customer",
        weight=15.0,
        description="Specificity of buyer persona, commercial channel, and user segment."
    ),
    "market_evidence": CriterionDefinition(
        name="Market Evidence",
        weight=15.0,
        description="Measured pilot metrics, retention signals, and customer demand evidence."
    ),
    "differentiation": CriterionDefinition(
        name="Differentiation & Moat",
        weight=15.0,
        description="Defensibility, technical architecture, and structural switching moats."
    ),
    "feasibility": CriterionDefinition(
        name="Technical & Operational Feasibility",
        weight=15.0,
        description="Realistic technology architecture and founder-market domain fit."
    ),
    "business_model": CriterionDefinition(
        name="Business Model",
        weight=15.0,
        description="Monetization strategy, unit pricing clarity, and margin feasibility."
    ),
    "scalability": CriterionDefinition(
        name="Scalability & Growth",
        weight=10.0,
        description="Capital-efficient distribution leverage, network effects, and roadmap."
    ),
}

def validate_rubric_weights() -> bool:
    total = sum(c.weight for c in RUBRIC_CRITERIA.values())
    return abs(total - 100.0) < 1e-4
