import asyncio
import os
import sys
from datetime import datetime
import logging
from typing import Optional


import dotenv

# Add backend to path so we can import app modules
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from app.models.irt import Domain, DomainTheta
from app.models.assessment import ClinicalInsightReport, DomainScore, DifferentialInsight, ClinicalMarker
from app.services.pdf_generator import PDFGenerator
from app.config import get_settings
from app.services.openrouter_client import get_openrouter_client, chat_text_complete

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
dotenv.load_dotenv()


async def generate_interpretation_openrouter(
    theta_estimates: dict[Domain, DomainTheta],
    clinical_markers: list[ClinicalMarker]
) -> DifferentialInsight:
    """
    Generate interpretation using the configured OpenRouter text model.
    """
    settings = get_settings()
    if not settings.openrouter_api_key:
        raise ValueError("OPENROUTER_API_KEY not found; set it in .env")
    client = get_openrouter_client(settings)
    model = settings.llm_text_model

    # Construct prompt (similar to GeminiService._build_interpretation_prompt)
    theta_text = "\n".join([
        f"- {d.value}: θ = {t.theta:.2f}, percentile = {t.percentile:.0f}, SE = {t.standard_error:.2f}"
        for d, t in theta_estimates.items()
    ])

    prompt = f"""You are a clinical neuropsychologist analyzing assessment results for 
a neurodevelopmental screening. Generate a comprehensive differential insight report.

IMPORTANT: This is a Clinical Insight Report, NOT a diagnosis.

=== COGNITIVE DOMAIN SCORES (IRT θ scale, mean=0, SD=1) ===
{theta_text}

=== ADMINISTRATION DETAILS ===
- Assessment administered via adaptive IRT algorithm
- CPT Code 96146 applicable (Psychological testing, automated)

Based on ALL available multimodal evidence, provide the following sections EXACTLY as formatted below:

1. PRIMARY PATTERN: [A 1-sentence summary of the overall cognitive profile]

2. ASD INDICATORS:
   - [point 1]
   - [point 2]

3. ID INDICATORS:
   - [point 1]
   - [point 2]

4. DIFFERENTIAL CONFIDENCE: [Number]%

5. CLINICAL NOTES: [Brief observations]

6. EVIDENCE SUMMARY: [List key data points]

7. RECOMMENDED NEXT STEPS:
   - [Recommendation 1]
   - [Recommendation 2]

FORMATTING RULES:
- Use clear section headers exactly as numbered above.
- Do NOT use markdown bolding in list items (e.g. use "- Key: Value", NOT "- **Key**: Value").
- For ASD/ID Indicators, explicitly state if patterns are consistent or not.
"""

    text = await chat_text_complete(
        client,
        model=model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7,
    )
    logger.info("Generated interpretation text:")
    logger.info(text)
    
    # Helper to extract section content
    def extract_section(header_start, next_header_starts):
        start_idx = -1
        for h in [header_start] if isinstance(header_start, str) else header_start:
             idx = text.lower().find(h.lower())
             if idx != -1:
                 start_idx = idx
                 break
        
        if start_idx == -1: return ""
        
        # Find partial line end
        content_start = text.find("\n", start_idx) + 1
        
        closest_next = len(text)
        for h in next_header_starts:
            idx = text.lower().find(h.lower(), content_start)
            if idx != -1 and idx < closest_next:
                closest_next = idx
        
        return text[content_start:closest_next].strip()

    primary_pattern = extract_section(["1. PRIMARY PATTERN", "PRIMARY PATTERN"], ["2. ASD", "ASD INDICATORS"])
    asd_indicators = [line.strip("- *") for line in extract_section(["2. ASD INDICATORS", "ASD INDICATORS"], ["3. ID", "ID INDICATORS"]).split('\n') if line.strip()]
    id_indicators = [line.strip("- *") for line in extract_section(["3. ID INDICATORS", "ID INDICATORS"], ["4. DIFFERENTIAL", "DIFFERENTIAL CONFIDENCE"]).split('\n') if line.strip()]
    
    conf_text = extract_section(["4. DIFFERENTIAL CONFIDENCE", "DIFFERENTIAL CONFIDENCE"], ["5. CLINICAL", "CLINICAL NOTES"])
    try:
        # Extract percentage or float
        import re
        match = re.search(r'(\d+(?:\.\d+)?)', conf_text)
        if match:
            val = float(match.group(1))
            differential_confidence = val / 100.0 if val > 1 else val
        else:
            differential_confidence = 0.5
    except:
        differential_confidence = 0.5

    clinical_notes = extract_section(["5. CLINICAL NOTES", "CLINICAL NOTES"], ["6. EVIDENCE", "EVIDENCE SUMMARY"])
    evidence_summary = extract_section(["6. EVIDENCE SUMMARY", "EVIDENCE SUMMARY"], ["7. RECOMMENDED", "RECOMMENDED NEXT STEPS"])
    recommendations = [line.strip("- *") for line in extract_section(["7. RECOMMENDED NEXT STEPS", "RECOMMENDED NEXT STEPS"], ["FORMATTING RULES"]).split('\n') if line.strip()]

    return DifferentialInsight(
        primary_pattern=primary_pattern or "Generated Profile",
        asd_indicators=asd_indicators,
        id_indicators=id_indicators,
        differential_confidence=differential_confidence,
        clinical_notes=clinical_notes,
        evidence_summary=evidence_summary,
        recommendations=recommendations
    )

