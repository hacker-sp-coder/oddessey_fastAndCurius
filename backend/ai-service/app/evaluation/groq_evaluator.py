import json
from datetime import datetime, timezone
from typing import Optional
import httpx
from app.config import settings
from app.models.rubric import RUBRIC_CRITERIA, RUBRIC_VERSION
from app.models.schemas import CriterionScore, EvaluationResult
from app.evaluation.base import BaseEvaluator
from app.evaluation.deterministic_evaluator import DeterministicEvaluator
from app.market.curated_market import CuratedMarketEvidenceProvider

class GroqEvaluator(BaseEvaluator):
    name = "groq"

    def __init__(
        self,
        deterministic_fallback: Optional[DeterministicEvaluator] = None,
        market_provider: Optional[CuratedMarketEvidenceProvider] = None
    ):
        self.market_provider = market_provider or CuratedMarketEvidenceProvider()
        self.fallback = deterministic_fallback or DeterministicEvaluator(self.market_provider)

    def is_available(self) -> bool:
        return bool(settings.groq_api_key and settings.groq_api_key.strip())

    def evaluate(
        self,
        transcript: str,
        startup_name: Optional[str] = None,
        target_geography: Optional[str] = None,
        industry: Optional[str] = None
    ) -> EvaluationResult:
        if not self.is_available():
            fallback_res = self.fallback.evaluate(transcript, startup_name, target_geography, industry)
            fallback_res.confidence_limitations += (
                " [Note: Groq LLM evaluator was not configured (missing GROQ_API_KEY); "
                "evaluation automatically ran via Deterministic Heuristic Fallback.]"
            )
            return fallback_res

        s_name = startup_name or "Startup Pitch"
        t_geo = target_geography or "Global"
        ind = industry or "General Tech"

        system_prompt = (
            "You are an expert venture capital analyst and startup screener. "
            "You evaluate startup pitch transcripts against a strict, explainable 7-dimension rubric.\n"
            "Return ONLY valid JSON matching the exact schema requested. Do not include markdown code block ticks.\n"
            "The 7 criteria and their weights (summing to 100) are:\n"
            "- problem_clarity (weight: 15)\n"
            "- target_customer (weight: 15)\n"
            "- market_evidence (weight: 15)\n"
            "- differentiation (weight: 15)\n"
            "- feasibility (weight: 15)\n"
            "- business_model (weight: 15)\n"
            "- scalability (weight: 10)\n\n"
            "For each criterion, score between 0 and 100, calculate weighted_score = (score * weight)/100, "
            "provide a concise rationale, quote specific verbatim evidence from the transcript, and list missing evidence.\n"
            "Also return overall_score (sum of weighted scores), strengths (array of strings), risks (array of strings), "
            "assumptions (array of strings), missing_information (array of strings), founder_questions (array of 3-5 strings), "
            "and confidence_score (between 0.0 and 1.0)."
        )

        user_prompt = f"""Evaluate this startup pitch:
Startup Name: {s_name}
Industry: {ind}
Geography: {t_geo}

Transcript:
\"\"\"{transcript}\"\"\"

Respond with a raw JSON object with keys:
"overall_score": float,
"criteria_scores": {{
  "problem_clarity": {{"name": "Problem Clarity", "score": float, "weight": 15.0, "weighted_score": float, "rationale": str, "evidence": [str], "missing_evidence": str}},
  "target_customer": {{"name": "Target Customer", "score": float, "weight": 15.0, "weighted_score": float, "rationale": str, "evidence": [str], "missing_evidence": str}},
  "market_evidence": {{"name": "Market Evidence", "score": float, "weight": 15.0, "weighted_score": float, "rationale": str, "evidence": [str], "missing_evidence": str}},
  "differentiation": {{"name": "Differentiation & Moat", "score": float, "weight": 15.0, "weighted_score": float, "rationale": str, "evidence": [str], "missing_evidence": str}},
  "feasibility": {{"name": "Technical & Operational Feasibility", "score": float, "weight": 15.0, "weighted_score": float, "rationale": str, "evidence": [str], "missing_evidence": str}},
  "business_model": {{"name": "Business Model", "score": float, "weight": 15.0, "weighted_score": float, "rationale": str, "evidence": [str], "missing_evidence": str}},
  "scalability": {{"name": "Scalability & Growth", "score": float, "weight": 10.0, "weighted_score": float, "rationale": str, "evidence": [str], "missing_evidence": str}}
}},
"strengths": [str],
"risks": [str],
"assumptions": [str],
"missing_information": [str],
"founder_questions": [str],
"confidence_score": float
"""

        try:
            url = "https://api.groq.com/openai/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {settings.groq_api_key.strip()}",
                "Content-Type": "application/json"
            }
            body = {
                "model": settings.groq_model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.2
            }

            with httpx.Client(timeout=45.0) as client:
                res = client.post(url, headers=headers, json=body)

            if res.status_code != 200:
                # Fall back gracefully with error diagnosis
                fallback_res = self.fallback.evaluate(transcript, startup_name, target_geography, industry)
                fallback_res.confidence_limitations += (
                    f" [Note: Groq LLM API returned HTTP {res.status_code}; "
                    "evaluation safely fell back to Deterministic Heuristic Rubric.]"
                )
                return fallback_res

            res_json = res.json()
            content_str = res_json["choices"][0]["message"]["content"]
            parsed = json.loads(content_str)

            # Retrieve market context
            market_res = self.market_provider.search_evidence(category=ind, geography=t_geo)

            # Construct CriterionScore dictionary ensuring all 7 criteria exist
            criteria_scores = {}
            total_weighted = 0.0
            for k, crit_def in RUBRIC_CRITERIA.items():
                c_data = parsed.get("criteria_scores", {}).get(k, {})
                sc = float(c_data.get("score", 60.0))
                w = crit_def.weight
                w_score = round((sc * w) / 100.0, 2)
                total_weighted += w_score

                criteria_scores[k] = CriterionScore(
                    name=crit_def.name,
                    score=sc,
                    weight=w,
                    weighted_score=w_score,
                    rationale=str(c_data.get("rationale", "Evaluated by LLM.")),
                    evidence=[str(e) for e in c_data.get("evidence", [])],
                    missing_evidence=str(c_data.get("missing_evidence", "None identified."))
                )

            overall_score = round(total_weighted, 1)

            # Construct validated EvaluationResult
            return EvaluationResult(
                rubric_version=RUBRIC_VERSION,
                evaluation_provider=self.name,
                evaluation_method=f"Groq LLM Assisted ({settings.groq_model})",
                overall_score=overall_score,
                criteria_scores=criteria_scores,
                strengths=[str(s) for s in parsed.get("strengths", [])],
                risks=[str(r) for r in parsed.get("risks", [])],
                assumptions=[str(a) for a in parsed.get("assumptions", [])],
                missing_information=[str(m) for m in parsed.get("missing_information", [])],
                founder_questions=[str(q) for q in parsed.get("founder_questions", [])],
                market_evidence=market_res.items,
                confidence_score=float(parsed.get("confidence_score", 0.85)),
                confidence_limitations=(
                    "LLM-assisted screening synthesis. This heuristic assessment is an initial triage aid "
                    "and is NOT a statistically validated prediction of startup success."
                ),
                is_demo=False,
                created_at=datetime.now(timezone.utc).isoformat()
            )

        except Exception as e:
            # Safe fallback on any error, json parsing failure, timeout or validation mismatch
            fallback_res = self.fallback.evaluate(transcript, startup_name, target_geography, industry)
            fallback_res.confidence_limitations += (
                f" [Note: Groq LLM evaluation encountered error ({str(e)[:150]}); "
                "evaluation safely fell back to Deterministic Heuristic Rubric.]"
            )
            return fallback_res
