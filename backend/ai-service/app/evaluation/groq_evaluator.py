import json
import logging
import random
import re
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import httpx

from app.config import settings
from app.models.rubric import RUBRIC_CRITERIA, RUBRIC_VERSION
from app.models.schemas import (
    CriterionScore,
    EvaluationResult,
    InferredMetadata,
    MarketEvidenceItem
)
from app.evaluation.base import BaseEvaluator
from app.evaluation.deterministic_evaluator import DeterministicEvaluator
from app.market.base import BaseMarketEvidenceProvider
from app.market.curated_market import CuratedMarketEvidenceProvider

logger = logging.getLogger(__name__)


def clean_and_parse_json(content_str: str) -> Dict[str, Any]:
    """Robustly parse JSON output from LLM, stripping markdown fences and trailing commas if needed."""
    text = content_str.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)
        text = text.strip()

    # Find the outermost JSON object boundaries
    start_idx = text.find("{")
    end_idx = text.rfind("}")
    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
        text = text[start_idx : end_idx + 1]

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Attempt trailing comma cleanup
        sanitized = re.sub(r",\s*([\]}])", r"\1", text)
        return json.loads(sanitized)


class GroqEvaluator(BaseEvaluator):
    name = "groq"

    def __init__(
        self,
        deterministic_fallback: Optional[DeterministicEvaluator] = None,
        market_provider: Optional[BaseMarketEvidenceProvider] = None
    ):
        self.market_provider = market_provider or CuratedMarketEvidenceProvider()
        self.fallback = deterministic_fallback or DeterministicEvaluator(self.market_provider)

    def is_available(self) -> bool:
        return bool(settings.groq_api_key and settings.groq_api_key.strip())

    def _prepare_transcript_for_eval(self, transcript: str) -> str:
        """Keep the full pitch whenever it fits context limits. If excessively large (>16k chars), condense transparently."""
        max_chars = 16000
        if len(transcript) <= max_chars:
            return transcript

        # Preserve opening 8k chars and ending 7k chars to retain problem, solution, metrics, and team
        truncated_msg = "\n\n[... Transcript condensed for model context limits: middle sections condensed, key metrics and claims preserved ...]\n\n"
        half = (max_chars - len(truncated_msg)) // 2
        return transcript[:half] + truncated_msg + transcript[-half:]

    def evaluate(
        self,
        transcript: str,
        startup_name: Optional[str] = None,
        target_geography: Optional[str] = None,
        industry: Optional[str] = None,
        is_demo: bool = False,
        allow_fallback: bool = False
    ) -> EvaluationResult:
        if not self.is_available():
            if allow_fallback:
                logger.info("GROQ_API_KEY is not configured; running user-permitted deterministic heuristic fallback.")
                fallback_res = self.fallback.evaluate(
                    transcript=transcript,
                    startup_name=startup_name,
                    target_geography=target_geography,
                    industry=industry,
                    is_demo=is_demo,
                    allow_fallback=True
                )
                fallback_res.confidence_limitations += (
                    " [Note: Evaluated via Deterministic Heuristic Fallback because GROQ_API_KEY was not configured.]"
                )
                return fallback_res
            else:
                raise RuntimeError(
                    "Groq evaluation failed: GROQ_API_KEY is not configured in backend environment. "
                    "Please set GROQ_API_KEY in the backend environment, or explicitly request heuristic fallback."
                )

        s_name_input = startup_name if (startup_name and startup_name.strip() and startup_name.lower() not in ("unknown", "pending pitch", "manual pitch")) else None
        ind_input = industry if (industry and industry.strip() and industry.lower() != "unknown") else None
        geo_input = target_geography if (target_geography and target_geography.strip() and target_geography.lower() != "unknown") else None

        prepared_transcript = self._prepare_transcript_for_eval(transcript)

        system_prompt = (
            "You are PitchLens, an expert venture capital investment screener. "
            "Evaluate the startup pitch against a 7-dimension rubric.\n"
            "STRICT CONCISENESS & COMPLETION BUDGET RULES:\n"
            "1. Grounding: Every score, strength, and risk must cite specific text from the pitch.\n"
            "2. Score calibration (0-100): 80-100 exceptional/quantified, 65-79 solid/credible, 45-64 early/unsubstantiated, 0-44 critical gaps.\n"
            "3. Conciseness: Each rationale MUST be strictly 1-2 punchy sentences citing specific claims. "
            "Evidence and missing_evidence items must be short quotes or phrases (under 12 words each).\n"
            "4. Counts: Provide exactly 2 strengths, 2 risks, 2 assumptions, 2 missing_information items, 2 founder_questions, and 1-2 unverified_founder_claims.\n"
            "5. Infer metadata: Infer startup_name, industry, target_geography if not provided. Otherwise set to 'Unknown'.\n"
            "6. Output: Return ONLY a valid JSON object matching the requested schema without markdown backticks."
        )

        user_prompt = f"""Evaluate this startup pitch:

Metadata Supplied:
- Startup Name: {s_name_input or "Not provided (infer from transcript)"}
- Primary Industry: {ind_input or "Not provided (infer from transcript)"}
- Target Geography: {geo_input or "Not provided (infer from transcript)"}

Pitch Transcript:
\"\"\"{prepared_transcript}\"\"\"

Respond with raw JSON conforming to:
{{
  "inferred_metadata": {{"startup_name": str, "industry": str, "target_geography": str, "confidence": float}},
  "criteria_scores": {{
    "problem_clarity": {{"score": float, "rationale": str, "evidence": [str], "missing_evidence": str}},
    "target_customer": {{"score": float, "rationale": str, "evidence": [str], "missing_evidence": str}},
    "market_evidence": {{"score": float, "rationale": str, "evidence": [str], "missing_evidence": str}},
    "differentiation": {{"score": float, "rationale": str, "evidence": [str], "missing_evidence": str}},
    "feasibility": {{"score": float, "rationale": str, "evidence": [str], "missing_evidence": str}},
    "business_model": {{"score": float, "rationale": str, "evidence": [str], "missing_evidence": str}},
    "scalability": {{"score": float, "rationale": str, "evidence": [str], "missing_evidence": str}}
  }},
  "strengths": [str],
  "risks": [str],
  "assumptions": [str],
  "missing_information": [str],
  "founder_questions": [str],
  "unverified_founder_claims": [
    {{"claim": str, "validation_needed": str}}
  ],
  "confidence_score": float,
  "confidence_limitations": str
}}"""

        parsed: Dict[str, Any] = {}
        max_retries = 2
        backoff_base = 2.0
        last_error_msg = ""

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
            "max_tokens": settings.groq_max_tokens,
            "temperature": 0.1
        }

        try:
            for attempt in range(max_retries + 1):
                try:
                    with httpx.Client(timeout=45.0) as client:
                        res = client.post(url, headers=headers, json=body)

                    if res.status_code == 200:
                        res_json = res.json()
                        content_str = res_json["choices"][0]["message"]["content"]
                        parsed = clean_and_parse_json(content_str)
                        break

                    elif res.status_code == 401:
                        raise RuntimeError("Groq API authentication failed (HTTP 401): Invalid or unauthorized GROQ_API_KEY.")

                    elif res.status_code == 429:
                        last_429_detail = ""
                        try:
                            err_data = res.json().get("error", {})
                            last_429_detail = err_data.get("message", "")
                        except Exception:
                            pass

                        # Parse Retry-After header
                        retry_after_hdr = res.headers.get("retry-after")
                        wait_seconds = 0.0
                        if retry_after_hdr:
                            try:
                                wait_seconds = float(retry_after_hdr)
                            except ValueError:
                                wait_seconds = 0.0

                        # Also parse seconds from error message if present (e.g. "try again in 2.3s")
                        if wait_seconds <= 0 and "try again in" in last_429_detail.lower():
                            match = re.search(r"try again in ([0-9]+(?:\.[0-9]+)?)s", last_429_detail, re.IGNORECASE)
                            if match:
                                wait_seconds = float(match.group(1))

                        # If rate limit is short (< 12s) and retries remain, wait with jitter and retry
                        if attempt < max_retries and 0 < wait_seconds <= 12.0:
                            jitter = random.uniform(0.2, 0.8)
                            sleep_time = wait_seconds + jitter
                            logger.warning(
                                f"Groq 429 rate limit received. Waiting {sleep_time:.2f}s before retry (attempt {attempt + 1}/{max_retries})..."
                            )
                            time.sleep(sleep_time)
                            continue
                        elif attempt < max_retries and wait_seconds <= 0:
                            sleep_time = (backoff_base ** attempt) + random.uniform(0.4, 1.0)
                            logger.warning(
                                f"Groq 429 rate limit received. Retrying in {sleep_time:.2f}s (attempt {attempt + 1}/{max_retries})..."
                            )
                            time.sleep(sleep_time)
                            continue
                        else:
                            detail_str = f" - {last_429_detail}" if last_429_detail else ""
                            cooldown_str = f" Cooldown required: ~{wait_seconds:.1f}s." if wait_seconds > 0 else ""
                            raise RuntimeError(
                                f"Groq API rate limit exceeded (HTTP 429){detail_str}.{cooldown_str} "
                                f"Output Tokens Per Minute (OTPM) limit reached on model '{settings.groq_model}'. "
                                "Please wait a moment before resubmitting, or choose offline heuristic evaluation."
                            )

                    elif res.status_code >= 500:
                        if attempt < max_retries:
                            time.sleep(1.5 * (attempt + 1))
                            continue
                        raise RuntimeError(f"Groq API service outage (HTTP {res.status_code}). Please retry.")

                    else:
                        raise RuntimeError(f"Groq API request failed with HTTP {res.status_code}: {res.text[:200]}")

                except httpx.RequestError as net_err:
                    if attempt < max_retries:
                        time.sleep(1.5 * (attempt + 1))
                        continue
                    raise RuntimeError(f"Groq network connection error: {str(net_err)}") from net_err

        except Exception as e:
            logger.error(f"Groq evaluation execution failed: {e}", exc_info=True)
            if allow_fallback:
                logger.warning("Groq evaluation failed; using explicitly allowed deterministic fallback.")
                fallback_res = self.fallback.evaluate(
                    transcript=transcript,
                    startup_name=startup_name,
                    target_geography=target_geography,
                    industry=industry,
                    is_demo=is_demo,
                    allow_fallback=True
                )
                fallback_res.confidence_limitations += (
                    f" [Note: Groq LLM failed ({str(e)[:120]}); evaluated via Deterministic Heuristic Fallback per user policy.]"
                )
                return fallback_res
            else:
                raise RuntimeError(f"Groq evaluation failed: {str(e)}") from e

        # Resolve inferred metadata
        inferred_meta = parsed.get("inferred_metadata", {})
        final_startup_name = s_name_input or inferred_meta.get("startup_name") or "Unknown"
        final_industry = ind_input or inferred_meta.get("industry") or "Unknown"
        final_geography = geo_input or inferred_meta.get("target_geography") or "Unknown"
        meta_confidence = float(inferred_meta.get("confidence", 0.75 if (s_name_input and ind_input) else 0.6))
        is_meta_inferred = bool(not s_name_input or not ind_input or not geo_input)

        inferred_metadata_obj = InferredMetadata(
            startup_name=final_startup_name,
            industry=final_industry,
            target_geography=final_geography,
            confidence=round(meta_confidence, 2),
            inferred=is_meta_inferred
        )

        # Market context resolution: retrieve curated benchmarks and extract pitch claims
        market_items: List[MarketEvidenceItem] = []
        try:
            market_res = self.market_provider.search_evidence(
                category=final_industry,
                geography=final_geography,
                query=final_startup_name,
                is_demo=is_demo
            )
            if market_res and market_res.items:
                market_items.extend(market_res.items)
        except Exception as m_err:
            logger.warning(f"Market evidence retrieval error: {m_err}")

        # Extract unverified claims from the pitch with honest provenance
        raw_claims = parsed.get("unverified_founder_claims", [])
        for i, c in enumerate(raw_claims):
            if isinstance(c, dict):
                c_text = c.get("claim", "").strip()
                val_needed = c.get("validation_needed", "Requires independent external market verification.").strip()
            else:
                c_text = str(c).strip()
                val_needed = "Requires independent external market verification."

            if c_text:
                market_items.append(
                    MarketEvidenceItem(
                        id=f"pitch-claim-{i+1}",
                        category=final_industry,
                        geography=final_geography,
                        claim=c_text,
                        source_title="Founder Pitch Transcript (Unverified Claim)",
                        source_url="",
                        publication_date=None,
                        retrieval_date=datetime.now(timezone.utc).date().isoformat(),
                        verification_status="UNVERIFIED_CLAIM",
                        notes=val_needed
                    )
                )

        # Build rubric criteria scores
        criteria_scores: Dict[str, CriterionScore] = {}
        total_weighted = 0.0

        for key, crit_def in RUBRIC_CRITERIA.items():
            raw_c = parsed.get("criteria_scores", {}).get(key, {})
            score_val = float(raw_c.get("score", 60.0))
            score_clamped = max(0.0, min(100.0, score_val))
            weight = crit_def.weight
            weighted_score = round((score_clamped * weight) / 100.0, 2)
            total_weighted += weighted_score

            raw_ev = raw_c.get("evidence", [])
            evidence_list = [str(e) for e in raw_ev] if isinstance(raw_ev, list) else [str(raw_ev)]

            criteria_scores[key] = CriterionScore(
                name=crit_def.name,
                score=round(score_clamped, 1),
                weight=weight,
                weighted_score=weighted_score,
                rationale=str(raw_c.get("rationale", f"Evaluated against {crit_def.name}.")),
                evidence=evidence_list,
                missing_evidence=str(raw_c.get("missing_evidence", "No missing evidence identified."))
            )

        overall_score = round(total_weighted, 1)

        return EvaluationResult(
            rubric_version=RUBRIC_VERSION,
            evaluation_provider=self.name,
            evaluation_method=f"Groq LLM ({settings.groq_model})",
            overall_score=overall_score,
            criteria_scores=criteria_scores,
            strengths=[str(s) for s in parsed.get("strengths", [])],
            risks=[str(r) for r in parsed.get("risks", [])],
            assumptions=[str(a) for a in parsed.get("assumptions", [])],
            missing_information=[str(m) for m in parsed.get("missing_information", [])],
            founder_questions=[str(q) for q in parsed.get("founder_questions", [])],
            market_evidence=market_items,
            confidence_score=round(float(parsed.get("confidence_score", 0.8)), 2),
            confidence_limitations=str(
                parsed.get(
                    "confidence_limitations",
                    "LLM-assisted early-stage venture triage. This initial viability screening is "
                    "not an investment recommendation or a guarantee of commercial outcomes."
                )
            ),
            is_demo=is_demo,
            inferred_metadata=inferred_metadata_obj,
            created_at=datetime.now(timezone.utc).isoformat()
        )
