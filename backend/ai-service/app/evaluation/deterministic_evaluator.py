import re
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple
from app.models.rubric import RUBRIC_CRITERIA, RUBRIC_VERSION
from app.models.schemas import CriterionScore, EvaluationResult, InferredMetadata
from app.evaluation.base import BaseEvaluator
from app.market.base import BaseMarketEvidenceProvider
from app.market.curated_market import CuratedMarketEvidenceProvider

class DeterministicEvaluator(BaseEvaluator):
    name = "deterministic"

    def __init__(self, market_provider: Optional[BaseMarketEvidenceProvider] = None):
        self.market_provider = market_provider or CuratedMarketEvidenceProvider()

    def _extract_sentences_or_lines(self, text: str) -> List[str]:
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        if len(lines) > 2:
            return lines
        # Fallback to sentence split
        sentences = re.split(r"(?<=[.!?])\s+", text)
        return [s.strip() for s in sentences if s.strip()]

    def _find_evidence_lines(self, lines: List[str], keywords: List[str], max_items: int = 2) -> List[str]:
        matched = []
        for line in lines:
            line_lower = line.lower()
            if any(kw.lower() in line_lower for kw in keywords):
                if line not in matched:
                    matched.append(line)
            if len(matched) >= max_items:
                break
        return matched

    def evaluate(
        self,
        transcript: str,
        startup_name: Optional[str] = None,
        target_geography: Optional[str] = None,
        industry: Optional[str] = None,
        is_demo: bool = False,
        allow_fallback: bool = False
    ) -> EvaluationResult:
        inferred = False
        s_name = startup_name
        if not s_name or s_name.lower() in ("unknown", "pending pitch", "manual pitch"):
            # Attempt simple heuristic inference
            first_words = transcript.strip().split()[:6]
            s_name = " ".join(first_words) if first_words else "Unknown"
            inferred = True

        ind = industry
        if not ind or ind.lower() == "unknown":
            if any(w in transcript.lower() for w in ["crop", "farm", "agriculture", "soil"]):
                ind = "Agriculture"
            elif any(w in transcript.lower() for w in ["patient", "clinic", "health", "medical"]):
                ind = "Healthcare"
            elif any(w in transcript.lower() for w in ["payment", "bank", "invoice", "fintech"]):
                ind = "FinTech"
            else:
                ind = "Unknown"
            inferred = True

        t_geo = target_geography
        if not t_geo or t_geo.lower() == "unknown":
            if any(w in transcript.lower() for w in ["asia", "india", "vietnam", "indonesia"]):
                t_geo = "South Asia"
            elif any(w in transcript.lower() for w in ["us", "north america", "california", "europe"]):
                t_geo = "North America"
            else:
                t_geo = "Unknown"
            inferred = True
        
        lines = self._extract_sentences_or_lines(transcript)
        text_lower = transcript.lower()

        # Rubric scoring rules and signal checks
        # 1. Problem Clarity
        prob_kw = ["problem", "lose", "lost", "loss", "pain", "cost", "slow", "inefficient", "risk", "burden", "shortage", "fail", "gap", "destroy", "million", "%", "percent"]
        prob_evidence = self._find_evidence_lines(lines, prob_kw)
        has_quant_prob = bool(re.search(r"\d+(\.\d+)?\s*(%|percent|million|billion|hours|days|dollars)", text_lower))
        prob_score = 88.0 if (prob_evidence and has_quant_prob) else (70.0 if prob_evidence else 45.0)
        prob_rationale = (
            "Clear, quantifiable problem formulation with severe economic magnitude identified."
            if prob_score >= 80 else
            "Problem is described qualitatively, but lacks quantified metrics or acute baseline data."
        )
        prob_missing = "Historical trend data and long-term cost impact beyond initial symptoms." if prob_score >= 80 else "Specific quantitative measurements of customer pain and financial loss."

        # 2. Target Customer
        cust_kw = ["customer", "farmer", "clinic", "doctor", "developer", "enterprise", "smb", "consumer", "user", "b2b", "b2c", "cooperative", "buyer", "client"]
        cust_evidence = self._find_evidence_lines(lines, cust_kw)
        has_segment_spec = bool(re.search(r"(b2b|b2c|b2b2c|smallholder|enterprise|mid-market|smb|cooperative)", text_lower))
        cust_score = 85.0 if (cust_evidence and has_segment_spec) else (68.0 if cust_evidence else 42.0)
        cust_rationale = (
            "Specific target customer profile and buying persona identified with operational context."
            if cust_score >= 80 else
            "Broad customer group mentioned without defined purchasing authority or segment criteria."
        )
        cust_missing = "Direct customer willingness-to-pay validation and sales conversion friction."

        # 3. Market Evidence & Traction
        mkt_kw = ["pilot", "users", "retention", "growth", "revenue", "traction", "contract", "reduction", "onboarded", "active", "months", "test", "trial"]
        mkt_evidence = self._find_evidence_lines(lines, mkt_kw)
        has_traction_nums = bool(re.search(r"\d+\s*(active|users|farmers|pilot|retention|reduction|months|customers)", text_lower))
        mkt_score = 80.0 if (mkt_evidence and has_traction_nums) else (62.0 if mkt_evidence else 40.0)
        mkt_rationale = (
            "Empirical pilot metrics or customer adoption signals provided with measured outcome."
            if mkt_score >= 80 else
            "Early stage demand assertions with limited or unverified empirical pilot traction."
        )
        mkt_missing = "Statistically controlled comparison against legacy standard practices."

        # 4. Differentiation & Moat
        diff_kw = ["offline", "edge", "neural", "patented", "proprietary", "unique", "moat", "faster", "under", "milliseconds", "advantage", "competitor", "defensibility"]
        diff_evidence = self._find_evidence_lines(lines, diff_kw)
        has_tech_moat = bool(re.search(r"(offline|edge|proprietary|milliseconds|patented|unique)", text_lower))
        diff_score = 82.0 if (diff_evidence and has_tech_moat) else (65.0 if diff_evidence else 48.0)
        diff_rationale = (
            "Technical, architectural, or distribution differentiation clearly articulates why competitors cannot easily replicate."
            if diff_score >= 80 else
            "Differentiation relies heavily on feature-level benefits rather than structural defensive barriers."
        )
        diff_missing = "Head-to-head benchmark comparison against entrenched market incumbents."

        # 5. Technical & Operational Feasibility
        feas_kw = ["team", "engineer", "scientist", "founder", "experience", "phd", "years", "research", "architecture", "institute", "pedigree"]
        feas_evidence = self._find_evidence_lines(lines, feas_kw)
        has_domain_team = bool(re.search(r"(years|engineer|scientist|phd|institute|labs|co-founder)", text_lower))
        feas_score = 85.0 if (feas_evidence and has_domain_team) else (68.0 if feas_evidence else 50.0)
        feas_rationale = (
            "Founding team presents complementary domain depth and engineering capability aligned with product complexity."
            if feas_score >= 80 else
            "Operational delivery plan lacks technical feasibility validation or key hiring milestones."
        )
        feas_missing = "Edge device performance variability and low-spec hardware degradation testing."

        # 6. Business Model
        biz_kw = ["business model", "monetize", "b2b2c", "license", "$", "price", "annual", "per year", "saas", "subscription", "fee", "margin", "ltv", "cac", "contract"]
        biz_evidence = self._find_evidence_lines(lines, biz_kw)
        has_pricing_data = bool(re.search(r"(\$|usd|\bfee\b|license|pricing|\/year|\/month)", text_lower))
        biz_score = 80.0 if (biz_evidence and has_pricing_data) else (64.0 if biz_evidence else 42.0)
        biz_rationale = (
            "Specific monetization model and pricing strategy defined with payment intermediary alignment."
            if biz_score >= 80 else
            "Monetization concept outlined without validated unit pricing or margin structure."
        )
        biz_missing = "Detailed CAC payback duration and long-term customer contract renewal mechanics."

        # 7. Scalability & Growth
        scale_kw = ["scale", "expand", "raising", "50,000", "global", "distribution", "channel", "growth", "next 12 months", "roadmap", "partnerships"]
        scale_evidence = self._find_evidence_lines(lines, scale_kw)
        has_scale_milestone = bool(re.search(r"(raising|scale|expand|roadmap|next \d+ months)", text_lower))
        scale_score = 78.0 if (scale_evidence and has_scale_milestone) else (62.0 if scale_evidence else 45.0)
        scale_rationale = (
            "Distribution channel leverages established aggregators or partners for capital-efficient scaling."
            if scale_score >= 75 else
            "Scaling relies on direct manual sales without proven leverage or distribution flywheels."
        )
        scale_missing = "Regulatory compliance requirements across adjacent regional jurisdictions."

        # Compute weighted overall score
        scores_map = {
            "problem_clarity": prob_score,
            "target_customer": cust_score,
            "market_evidence": mkt_score,
            "differentiation": diff_score,
            "feasibility": feas_score,
            "business_model": biz_score,
            "scalability": scale_score
        }

        criteria_scores: Dict[str, CriterionScore] = {}
        total_weighted = 0.0

        for key, crit_def in RUBRIC_CRITERIA.items():
            sc = scores_map[key]
            w = crit_def.weight
            w_score = round((sc * w) / 100.0, 2)
            total_weighted += w_score

            rat = (
                prob_rationale if key == "problem_clarity" else
                cust_rationale if key == "target_customer" else
                mkt_rationale if key == "market_evidence" else
                diff_rationale if key == "differentiation" else
                feas_rationale if key == "feasibility" else
                biz_rationale if key == "business_model" else
                scale_rationale
            )
            ev = (
                prob_evidence if key == "problem_clarity" else
                cust_evidence if key == "target_customer" else
                mkt_evidence if key == "market_evidence" else
                diff_evidence if key == "differentiation" else
                feas_evidence if key == "feasibility" else
                biz_evidence if key == "business_model" else
                scale_evidence
            )
            mev = (
                prob_missing if key == "problem_clarity" else
                cust_missing if key == "target_customer" else
                mkt_missing if key == "market_evidence" else
                diff_missing if key == "differentiation" else
                feas_missing if key == "feasibility" else
                biz_missing if key == "business_model" else
                scale_missing
            )

            criteria_scores[key] = CriterionScore(
                name=crit_def.name,
                score=round(sc, 1),
                weight=w,
                weighted_score=w_score,
                rationale=rat,
                evidence=ev,
                missing_evidence=mev
            )

        overall_score = round(total_weighted, 1)

        # Retrieve market evidence with error resilience
        market_items = []
        try:
            market_res = self.market_provider.search_evidence(
                category=ind,
                geography=t_geo,
                query=s_name,
                is_demo=is_demo
            )
            market_items = market_res.items
        except Exception:
            market_items = []

        strengths = [
            f"Explicit problem articulation with {prob_score:.0f}/100 clarity on customer pain severity.",
            f"Target customer segment and commercial channel identified with {cust_score:.0f}/100 specificity.",
            f"Technical solution and team pedigree support operational feasibility ({feas_score:.0f}/100)."
        ]
        if diff_score >= 80:
            strengths.append("Proprietary offline/edge architectural barrier creates defensive advantage.")

        risks = [
            f"Adoption friction within '{t_geo}' customer workflows and habit inertia.",
            "Channel dependency risk when relying on third-party aggregators or enterprise buyers.",
            "Potential accuracy or edge-case failures across hardware/sensor variances."
        ]

        assumptions = [
            "End users value digital precision over incumbent manual routines.",
            "Enterprise buyers experience sufficient ROI to ensure high contract renewals.",
            "Distribution partnerships can scale without disproportionate sales headcount."
        ]

        missing_info = [
            "Granular unit economics breakdown including direct customer acquisition cost (CAC).",
            "Third-party audited validation metrics from unbiased external pilot partners.",
            "Detailed competitive comparison against regional alternative vendors."
        ]

        founder_questions = [
            f"How do you plan to compress the sales cycle when negotiating with buyers in {t_geo}?",
            "What is your customer retention strategy if an initial pilot encounters edge-case inaccuracies?",
            "What capital requirements are necessary before reaching break-even cash flow?"
        ]

        return EvaluationResult(
            rubric_version=RUBRIC_VERSION,
            evaluation_provider=self.name,
            evaluation_method="Deterministic Heuristic Rubric (Rule-Based Fallback)",
            overall_score=overall_score,
            criteria_scores=criteria_scores,
            strengths=strengths,
            risks=risks,
            assumptions=assumptions,
            missing_information=missing_info,
            founder_questions=founder_questions,
            market_evidence=market_items,
            confidence_score=0.82,
            confidence_limitations=(
                "Preliminary screening score calculated using rule-based rubric. "
                "This heuristic assessment is an initial triage aid and is NOT a statistically validated prediction of startup success."
            ),
            is_demo=is_demo,
            inferred_metadata=InferredMetadata(
                startup_name=s_name,
                industry=ind,
                target_geography=t_geo,
                confidence=0.75 if inferred else 1.0,
                inferred=inferred
            ),
            created_at=datetime.now(timezone.utc).isoformat()
        )