async def main():
    # Hardcoded data from the user's request
    report_id = "1539a639-35b6-4f54-99b5-c013621cf5ce"

    session_id = "b0f9f6bc-164f-43d7-8756-8b101c8a0f6a"
    patient_id = "manshaan-patient" # Placeholder or known ID if available

    # Reconstruct Theta Estimates
    # Domain Score (θ) Percentile Classification 95% CI
    # Episodic Memory 0.59 72% Above Average [-0.54, 1.72]
    # Executive Function -1.11 13% Below Average [-2.44, 0.22]
    # Working Memory -0.18 43% Average [-1.56, 1.21]
    # Processing Speed -0.57 28% Below Average [-1.81, 0.67]
    # Visuospatial -0.36 36% Average [-1.68, 0.96]
    
    theta_estimates = {
        Domain.EPISODIC_MEMORY: DomainTheta(domain=Domain.EPISODIC_MEMORY, theta=0.59, standard_error=0.575, percentile=72),
        Domain.EXECUTIVE_FUNCTION: DomainTheta(domain=Domain.EXECUTIVE_FUNCTION, theta=-1.11, standard_error=0.678, percentile=13),
        Domain.WORKING_MEMORY: DomainTheta(domain=Domain.WORKING_MEMORY, theta=-0.18, standard_error=0.707, percentile=43),
        Domain.PROCESSING_SPEED: DomainTheta(domain=Domain.PROCESSING_SPEED, theta=-0.57, standard_error=0.631, percentile=28),
        Domain.VISUOSPATIAL: DomainTheta(domain=Domain.VISUOSPATIAL, theta=-0.36, standard_error=0.676, percentile=36),
    }

    # Reconstruct IRT Log (from user input)
    irt_log = """## IRT Calculation Log
Session ID: b0f9f6bc-164f-43d7-8756-8b101c8a0f6a
Items Administered: 41
### Final θ Estimates (EAP)
- episodic_memory: θ = 0.590, SE = 0.575
- executive_function: θ = -1.109, SE = 0.678
- working_memory: θ = -0.178, SE = 0.707
- processing_speed: θ = -0.571, SE = 0.631
- visuospatial: θ = -0.360, SE = 0.676
### Response Summary
- Total items: 41
- Correct (MCQ): 26/41 (63.4%)"""

    # Generate Interpretation
    logger.info("Generating clinical interpretation...")
    differential = await generate_interpretation_openrouter(theta_estimates, [])
    
    # Construct Domain Scores list
    domain_scores = []
    for d, t in theta_estimates.items():
        # Quick classification based on values from user input
        classification = "Average"
        if t.theta > 0.5: classification = "Above Average"
        if t.theta < -0.5: classification = "Below Average"
        
        domain_scores.append(DomainScore(
            domain=d,
            theta=t.theta,
            standard_error=t.standard_error,
            percentile=t.percentile,
            classification=classification,
            confidence_interval=t.confidence_interval_95
        ))

    # Create Report Object
    report = ClinicalInsightReport(
        report_id=report_id,
        session_id=session_id,
        patient_id=patient_id,
        generated_at=datetime.utcnow(),
        domain_scores=domain_scores,
        clinical_markers=[],
        differential=differential,
        irt_calculation_log=irt_log,
        disclaimer="This is an AI-assisted Clinical Insight Report (REGENERATED)."
    )
    
    # Generate PDF
    logger.info("Generating PDF...")
    pdf_gen = PDFGenerator()
    pdf_bytes = pdf_gen.generate_report(report, patient_name="REGENERATED REPORT")
    
    # Save to file
    output_filename = "regenerated_report.pdf"
    with open(output_filename, "wb") as f:
        f.write(pdf_bytes)
    
    logger.info(f"Successfully generated {output_filename}")

if __name__ == "__main__":
    asyncio.run(main())
